import { readCache, writeCache } from './storage.js';
import { classify } from './topics.js';
import { ENDPOINT, QUERY, parseBindings } from './wikidataQuery.js';

const CACHE_KEY = 'docs:wikidata:v1';
const CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// The build saves a snapshot to src/data/modern.json. The glob returns nothing when the file is missing,
// so the build never breaks, and the snapshot loads as its own file only when someone opens the collection.
const snapshotFiles = import.meta.glob('../data/modern.json', { import: 'default' });

async function loadSnapshot() {
  const load = Object.values(snapshotFiles)[0];
  if (!load) return null;
  try {
    const snapshot = await load();
    const docs = Array.isArray(snapshot?.docs) ? snapshot.docs : [];
    // Classify on load, so topic rule changes apply even when the build kept an older snapshot
    return docs.length ? docs.map(d => ({ ...d, topics: classify(d) })) : null;
  } catch {
    return null;
  }
}

export async function fetchModernDocs({ signal, fresh = false } = {}) {
  if (!fresh) {
    const snapshot = await loadSnapshot();
    if (snapshot) return snapshot;
    const cached = readCache(CACHE_KEY, CACHE_AGE_MS);
    if (cached) return cached;
  }
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(QUERY)}`;
  const response = await fetch(url, { signal, headers: { Accept: 'application/sparql-results+json' } });
  if (!response.ok) throw new Error(`Wikidata replied with status ${response.status}`);
  const docs = parseBindings(await response.json());
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
