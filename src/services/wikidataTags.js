// Tags modern documentaries from Wikidata's own structure, at build time.
// A title's main subjects (P921) and organisations (P449 original broadcaster, P272 production company) are looked
// up once each: we walk up "instance of" (P31), "subclass of" (P279) and "part of" (P361) to see which roots they
// reach. A battle is part of a war; BBC Four is part of the BBC. Every ID here was checked live on 25 September 2026.
// Shared by scripts/fetch-modern.mjs and the tests, so it must run in Node as well as the browser.

// Walk up P31, P279 and P361 from a subject to these roots
export const SUBJECT_ROOTS = {
  history: [
    'Q198', // war
    'Q350604', // armed conflict
    'Q178561', // battle
    'Q41397', // genocide
    'Q2763', // the Holocaust
    'Q309', // history
    'Q10931', // revolution
    'Q8473', // military
    'Q7283', // terrorism
    'Q7167' // colonialism
  ],
  society: [
    'Q1920219', // social issue
    'Q8458', // human rights
    'Q638', // music
    'Q735', // art
    'Q9174', // religion
    'Q7163', // politics
    'Q83267', // crime
    'Q49773', // social movement
    'Q8434', // education
    // culture Q11042, society Q8425 and art Q735 were tried and dropped: they reached 934, 606 and 389 titles,
    // including astronomy, aviation and the Olympic Games
    'Q10294', // poverty
    'Q8461', // racism
    'Q349' // sport
  ],
  britain: [
    'Q145', // United Kingdom
    'Q25', // Wales
    'Q21', // England
    'Q22', // Scotland
    'Q26', // Northern Ireland
    'Q23666', // Great Britain
    'Q179876', // Kingdom of England
    'Q161885', // Kingdom of Great Britain
    'Q230791' // Kingdom of Scotland
  ],
  'american-civil-war': ['Q8676'],
  'english-civil-war': [
    'Q80330', // English Civil War
    'Q2577772' // Wars of the Three Kingdoms
  ],
  'spanish-civil-war': ['Q10859'],
  monarchy: [
    'Q739941', // monarchy of the United Kingdom
    'Q645968', // British royal family
    'Q516569', // House of Normandy
    'Q106151', // House of Plantagenet
    'Q101978', // House of Tudor
    'Q179840' // House of Stuart
  ]
};

// People: a member of a royal house, or someone who held the crown
export const ROYAL_HOUSES = ['Q516569', 'Q106151', 'Q101978', 'Q179840'];
export const MONARCH_POSITIONS = [
  'Q18810062', // Monarch of England
  'Q12716207' // Monarch of Scotland
];

// Places and people: a British country (P17) or citizenship (P27)
export const UK_PLACES = SUBJECT_ROOTS.britain;

// Walk up parent organisation (P749), part of (P361), owned by (P127) and member of (P463) to these broadcasters
export const MAKERS = {
  bbc: ['Q9531'], // British Broadcasting Corporation
  pbs: ['Q215616'], // PBS
  history: ['Q1621107'] // History, the US television channel
};

// Genres (P136) that settle a topic on their own
export const GENRE_TOPICS = {
  Q369747: 'history', // war film
  Q17013749: 'history', // historical film
  Q842256: 'society', // musical film, used on music documentaries
  Q1800833: 'society', // rockumentary
  Q430525: 'society', // concert film
  Q20442589: 'society', // LGBTQ-related film
  Q2973201: 'society', // political film
  Q1339864: 'society', // sport film
  Q3076696: 'society', // association football film
  Q895583: 'society' // boxing film
};

export const TOPIC_TAGS = ['history', 'society', 'britain'];
export const SHORTCUT_TAGS = ['american-civil-war', 'english-civil-war', 'spanish-civil-war', 'monarchy'];
export const MAKER_TAGS = Object.keys(MAKERS).map(k => `maker:${k}`);


// Wikidata cannot walk a whole hierarchy for thousands of items within its 60 second limit, so the build climbs
// one level at a time: each query asks only for the direct parents of a batch of items. Tested live: 6 levels for
// 1,117 subjects and 4 levels for 592 organisations took 27 seconds in all.
export const SUBJECT_PARENTS = 'wdt:P31|wdt:P279|wdt:P361';
export const ORG_PARENTS = 'wdt:P749|wdt:P361|wdt:P127|wdt:P463';
export const SUBJECT_DEPTH = 4; // 6 levels drifted, for example World War II counting as a social issue
export const ORG_DEPTH = 4;
export const BATCH = 400;

const QID = /^Q\d{1,12}$/;
const values = ids => ids.filter(id => QID.test(id)).map(id => `wd:${id}`).join(' ');

