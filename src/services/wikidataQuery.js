import { classify } from './topics.js';
import { safeUrl } from './text.js';
import modernBlocklist from '../data/modernBlocklist.js';

// Shared by the app and scripts/fetch-modern.mjs, so it must run in Node as well as the browser.

// Wikidata public query service: no key needed, open CORS
export const ENDPOINT = 'https://query.wikidata.org/sparql';

// Documentary films (Q93204) released since 1980, with at least four Wikipedia language
// articles as a notability floor. Best known first. P57 director, P2047 duration (converted to minutes
// from seconds Q11574 or hours Q25235; minutes Q7727 pass through; the longest cut when several are listed),
// P921 main subject, P495 country of origin.
export const QUERY = `
SELECT ?film ?title ?desc ?links ?article
  (MIN(?date) AS ?released)
  (SAMPLE(?dirName) AS ?director)
  (MAX(?dur) AS ?minutes)
  (GROUP_CONCAT(DISTINCT ?subjName; separator="|") AS ?subjects)
  (GROUP_CONCAT(DISTINCT STRAFTER(STR(?country), "/entity/"); separator="|") AS ?countries)
  (GROUP_CONCAT(DISTINCT STRAFTER(STR(?genre), "/entity/"); separator="|") AS ?genres)
WHERE {
  { ?film wdt:P31 wd:Q93204 . } UNION { ?film wdt:P31 wd:Q11424 ; wdt:P136 wd:Q93204 . }
  ?film wdt:P577 ?date .
  FILTER(YEAR(?date) >= 1980)
  ?film wikibase:sitelinks ?links .
  FILTER(?links >= 4)
  ?film rdfs:label ?title . FILTER(LANG(?title) = "en")
  OPTIONAL { ?film schema:description ?desc . FILTER(LANG(?desc) = "en") }
  OPTIONAL { ?film wdt:P57 ?dir . ?dir rdfs:label ?dirName . FILTER(LANG(?dirName) = "en") }
  OPTIONAL {
    ?film p:P2047 [ psv:P2047 [ wikibase:quantityAmount ?durAmount ; wikibase:quantityUnit ?durUnit ] ; wikibase:rank ?durRank ] .
    FILTER(?durRank != wikibase:DeprecatedRank)
    BIND(IF(?durUnit = wd:Q11574, ?durAmount / 60, IF(?durUnit = wd:Q25235, ?durAmount * 60, ?durAmount)) AS ?dur)
  }
  OPTIONAL { ?film wdt:P921 ?subj . ?subj rdfs:label ?subjName . FILTER(LANG(?subjName) = "en") }
  OPTIONAL { ?film wdt:P495 ?country . }
  OPTIONAL { ?film wdt:P136 ?genre . }
  OPTIONAL { ?article schema:about ?film ; schema:isPartOf <https://en.wikipedia.org/> . }
}
GROUP BY ?film ?title ?desc ?links ?article
ORDER BY DESC(?links)
LIMIT 5000`;

// Nearly every title qualifies through a "documentary film" genre tag, which anyone can add to a feature film.
// Drop a title when it is also tagged as a dramatisation or shock film, or carries three or more fiction genres.
// Genre IDs checked live on 25 September 2026. War film is left out on purpose: many real documentaries carry it.
const DRAMATISED = new Set([
  'Q622370', // docudrama
  'Q472637', // docufiction
  'Q459435', // mockumentary
  'Q644437', // snuff film
  'Q1067324', // exploitation film
  'Q8253' // fiction
]);
const FICTION = new Set([
  'Q130232', 'Q157394', 'Q157443', 'Q188473', 'Q200092', 'Q319221', 'Q471839', 'Q959790', 'Q1054574',
  'Q1200678', 'Q2484376', 'Q7444356', 'Q172980', 'Q652256', 'Q859369', 'Q542475', 'Q116514801',
  'Q2297927', 'Q113485322', 'Q19367312', 'Q109733333'
]); // drama, fantasy, comedy, action, horror, adventure, science fiction, crime, romance, mystery, thriller,
// gangster, Western, epic, comedy drama, period drama, historical drama, spy, crime drama, crime thriller, political thriller
const BLOCKED = new Set(modernBlocklist.map(entry => entry.id));

export function isFiction(genres) {
  return genres.some(g => DRAMATISED.has(g)) || genres.filter(g => FICTION.has(g)).length >= 3;
}

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
    genres: split(value(row, 'genres')),
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
    .filter(d => d.title && !/^Q\d+$/.test(d.title) && !seen.has(d.id) && seen.add(d.id))
    .filter(d => !BLOCKED.has(d.id) && !isFiction(d.genres))
    .map((d, index) => ({ ...d, rank: index }));
}
