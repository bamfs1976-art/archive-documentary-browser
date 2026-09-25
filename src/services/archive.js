import { first, asList, toPlainText } from './text.js';
import blocklist from '../data/blocklist.json' with { type: 'json' };

// Archive.org advanced search: no key needed
const API = 'https://archive.org/advancedsearch.php';
export const PAGE_SIZE = 36;

// Named collections only, to keep to films Archive.org holds as public domain or openly licensed.
// Prelinger and Universal Newsreels count in full. The other film collections count only when an item
// carries a documentary or newsreel tag. News & Public Affairs is not trusted as a whole: in September 2026
// it held 3.4 million items, mostly community access TV, raw news footage and extremist propaganda.
const DOC_TAGS = 'subject:(documentary OR documentaries OR newsreel OR newsreels)';
const SOURCE =
  'mediatype:movies AND (collection:(prelinger OR universal_newsreels) OR ' +
  `(collection:(usgovfilms OR feature_films OR moviesandfilms OR silent_films OR short_films) AND ${DOC_TAGS}))`;

// Collections and titles holding trailers, stock footage, home movies, adverts, lectures, raw TV
// or militant videos rather than documentaries. Belt and braces: none of these should match SOURCE.
const EXCLUDE =
  ' AND NOT collection:(movie_trailers_unsorted OR stock_footage OR 35mmstockfootage OR home_movies OR prelinger_mashups' +
  ' OR iraq_war OR iraq_middleeast OR iraq_911 OR community_media OR royal_society_arts OR sept_11_tv_archive OR stream_only)' +
  ' AND NOT title:("home movies" OR "television commercials" OR trailer OR "stock footage")';

// Single items to hide, with the reason, in src/data/blocklist.json
const BLOCKED = blocklist
  .map(entry => String(entry.id || '').replace(/[^A-Za-z0-9._-]/g, ''))
  .filter(Boolean);
const BLOCK = BLOCKED.length ? ` AND NOT identifier:(${BLOCKED.join(' OR ')})` : '';

const TOPIC_QUERIES = {
  all: '',
  history: ' AND subject:(war OR history OR military OR army OR navy OR battle OR newsreel OR wwii OR "world war")',
  society: ' AND subject:(society OR social OR culture OR education OR health OR housing OR labor OR labour OR community OR family OR religion OR music)',
  // German wartime newsreels mention Britain as the enemy. They stay in History and war but swamp this topic.
  britain: ' AND (subject:(wales OR welsh OR britain OR british OR england OR scotland OR scottish OR london) OR title:(wales OR welsh OR britain OR british OR london))' +
    ' AND NOT title:(wochenschau OR "ufa-tonwoche")'
};

const SORTS = {
  popular: 'downloads desc',
  oldest: 'year asc',
  newest: 'year desc',
  title: 'titleSorter asc'
};

const FIELDS = ['identifier', 'title', 'year', 'description', 'subject', 'creator', 'downloads', 'runtime'];

// Strip Lucene syntax from typed text so a search never breaks the query
function searchClause(text) {
  const words = String(text || '')
    .replace(/[\\+\-!(){}[\]^"~*?:/&|]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
  if (!words.length) return '';
  const all = words.join(' AND ');
  return ` AND (title:(${all}) OR subject:(${all}) OR description:(${all}))`;
}

export function buildQuery({ topic = 'all', query = '' }) {
  return SOURCE + EXCLUDE + BLOCK + (TOPIC_QUERIES[topic] ?? '') + searchClause(query);
}

// Runtime appears as "01:12:30", "72:10" or "72 minutes". Returns whole minutes or null.
export function parseRuntime(value) {
  const text = String(first(value)).trim();
  const clock = text.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (clock) return clock[3] !== undefined ? Number(clock[1]) * 60 + Number(clock[2]) : Number(clock[1]);
  const number = text.match(/^(\d+(?:\.\d+)?)/);
  return number ? Math.round(Number(number[1])) : null;
}

function toDoc(raw) {
  const id = raw.identifier;
  const year = parseInt(first(raw.year), 10);
  return {
    kind: 'archive',
    id,
    title: toPlainText(first(raw.title)) || id,
    year: Number.isFinite(year) ? year : null,
    creator: toPlainText(first(raw.creator)),
    description: toPlainText(first(raw.description)),
    subjects: asList(raw.subject).map(String).slice(0, 8),
    minutes: parseRuntime(raw.runtime),
    thumb: `https://archive.org/services/img/${encodeURIComponent(id)}`,
    embed: `https://archive.org/embed/${encodeURIComponent(id)}`,
    page: `https://archive.org/details/${encodeURIComponent(id)}`
  };
}

export async function fetchArchiveDocs({ topic, sort, query, page, signal }) {
  const params = new URLSearchParams({ q: buildQuery({ topic, query }) });
  FIELDS.forEach(field => params.append('fl[]', field));
  params.append('sort[]', SORTS[sort] ?? SORTS.popular);
  params.set('rows', String(PAGE_SIZE));
  params.set('page', String(page));
  params.set('output', 'json');

  const response = await fetch(`${API}?${params}`, { signal });
  if (!response.ok) throw new Error(`Archive.org replied with status ${response.status}`);
  const json = await response.json();
  const docs = json?.response?.docs ?? [];
  return { items: docs.filter(d => d.identifier).map(toDoc), total: json?.response?.numFound ?? 0 };
}
