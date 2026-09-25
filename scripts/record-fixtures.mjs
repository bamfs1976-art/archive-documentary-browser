// Records real API responses for the Playwright smoke test into tests/e2e/fixtures, trimmed to keep the repo small.
// Run with `npm run record-fixtures` when the APIs change shape. Needs network access to archive.org and Wikidata.
import { writeFileSync } from 'node:fs';
import { buildQuery, PAGE_SIZE } from '../src/services/archive.js';
import { ENDPOINT, QUERY } from '../src/services/wikidataQuery.js';
import { USER_AGENT } from './fetch-modern.mjs';

const dir = new URL('../tests/e2e/fixtures/', import.meta.url);
const save = (name, data) => writeFileSync(new URL(name, dir), data);

// Archive.org: the request the app makes for All topics, page one, most watched. First 12 results kept.
const params = new URLSearchParams({ q: buildQuery({ topic: 'all', query: '' }) });
['identifier', 'title', 'year', 'description', 'subject', 'creator', 'downloads', 'runtime'].forEach(f => params.append('fl[]', f));
params.append('sort[]', 'downloads desc');
params.set('rows', String(PAGE_SIZE));
params.set('page', '1');
params.set('output', 'json');
const archive = await (await fetch(`https://archive.org/advancedsearch.php?${params}`)).json();
archive.response.docs = archive.response.docs.slice(0, 12);
save('archive.json', JSON.stringify(archive, null, 2) + '\n');

// One real thumbnail, served for every card
const thumb = await fetch(`https://archive.org/services/img/${encodeURIComponent(archive.response.docs[0].identifier)}`);
save('thumbnail.jpg', Buffer.from(await thumb.arrayBuffer()));

// Wikidata: the real query. The 15 best known titles plus up to 5 with the UK as country of origin.
const response = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
  body: new URLSearchParams({ query: QUERY, format: 'json' }).toString()
});
if (!response.ok) throw new Error(`Wikidata replied with status ${response.status}`);
const wikidata = await response.json();
const rows = wikidata.results.bindings;
const top = rows.slice(0, 15);
const british = rows.filter(r => !top.includes(r) && /(^|\|)Q145(\||$)/.test(r.countries?.value || '')).slice(0, 5);
wikidata.results.bindings = [...top, ...british];
save('wikidata.json', JSON.stringify(wikidata, null, 2) + '\n');

console.log(`Recorded ${archive.response.docs.length} Archive.org results of ${archive.response.numFound}, one thumbnail and ` +
  `${wikidata.results.bindings.length} Wikidata rows of ${rows.length} on ${new Date().toISOString().slice(0, 10)}.`);
