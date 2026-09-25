import { MAKERS, SHORTCUTS, TOPICS } from './topics.js';

// The query string holds everything needed to share a view:
// ?collection=modern&topic=history&subject=monarchy&maker=bbc&sort=newest&q=coal&doc=Q123
// Defaults are left out, so the home page stays at a clean address.
export const DEFAULTS = { collection: 'archive', topic: 'all', subject: '', maker: '', sort: 'popular', q: '', doc: '' };
const ORDER = ['collection', 'topic', 'subject', 'maker', 'sort', 'q', 'doc'];

const COLLECTIONS = ['archive', 'modern'];
const SORTS = ['popular', 'newest', 'oldest', 'title'];
const TOPIC_IDS = TOPICS.map(t => t.id);
const SUBJECT_IDS = SHORTCUTS.map(s => s.id);
const MAKER_IDS = MAKERS.map(m => m.id);
const MAX_QUERY = 200;

// Archive.org identifiers use letters, digits, dots, hyphens and underscores. Wikidata items are Q plus digits.
const DOC_PATTERNS = {
  archive: /^[A-Za-z0-9._-]{1,100}$/,
  modern: /^Q\d{1,12}$/
};

export const isValidDocId = (collection, id) => Boolean(DOC_PATTERNS[collection]?.test(String(id || '')));

// Anything unknown or malformed falls back to the default, so a bad link still opens a working page
export function parseUrl(search) {
  const params = new URLSearchParams(search);
  const pick = (key, allowed) => (allowed.includes(params.get(key)) ? params.get(key) : DEFAULTS[key]);
  const collection = pick('collection', COLLECTIONS);
  const doc = params.get('doc') || '';
  return {
    collection,
    topic: pick('topic', TOPIC_IDS),
    subject: pick('subject', SUBJECT_IDS),
    // Broadcasters are known for modern documentaries only
    maker: collection === 'modern' ? pick('maker', MAKER_IDS) : '',
    sort: pick('sort', SORTS),
    q: (params.get('q') || '').trim().slice(0, MAX_QUERY),
    doc: isValidDocId(collection, doc) ? doc : ''
  };
}

export function buildSearch(state) {
  const params = new URLSearchParams();
  for (const key of ORDER) {
    if (key === 'maker' && state.collection !== 'modern') continue;
    if (state[key] && state[key] !== DEFAULTS[key]) params.set(key, state[key]);
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}
