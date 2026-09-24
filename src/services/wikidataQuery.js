import { classify } from './topics.js';
import { safeUrl } from './text.js';

// Shared by the app and scripts/fetch-modern.mjs, so it must run in Node as well as the browser.

// Wikidata public query service: no key needed, open CORS
export const ENDPOINT = 'https://query.wikidata.org/sparql';

// Documentary films (Q93204) released since 1980, with at least four Wikipedia language
// articles as a notability floor. Best known first. P57 director, P2047 duration,
// P921 main subject, P495 country of origin.
export const QUERY = `
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

// Turn SPARQL result bindings into docs, dropping duplicates and items with no English title
export function parseBindings(json) {
  const seen = new Set();
  return (json?.results?.bindings ?? [])
    .map(toDoc)
    .filter(d => d.title && !/^Q\d+$/.test(d.title) && !seen.has(d.id) && seen.add(d.id));
}
