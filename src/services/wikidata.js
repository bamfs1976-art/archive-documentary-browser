import { readCache, writeCache } from './storage.js';
import { classify } from './topics.js';
import { safeUrl } from './text.js';

// Wikidata public query service: no key needed, open CORS
const ENDPOINT = 'https://query.wikidata.org/sparql';
const CACHE_KEY = 'docs:wikidata:v1';
const CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Documentary films (Q93204) released since 1980, with at least four Wikipedia language
// articles as a notability floor. Best known first. P57 director, P2047 duration,
// P921 main subject, P495 country of origin.
const QUERY = `
SELECT ?film ?title ?desc ?links ?article
  (MIN(?date) AS ?released)
  (SAMPLE(?dirName) AS ?director)
  (SAMPLE(?dur) AS ?minutes)
  (GROUP_CONCAT(DISTINCT ?subjName; separator="|") AS ?subjects)
  (GROUP_CONCAT(DISTINCT STRAFTER(STR(?country), "/entity/"); separator="|") AS ?countries)
WHERE {
  { ?film wdt:P31 wd:Q93204 . } UNION { ?film wdt:P31 wd:Q11424 ; wdt:P136 wd:Q93204 . }
  ?film wdt:P577 ?date .
  FILTER(YEAR(?date) >= 1980)
  ?film wikibase:sitelinks ?links .
  FILTER(?links >= 4)
  ?film rdfs:label ?title . FILTER(LANG(?title) = "en")
  OPTIONAL { ?film schema:description ?desc . FILTER(LANG(?desc) = "en") }
  OPTIONAL { ?film wdt:P57 ?dir . ?dir rdfs:label ?dirName . FILTER(LANG(?dirName) = "en") }
  OPTIONAL { ?film wdt:P2047 ?dur . }
  OPTIONAL { ?film wdt:P921 ?subj . ?subj rdfs:label ?subjName . FILTER(LANG(?subjName) = "en") }
  OPTIONAL { ?film wdt:P495 ?country . }
  OPTIONAL { ?article schema:about ?film ; schema:isPartOf <https://en.wikipedia.org/> . }
}
GROUP BY ?film ?title ?desc ?links ?article
ORDER BY DESC(?links)
LIMIT 2000`;

const value = (row, key) => row[key]?.value ?? '';
const split = text => (text ? text.split('|').filter(Boolean) : []);

function toDoc(row, index) {
  const qid = value(row, 'film').split('/').pop();
  const title = value(row, 'title');
  const year = parseInt(value(row, 'released').slice(0, 4), 10);
  const minutes = Math.round(Number(value(row, 'minutes')));
  const doc = {
    kind: 'modern',
    id: qid,
    rank: index,
    title,
    year: Number.isFinite(year) ? year : null,
    director: value(row, 'director'),
    description: value(row, 'desc'),
    minutes: minutes > 0 ? minutes : null,
    subjects: split(value(row, 'subjects')).slice(0, 6),
    countries: split(value(row, 'countries')),
    wikipedia: safeUrl(value(row, 'article')),
    wikidata: `https://www.wikidata.org/wiki/${qid}`,
    watch: `https://www.justwatch.com/uk/search?q=${encodeURIComponent(title)}`
  };
  doc.topics = classify(doc);
  return doc;
}

export async function fetchModernDocs({ signal, fresh = false } = {}) {
  if (!fresh) {
    const cached = readCache(CACHE_KEY, CACHE_AGE_MS);
    if (cached) return cached;
  }
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(QUERY)}`;
  const response = await fetch(url, { signal, headers: { Accept: 'application/sparql-results+json' } });
  if (!response.ok) throw new Error(`Wikidata replied with status ${response.status}`);
  const json = await response.json();
  const seen = new Set();
  const docs = (json?.results?.bindings ?? [])
    .map(toDoc)
    .filter(d => d.title && !/^Q\d+$/.test(d.title) && !seen.has(d.id) && seen.add(d.id));
  writeCache(CACHE_KEY, docs);
  return docs;
}

export function filterModern(docs, { topic, query, sort }) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const matches = docs.filter(d => {
    if (topic !== 'all' && !d.topics.includes(topic)) return false;
    if (!words.length) return true;
    const haystack = [d.title, d.director, d.description, ...d.subjects].join(' ').toLowerCase();
    return words.every(w => haystack.includes(w));
  });
  const byYear = (a, b) => (a.year ?? 0) - (b.year ?? 0);
  const sorters = {
    popular: (a, b) => a.rank - b.rank,
    newest: (a, b) => byYear(b, a),
    oldest: byYear,
    title: (a, b) => a.title.localeCompare(b.title, 'en-GB')
  };
  return [...matches].sort(sorters[sort] ?? sorters.popular);
}
