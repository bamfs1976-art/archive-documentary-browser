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

export function classify({ title, description, subjects, countries }) {
  const text = [title, description, ...subjects].join(' ');
  const found = [];
  if (countries.some(c => BRITISH_COUNTRIES.has(c)) || PATTERNS.britain.test(text)) found.push('britain');
  if (PATTERNS.history.test(text)) found.push('history');
  if (PATTERNS.society.test(text)) found.push('society');
  return found;
}
