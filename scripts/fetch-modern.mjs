// Runs before `vite build`. Fetches modern documentaries from Wikidata, tags them from Wikidata's own structure
// (see src/services/wikidataTags.js) and saves src/data/modern.json.
// When Wikidata is slow, down or returns too little at any step, it keeps the committed snapshot and warns.
// It never fails the build.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DETAILS_BATCH, ENDPOINT, IDS_QUERY, detailsQuery, parseBindings } from '../src/services/wikidataQuery.js';
import {
  BATCH, ORG_DEPTH, ORG_PARENTS, SUBJECT_DEPTH, SUBJECT_PARENTS,
  addFacts, addParents, factsQuery, orgTags, parentsQuery, subjectTags, tagsForDoc
} from '../src/services/wikidataTags.js';

export const SNAPSHOT = fileURLToPath(new URL('../src/data/modern.json', import.meta.url));
// Per request. The main query takes about 15 seconds; each tagging batch a second or two.
export const TIMEOUT_MS = 90_000;
// Wikidata limits query time per client. On a 429 reply, wait as asked (capped) and try again.
export const MAX_RETRIES = 3;
const MAX_WAIT_S = 60;
// A healthy result holds well over this. Fewer means a partial or broken reply.
export const MIN_DOCS = 200;
// Wikimedia asks scripted clients to identify themselves
export const USER_AGENT =
  'DocumentaryBrowser/1.0 (https://github.com/bamfs1976-art/archive-documentary-browser) build-script';

function describeSnapshot(file) {
  try {
    const { generatedAt, docs } = JSON.parse(readFileSync(file, 'utf8'));
    return `${docs.length} titles from ${generatedAt}`;
  } catch {
    return null;
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function sparqlClient({ fetchImpl, timeoutMs, pauseMs }) {
  return async function sparql(query) {
    for (let attempt = 1; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(ENDPOINT, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Accept: 'application/sparql-results+json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': USER_AGENT
          },
          body: new URLSearchParams({ query, format: 'json' }).toString()
        });
        if (response.status === 429 && attempt < MAX_RETRIES) {
          const wait = Math.min(Number(response.headers?.get?.('retry-after')) || 30, MAX_WAIT_S);
          await sleep(wait * 1000);
          continue;
        }
        if (!response.ok) throw new Error(`Wikidata replied with status ${response.status}`);
        const json = await response.json();
        if (pauseMs) await sleep(pauseMs);
        return json;
      } finally {
        clearTimeout(timer);
      }
    }
  };
}

// Climb `depth` levels of parents from `start`, one batch of direct parents at a time
async function climb(sparql, start, path, depth, parents) {
  let frontier = [...new Set(start)];
  const seen = new Set(frontier);
  for (let level = 0; level < depth && frontier.length; level++) {
    const next = [];
    for (let i = 0; i < frontier.length; i += BATCH) {
      addParents(parents, await sparql(parentsQuery(frontier.slice(i, i + BATCH), path)));
      for (const id of frontier.slice(i, i + BATCH)) {
        for (const parent of parents[id] ?? []) if (!seen.has(parent)) { seen.add(parent); next.push(parent); }
      }
    }
    frontier = next;
  }
  return parents;
}

// Stage one lists the titles, best known first. Stage two fetches their details in batches.
export async function fetchDocs(sparql) {
  const listed = ((await sparql(IDS_QUERY))?.results?.bindings ?? [])
    .map(row => ({ id: String(row.film?.value || '').split('/').pop(), format: row.format?.value }))
    .filter(entry => /^Q\d+$/.test(entry.id));
  const format = Object.fromEntries(listed.map(entry => [entry.id, entry.format]));
  const order = Object.fromEntries(listed.map((entry, index) => [entry.id, index]));
  const rows = [];
  for (let i = 0; i < listed.length; i += DETAILS_BATCH) {
    const json = await sparql(detailsQuery(listed.slice(i, i + DETAILS_BATCH).map(entry => entry.id)));
    rows.push(...(json?.results?.bindings ?? []));
  }
  for (const row of rows) {
    const id = String(row.film?.value || '').split('/').pop();
    row.format = { value: format[id] };
    row.order = order[id] ?? Infinity;
  }
  rows.sort((a, b) => a.order - b.order);
  return parseBindings({ results: { bindings: rows } });
}

export async function tagDocs(docs, sparql) {
  const subjects = [...new Set(docs.flatMap(d => d.subjectIds))];
  const orgs = [...new Set(docs.flatMap(d => d.orgs))];
  const subjectParents = await climb(sparql, subjects, SUBJECT_PARENTS, SUBJECT_DEPTH, {});
  const orgParents = await climb(sparql, orgs, ORG_PARENTS, ORG_DEPTH, {});
  const facts = {};
  for (let i = 0; i < subjects.length; i += BATCH) addFacts(facts, await sparql(factsQuery(subjects.slice(i, i + BATCH))));

  const lookup = {};
  for (const id of subjects) lookup[id] = subjectTags(id, subjectParents, facts);
  for (const id of orgs) lookup[id] = [...(lookup[id] ?? []), ...orgTags(id, orgParents)];
  // Keep the file the browser downloads small: raw IDs stay here, links the app can rebuild from the id and title
  // are left out (see hydrate in wikidata.js) and so are empty tag lists
  return docs.map(({ topics, subjectIds, orgs: docOrgs, genres, kind, wikidata, watch, ...doc }) => {
    const found = tagsForDoc({ ...doc, subjectIds, orgs: docOrgs, genres }, lookup);
    const tags = Object.fromEntries(Object.entries(found).filter(([, list]) => list.length));
    return Object.keys(tags).length ? { ...doc, tags } : doc;
  });
}

export async function refreshSnapshot({ fetchImpl = fetch, file = SNAPSHOT, log = console, timeoutMs = TIMEOUT_MS, pauseMs = 500, now = () => new Date() } = {}) {
  const started = Date.now();
  const sparql = sparqlClient({ fetchImpl, timeoutMs, pauseMs });
  try {
    const parsed = await fetchDocs(sparql);
    if (parsed.length < MIN_DOCS) throw new Error(`only ${parsed.length} titles came back, expected at least ${MIN_DOCS}`);
    const docs = await tagDocs(parsed, sparql);

    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ generatedAt: now().toISOString(), count: docs.length, docs }) + '\n');
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const tagged = docs.filter(d => d.tags?.topics?.length).length;
    log.log(`[fetch-modern] Saved ${docs.length} titles (${tagged} with Wikidata topics) in ${seconds}s`);
    return { updated: true, count: docs.length };
  } catch (error) {
    const reason = error.name === 'AbortError' ? `no reply within ${timeoutMs / 1000}s` : error.message;
    const kept = existsSync(file) && describeSnapshot(file);
    log.warn(`[fetch-modern] WARNING: Wikidata refresh failed (${reason}).`);
    log.warn(kept
      ? `[fetch-modern] Keeping the existing snapshot: ${kept}.`
      : '[fetch-modern] No usable snapshot exists. The app will fetch from Wikidata live, which is slow.');
    return { updated: false, reason };
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await refreshSnapshot();
}
