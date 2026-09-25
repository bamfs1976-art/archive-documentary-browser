export const TOPICS = [
  { id: 'all', label: 'All topics' },
  { id: 'history', label: 'History and war' },
  { id: 'society', label: 'Society and culture' },
  { id: 'britain', label: 'Wales and Britain' }
];

export const topicLabel = id => TOPICS.find(t => t.id === id)?.label ?? '';

// Wikidata country codes: UK, Wales, England, Scotland, Northern Ireland
const BRITISH_COUNTRIES = new Set(['Q145', 'Q25', 'Q21', 'Q22', 'Q26']);

const PATTERNS = {
  history: /\b(wars?|warfare|battles?|military|army|navy|air force|soldiers?|veterans?|holocaust|nazis?|nazism|genocide|history|historical|empire|revolution|colonial|colonialism|invasion|occupation|cold war|vietnam|afghanistan|iraq|falklands|terrorism|resistance|dictators?|espionage)\b/i,
  society: /\b(society|social|culture|cultural|music|musicians?|art|artists?|poverty|class|race|racism|civil rights|education|schools?|religion|politics|political|immigration|migrants?|refugees?|community|crime|justice|prisons?|gender|feminism|women|lgbt|gay|protests?|activism|family|housing|health|food|sport|football|fashion|youth|labour|trade unions?)\b/i,
  britain: /\b(wales|welsh|britain|british|england|scotland|scottish|london|swansea|cardiff|united kingdom|northern ireland)\b/i
};

// Subject shortcuts. Wikidata tags them at build time; these phrases are the backup for titles it has not tagged.
// Kept specific on purpose: "Queen" alone finds the band, "Franco" alone finds James Franco, "Cavaliers" a basketball team.
export const SHORTCUTS = [
  { id: 'american-civil-war', label: 'American Civil War', topic: 'history',
    pattern: /\b(American Civil War|Gettysburg|Confedera(te|cy)|Antietam|Appomattox|Abraham Lincoln)\b/i },
  { id: 'english-civil-war', label: 'English Civil War', topic: 'history',
    pattern: /\b(English Civil Wars?|Wars of the Three Kingdoms|Oliver Cromwell|Cromwell|Roundheads?|New Model Army)\b/i },
  { id: 'spanish-civil-war', label: 'Spanish Civil War', topic: 'history',
    pattern: /\b(Spanish Civil War|Guerra Civil Española|Francisco Franco|Francoist|Franco regime|International Brigades?|Guernica)\b/i },
  { id: 'monarchy', label: 'British monarchy', topic: 'britain',
    pattern: /\b(Tudors?|Plantagenets?|House of Stuart|Stuart (kings?|queens?|dynasty|monarchs?)|Normans|Norman Conquest|William the Conqueror|Henry VIII|Elizabeth I|Richard III|Charles I|British monarchy|British royal family|royal family|coronation|Queen Elizabeth II|Queen Victoria|King George (V|VI)|Princess Diana|Diana, Princess of Wales)\b/i }
];

export const shortcutLabel = id => SHORTCUTS.find(s => s.id === id)?.label ?? '';

const textOf = ({ title, description, subjects }) => [title, description, ...(subjects ?? [])].join(' ');

export function shortcutsFor(doc) {
  const text = textOf(doc);
  const tagged = doc.tags?.shortcuts ?? [];
  return SHORTCUTS.filter(s => tagged.includes(s.id) || s.pattern.test(text)).map(s => s.id);
}

const madeInBritain = doc => (doc.countries ?? []).some(c => BRITISH_COUNTRIES.has(c));

// Topics from Wikidata's subjects and genres when the build found any, keyword matching otherwise.
// A British country of origin adds Wales and Britain either way.
export function classify(doc) {
  const structured = doc.tags?.topics ?? [];
  if (!structured.length) return keywordTopics(doc);
  const found = new Set(structured);
  if (madeInBritain(doc)) found.add('britain');
  return TOPICS.map(t => t.id).filter(id => found.has(id));
}

export function keywordTopics({ title, description, subjects, countries }) {
  const text = [title, description, ...(subjects ?? [])].join(' ');
  const found = [];
  if ((countries ?? []).some(c => BRITISH_COUNTRIES.has(c)) || PATTERNS.britain.test(text)) found.push('britain');
  if (PATTERNS.history.test(text)) found.push('history');
  if (PATTERNS.society.test(text)) found.push('society');
  return found;
}
