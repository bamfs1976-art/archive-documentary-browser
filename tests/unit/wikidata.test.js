import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchModernDocs, filterModern } from '../../src/services/wikidata.js';

const lit = value => ({ type: 'literal', value: String(value) });
const row = ({ qid, title, released = '2000-01-01T00:00:00Z', ...rest }) => {
  const r = {
    film: { type: 'uri', value: `http://www.wikidata.org/entity/${qid}` },
    title: lit(title),
    released: lit(released)
  };
  for (const [key, val] of Object.entries(rest)) r[key] = lit(val);
  return r;
};

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('fetchModernDocs', () => {
  const reply = bindings => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: { bindings } }) });

  it('parses rows into docs with topics and safe links', async () => {
    const fetchMock = reply([
      row({
        qid: 'Q1', title: 'Hoop Dreams', released: '1994-10-14T00:00:00Z', desc: '1994 film by Steve James',
        director: 'Steve James', minutes: '170.0', subjects: 'basketball|poverty', countries: 'Q30',
        article: 'https://en.wikipedia.org/wiki/Hoop_Dreams'
      }),
      row({ qid: 'Q2', title: 'Bad Link', article: 'javascript:alert(1)' })
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const docs = await fetchModernDocs({ fresh: true });

    expect(fetchMock.mock.calls[0][0]).toMatch(/^https:\/\/query\.wikidata\.org\/sparql\?format=json&query=/);
    expect(docs[0]).toMatchObject({
      kind: 'modern', id: 'Q1', rank: 0, title: 'Hoop Dreams', year: 1994, director: 'Steve James',
      minutes: 170, subjects: ['basketball', 'poverty'], countries: ['Q30'], topics: ['society'],
      wikipedia: 'https://en.wikipedia.org/wiki/Hoop_Dreams',
      wikidata: 'https://www.wikidata.org/wiki/Q1',
      watch: 'https://www.justwatch.com/uk/search?q=Hoop%20Dreams'
    });
    expect(docs[1].wikipedia).toBe('');
  });

  it('drops duplicates and untitled items', async () => {
    vi.stubGlobal('fetch', reply([
      row({ qid: 'Q1', title: 'One' }),
      row({ qid: 'Q1', title: 'One again' }),
      row({ qid: 'Q3', title: 'Q3' }),
      row({ qid: 'Q4', title: '' })
    ]));
    const docs = await fetchModernDocs({ fresh: true });
    expect(docs.map(d => d.title)).toEqual(['One']);
  });

  it('treats a missing or zero duration as unknown', async () => {
    vi.stubGlobal('fetch', reply([row({ qid: 'Q1', title: 'A' }), row({ qid: 'Q2', title: 'B', minutes: '0' })]));
    const docs = await fetchModernDocs({ fresh: true });
    expect(docs.map(d => d.minutes)).toEqual([null, null]);
  });

  it('serves the cache on the next call and skips it when fresh', async () => {
    const fetchMock = reply([row({ qid: 'Q1', title: 'Cached' })]);
    vi.stubGlobal('fetch', fetchMock);
    await fetchModernDocs({ fresh: true });
    const again = await fetchModernDocs();
    expect(again[0].title).toBe('Cached');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await fetchModernDocs({ fresh: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws on an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(fetchModernDocs({ fresh: true })).rejects.toThrow('Wikidata replied with status 429');
  });
});

describe('filterModern', () => {
  const docs = [
    { id: 'a', rank: 0, title: 'Zulu Dawn', year: 1995, director: 'X', description: 'war film', subjects: [], topics: ['history'] },
    { id: 'b', rank: 1, title: 'Aberfan', year: 2016, director: 'Y', description: 'Welsh disaster', subjects: ['mining'], topics: ['britain'] },
    { id: 'c', rank: 2, title: 'Music Box', year: null, director: 'Z', description: 'band', subjects: [], topics: ['society'] }
  ];
  const ids = list => list.map(d => d.id);

  it('keeps everything for all topics and no search', () => {
    expect(ids(filterModern(docs, { topic: 'all', query: '', sort: 'popular' }))).toEqual(['a', 'b', 'c']);
  });

  it('filters by topic', () => {
    expect(ids(filterModern(docs, { topic: 'britain', query: '', sort: 'popular' }))).toEqual(['b']);
  });

  it('needs every search word to match title, director, description or subjects', () => {
    expect(ids(filterModern(docs, { topic: 'all', query: 'Welsh MINING', sort: 'popular' }))).toEqual(['b']);
    expect(ids(filterModern(docs, { topic: 'all', query: 'welsh war', sort: 'popular' }))).toEqual([]);
    expect(ids(filterModern(docs, { topic: 'all', query: '  z  ', sort: 'popular' }))).toEqual(['a', 'c']);
  });

  it('sorts four ways and puts undated titles first when oldest', () => {
    expect(ids(filterModern(docs, { topic: 'all', query: '', sort: 'newest' }))).toEqual(['b', 'a', 'c']);
    expect(ids(filterModern(docs, { topic: 'all', query: '', sort: 'oldest' }))).toEqual(['c', 'a', 'b']);
    expect(ids(filterModern(docs, { topic: 'all', query: '', sort: 'title' }))).toEqual(['b', 'c', 'a']);
    expect(ids(filterModern(docs, { topic: 'all', query: '', sort: 'unknown' }))).toEqual(['a', 'b', 'c']);
  });

  it('does not change the input order', () => {
    filterModern(docs, { topic: 'all', query: '', sort: 'title' });
    expect(ids(docs)).toEqual(['a', 'b', 'c']);
  });
});
