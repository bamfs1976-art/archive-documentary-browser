import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/modern.json', () => ({
  default: {
    generatedAt: '2026-09-25T00:00:00.000Z',
    count: 1,
    docs: [{ kind: 'modern', id: 'Q1', rank: 0, title: 'Swansea Story', year: 2010, director: '', description: 'a film', minutes: 90, subjects: [], countries: [], wikipedia: '', topics: ['history'] }]
  }
}));

const { fetchModernDocs } = await import('../../src/services/wikidata.js');

afterEach(() => vi.unstubAllGlobals());

describe('snapshot', () => {
  it('serves the snapshot without calling Wikidata and reclassifies topics', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const docs = await fetchModernDocs();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(docs).toHaveLength(1);
    expect(docs[0].topics).toEqual(['britain']);
  });

  it('rebuilds the links the snapshot leaves out', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const [doc] = await fetchModernDocs();
    expect(doc).toMatchObject({
      kind: 'modern',
      wikidata: 'https://www.wikidata.org/wiki/Q1',
      watch: 'https://www.justwatch.com/uk/search?q=Swansea%20Story',
      shortcuts: [],
      makers: []
    });
  });

  it('skips the snapshot when asked for fresh data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: { bindings: [] } }) });
    vi.stubGlobal('fetch', fetchMock);
    await fetchModernDocs({ fresh: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
