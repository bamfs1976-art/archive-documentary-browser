import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildQuery, fetchArchiveDoc, fetchArchiveDocs, parseRuntime, PAGE_SIZE } from '../../src/services/archive.js';

describe('buildQuery', () => {
  it('limits results to movies from the named collections', () => {
    const q = buildQuery({});
    expect(q).toMatch(/^mediatype:movies AND \(collection:\(prelinger OR universal_newsreels\)/);
    expect(q).toContain('AND NOT collection:(movie_trailers_unsorted OR stock_footage');
  });

  it('never trusts News & Public Affairs as a whole', () => {
    expect(buildQuery({})).not.toContain('newsandpublicaffairs');
  });

  it('shuts out militant videos, community TV and lectures', () => {
    const q = buildQuery({});
    for (const c of ['iraq_war', 'iraq_middleeast', 'community_media', 'royal_society_arts']) expect(q).toContain(c);
    expect(q).toContain('AND NOT title:("home movie" OR "home movies" OR "television commercials"');
  });

  it('adds no topic clause for all topics or an unknown topic', () => {
    expect(buildQuery({ topic: 'all' })).toBe(buildQuery({}));
    expect(buildQuery({ topic: 'nonsense' })).toBe(buildQuery({}));
  });

  it('adds the subject clause for each topic', () => {
    expect(buildQuery({ topic: 'history' })).toContain('subject:(war OR history');
    expect(buildQuery({ topic: 'society' })).toContain('subject:(society OR social');
    expect(buildQuery({ topic: 'britain' })).toContain('title:(wales OR welsh');
  });

  it('keeps German wartime newsreels out of Wales and Britain only', () => {
    expect(buildQuery({ topic: 'britain' })).toContain('AND NOT title:(wochenschau OR "ufa-tonwoche")');
    expect(buildQuery({ topic: 'history' })).not.toContain('wochenschau');
  });

  it('joins search words with AND across title, subject and description', () => {
    expect(buildQuery({ query: 'coal mining' })).toContain(
      ' AND (title:(coal AND mining) OR subject:(coal AND mining) OR description:(coal AND mining))'
    );
  });

  it('strips Lucene syntax from typed text', () => {
    const q = buildQuery({ query: 'title:(x) OR "y" -z* ~a^2 [b TO c] {d} a/b & c | d \\ e ! f ?' });
    const clause = q.slice(buildQuery({}).length);
    expect(clause).not.toMatch(/title:\(x|"|\*|~|\^|\[|\]|\{|\}|\\|!|\?|&|\|/);
  });

  it('caps search at eight words', () => {
    const q = buildQuery({ query: 'one two three four five six seven eight nine ten' });
    expect(q).toContain('title:(one AND two AND three AND four AND five AND six AND seven AND eight)');
    expect(q).not.toContain('nine');
  });

  it('ignores a search of only symbols', () => {
    expect(buildQuery({ query: '*** ??? ""' })).toBe(buildQuery({}));
  });
});

describe('parseRuntime', () => {
  it.each([
    ['01:12:30', 72],
    ['0:45:00', 45],
    ['72:10', 72],
    ['9:59', 9],
    ['72 minutes', 72],
    ['72', 72],
    ['12.6 min', 13],
    [['58:00', '59:00'], 58],
    [' 30:00 ', 30]
  ])('reads %j as %i minutes', (input, minutes) => {
    expect(parseRuntime(input)).toBe(minutes);
  });

  it.each([undefined, null, '', 'unknown', 'approx. 20 min'])('returns null for %j', input => {
    expect(parseRuntime(input)).toBeNull();
  });
});

describe('fetchArchiveDocs', () => {
  afterEach(() => vi.unstubAllGlobals());

  const reply = body => vi.fn().mockResolvedValue({ ok: true, json: async () => body });

  it('sends the query, fields, sort and paging', async () => {
    const fetchMock = reply({ response: { numFound: 0, docs: [] } });
    vi.stubGlobal('fetch', fetchMock);
    await fetchArchiveDocs({ topic: 'history', sort: 'oldest', query: '', page: 3 });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe('https://archive.org/advancedsearch.php');
    expect(url.searchParams.get('q')).toBe(buildQuery({ topic: 'history' }));
    expect(url.searchParams.getAll('fl[]')).toContain('runtime');
    expect(url.searchParams.get('sort[]')).toBe('year asc');
    expect(url.searchParams.get('rows')).toBe(String(PAGE_SIZE));
    expect(url.searchParams.get('page')).toBe('3');
    expect(url.searchParams.get('output')).toBe('json');
  });

  it('falls back to most watched for an unknown sort', async () => {
    const fetchMock = reply({ response: { numFound: 0, docs: [] } });
    vi.stubGlobal('fetch', fetchMock);
    await fetchArchiveDocs({ topic: 'all', sort: 'bogus', query: '', page: 1 });
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('sort[]')).toBe('downloads desc');
  });

  it('turns raw records into plain-text docs', async () => {
    vi.stubGlobal('fetch', reply({
      response: {
        numFound: 2,
        docs: [
          {
            identifier: 'Coal Face 1935',
            title: ['<b>Coal Face</b>'],
            year: '1935',
            description: '<p>A film about <script>alert(1)</script>miners.</p>',
            subject: ['documentary', 'mining'],
            creator: 'GPO Film Unit',
            runtime: '00:11:30'
          },
          { title: 'No identifier, so dropped' }
        ]
      }
    }));
    const { items, total } = await fetchArchiveDocs({ topic: 'all', sort: 'popular', query: '', page: 1 });
    expect(total).toBe(2);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'archive',
      id: 'Coal Face 1935',
      title: 'Coal Face',
      year: 1935,
      creator: 'GPO Film Unit',
      description: 'A film about miners.',
      subjects: ['documentary', 'mining'],
      minutes: 11,
      thumb: 'https://archive.org/services/img/Coal%20Face%201935',
      embed: 'https://archive.org/embed/Coal%20Face%201935',
      page: 'https://archive.org/details/Coal%20Face%201935'
    });
  });

  it('uses the identifier when the title is missing and null for a bad year', async () => {
    vi.stubGlobal('fetch', reply({ response: { numFound: 1, docs: [{ identifier: 'abc', year: 'n.d.' }] } }));
    const { items } = await fetchArchiveDocs({ topic: 'all', sort: 'popular', query: '', page: 1 });
    expect(items[0]).toMatchObject({ title: 'abc', year: null, minutes: null, subjects: [] });
  });

  it('throws on an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchArchiveDocs({ topic: 'all', sort: 'popular', query: '', page: 1 }))
      .rejects.toThrow('Archive.org replied with status 503');
  });
});

describe('fetchArchiveDoc', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('looks the film up inside the trusted query only', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: { docs: [{ identifier: 'Night_Mail', title: 'Night Mail' }] } }) });
    vi.stubGlobal('fetch', fetchMock);
    const doc = await fetchArchiveDoc('Night_Mail');
    const q = new URL(fetchMock.mock.calls[0][0]).searchParams.get('q');
    expect(q).toBe(`(${buildQuery({})}) AND identifier:"Night_Mail"`);
    expect(doc).toMatchObject({ id: 'Night_Mail', title: 'Night Mail' });
  });

  it('returns null when the trusted query does not hold the film', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: { docs: [] } }) }));
    expect(await fetchArchiveDoc('some_militant_video')).toBeNull();
  });

  it('refuses malformed ids without calling Archive.org', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchArchiveDoc('x" OR mediatype:texts')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