export const parentsQuery = (ids, path) =>
  `SELECT ?item ?parent WHERE { VALUES ?item { ${values(ids)} } ?item ${path} ?parent . }`;

// Facts that settle a tag directly: royal house (P53), office held (P39), country (P17), citizenship (P27)
export const factsQuery = ids =>
  `SELECT ?item ?p ?v WHERE { VALUES ?item { ${values(ids)} } VALUES ?prop { wdt:P53 wdt:P39 wdt:P17 wdt:P27 } ` +
  '?item ?prop ?v . BIND(STRAFTER(STR(?prop), "direct/") AS ?p) }';

const lastPart = uri => String(uri || '').split('/').pop();

// Rows of ?item ?parent into { Q1: ['Q2', 'Q3'] }, merged into an existing map
export function addParents(map, json) {
  for (const row of json?.results?.bindings ?? []) {
    const item = lastPart(row.item?.value);
    const parent = lastPart(row.parent?.value);
    if (!QID.test(item) || !QID.test(parent)) continue;
    (map[item] ??= []).includes(parent) || map[item].push(parent);
  }
  return map;
}

// Rows of ?item ?p ?v into { Q1: [['P53', 'Q101978']] }, merged into an existing map
export function addFacts(map, json) {
  for (const row of json?.results?.bindings ?? []) {
    const item = lastPart(row.item?.value);
    const prop = row.p?.value;
    const value = lastPart(row.v?.value);
    if (QID.test(item) && prop && QID.test(value)) (map[item] ??= []).push([prop, value]);
  }
  return map;
}

// Every item reachable upward from `id` within `depth` steps, the item itself included
export function ancestors(id, parents, depth) {
  const seen = new Set([id]);
  let frontier = [id];
  for (let level = 0; level < depth && frontier.length; level++) {
    const next = [];
    for (const item of frontier) for (const parent of parents[item] ?? []) if (!seen.has(parent)) { seen.add(parent); next.push(parent); }
    frontier = next;
  }
  return seen;
}

const ROOT_TAGS = Object.entries(SUBJECT_ROOTS).flatMap(([tag, ids]) => ids.map(id => [id, tag]));
const MAKER_ROOTS = Object.entries(MAKERS).flatMap(([tag, ids]) => ids.map(id => [id, `maker:${tag}`]));

export function subjectTags(id, subjectParents, facts) {
  const reach = ancestors(id, subjectParents, SUBJECT_DEPTH);
  const tags = new Set(ROOT_TAGS.filter(([root]) => reach.has(root)).map(([, tag]) => tag));
  for (const [prop, value] of facts[id] ?? []) {
    if (prop === 'P53' && ROYAL_HOUSES.includes(value)) tags.add('monarchy');
    if (prop === 'P39' && MONARCH_POSITIONS.includes(value)) tags.add('monarchy');
    if ((prop === 'P17' || prop === 'P27') && UK_PLACES.includes(value)) tags.add('britain');
  }
  // Wars and genocides also reach social roots such as social issue. They belong in History and war only.
  if (tags.has('history')) tags.delete('society');
  return [...tags].sort();
}

export function orgTags(id, orgParents) {
  const reach = ancestors(id, orgParents, ORG_DEPTH);
  return MAKER_ROOTS.filter(([root]) => reach.has(root)).map(([, tag]) => tag).sort();
}

// Combine a title's own genres with the tags of its subjects and organisations
export function tagsForDoc(doc, lookup) {
  // Country of origin is left to the app (see keywordTopics and classify in topics.js). Here it would count as
  // "Wikidata found a topic" and switch off the keyword backup for every British production.
  const found = new Set();
  for (const genre of doc.genres ?? []) if (GENRE_TOPICS[genre]) found.add(GENRE_TOPICS[genre]);
  for (const id of doc.subjectIds ?? []) for (const tag of lookup[id] ?? []) if (!tag.startsWith('maker:')) found.add(tag);
  for (const id of doc.orgs ?? []) for (const tag of lookup[id] ?? []) if (tag.startsWith('maker:')) found.add(tag);
  // A shortcut implies its topic
  if (['american-civil-war', 'english-civil-war', 'spanish-civil-war'].some(t => found.has(t))) found.add('history');
  if (found.has('english-civil-war') || found.has('monarchy')) found.add('britain');
  return {
    topics: TOPIC_TAGS.filter(t => found.has(t)),
    shortcuts: SHORTCUT_TAGS.filter(t => found.has(t)),
    makers: MAKER_TAGS.filter(t => found.has(t)).map(t => t.slice('maker:'.length))
  };
}
