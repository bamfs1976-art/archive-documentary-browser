// @vitest-environment node
// The build script runs in Node, so test it there
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { MIN_DOCS, USER_AGENT, refreshSnapshot } from '../../scripts/fetch-modern.mjs';
import { IDS_QUERY } from '../../src/services/wikidataQuery.js';

const tempFile = ({ create = false } = {}) => {
  const dir = join(mkdtempSync(join(tmpdir(), 'modern-')), 'data');
  if (create) mkdirSync(dir);
  return join(dir, 'modern.json');
};
const quietLog = () => ({ log: vi.fn(), warn: vi.fn() });
const uri = id => ({ value: `http://www.wikidata.org/entity/${id}` });
const lit = value => ({ value: String(value) });
const ok = body => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ results: { bindings: body } }) });
const OLD = { generatedAt: '2026-01-01T00:00:00.000Z', count: 1, docs: [{ id: 'Q9', title: 'Old' }] };

// A small Wikidata: `count` titles. Q1 is about the Battle of Gettysburg (Q100, part of the American Civil War) and
// made by BBC Four (Q200, part of the BBC). Everything else has no subject.
function fakeWikidata(count, { failOn } = {}) {
  const parents = { Q100: ['Q8676'], Q8676: ['Q198'], Q200: ['Q9531'] };
  return vi.fn(async (url, options) => {
    const query = new URLSearchParams(options.body).get('query');
    if (failOn && query.includes(failOn)) return { ok: false, status: 503, headers: { get: () => null } };
    if (query === IDS_QUERY) {
      return ok(Array.from({ length: count }, (_, i) => ({ film: uri(`Q${i + 1}`), format: lit(i === 0 ? 'series' : 'film'), sitelinks: lit(100 - i) })));
    }
    const ids = [...query.matchAll(/wd:(Q\d+)/g)].map(m => m[1]);
    if (query.includes('?parent')) return ok(ids.flatMap(id => (parents[id] ?? []).map(p => ({ item: uri(id), parent: uri(p) }))));
    if (query.includes('VALUES ?prop')) return ok([]);
    // Details: the VALUES list holds the requested films, returned in a jumbled order
    const films = query.match(/VALUES \?film \{([^}]*)\}/)[1].match(/Q\d+/g).reverse();
    return ok(films.map(id => ({
      film: uri(id), title: lit(`Film ${id}`), released: lit('2001-01-01T00:00:00Z'), links: lit(10),
      subjects: lit(id === 'Q1' ? 'Battle of Gettysburg' : ''), subjectIds: lit(id === 'Q1' ? 'Q100' : ''),
      orgs: lit(id === 'Q1' ? 'Q200' : ''), genres: lit('Q93204'), countries: lit('Q30')
    })));
  });
}

describe('refreshSnapshot', () => {
  it('posts every query with a descriptive User-Agent, starting with the title list', async () => {
    const fetchImpl = fakeWikidata(MIN_DOCS);
    await refreshSnapshot({ fetchImpl, file: tempFile(), log: quietLog(), pauseMs: 0 });
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(2);
    for (const [url, options] of fetchImpl.mock.calls) {
      expect(url).toBe('https://query.wikidata.org/sparql');
      expect(options.method).toBe('POST');
      expect(options.headers['User-Agent']).toBe(USER_AGENT);
    }
    expect(new URLSearchParams(fetchImpl.mock.calls[0][1].body).get('query')).toBe(IDS_QUERY);
  });

  it('writes a slim, tagged snapshot in best-known order', async () => {
    const file = tempFile();
    const result = await refreshSnapshot({ fetchImpl: fakeWikidata(MIN_DOCS), file, log: quietLog(), pauseMs: 0, now: () => new Date('2026-09-25T12:00:00Z') });
    expect(result).toEqual({ updated: true, count: MIN_DOCS });
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    expect(saved.generatedAt).toBe('2026-09-25T12:00:00.000Z');
    expect(saved.docs.map(d => d.id).slice(0, 3)).toEqual(['Q1', 'Q2', 'Q3']);
    expect(saved.docs[0]).toMatchObject({
      id: 'Q1', format: 'series', rank: 0, title: 'Film Q1', year: 2001,
      tags: { topics: ['history'], shortcuts: ['american-civil-war'], makers: ['bbc'] }
    });
    // Raw IDs and rebuildable links stay out of the browser download, and so do empty tags
    for (const key of ['subjectIds', 'orgs', 'genres', 'kind', 'wikidata', 'watch', 'topics']) expect(saved.docs[0]).not.toHaveProperty(key);
    expect(saved.docs[1]).not.toHaveProperty('tags');
  });

  it('keeps the old snapshot and warns when any stage fails', async () => {
    for (const failOn of ['MAX(?links)', 'VALUES ?film', '?parent', 'VALUES ?prop']) {
      const file = tempFile({ create: true });
      writeFileSync(file, JSON.stringify(OLD));
      const log = quietLog();
      const result = await refreshSnapshot({ fetchImpl: fakeWikidata(MIN_DOCS, { failOn }), file, log, pauseMs: 0 });
      expect(result).toEqual({ updated: false, reason: 'Wikidata replied with status 503' });
      expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(OLD);
      expect(log.warn.mock.calls.join(' ')).toContain('Keeping the existing snapshot: 1 titles from 2026-01-01');
    }
  });

  it('keeps the old snapshot when too few titles come back', async () => {
    const file = tempFile({ create: true });
    writeFileSync(file, JSON.stringify(OLD));
    const result = await refreshSnapshot({ fetchImpl: fakeWikidata(MIN_DOCS - 1), file, log: quietLog(), pauseMs: 0 });
    expect(result.updated).toBe(false);
    expect(result.reason).toMatch(/only 199 titles/);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(OLD);
  });

  it('waits and retries when Wikidata asks it to slow down', async () => {
    vi.useFakeTimers();
    try {
      const real = fakeWikidata(MIN_DOCS);
      let limited = false;
      const fetchImpl = vi.fn(async (...args) => {
        if (!limited) { limited = true; return { ok: false, status: 429, headers: { get: name => (name === 'retry-after' ? '2' : null) } }; }
        return real(...args);
      });
      const pending = refreshSnapshot({ fetchImpl, file: tempFile(), log: quietLog(), pauseMs: 0 });
      await vi.advanceTimersByTimeAsync(2000);
      await expect(pending).resolves.toEqual({ updated: true, count: MIN_DOCS });
      expect(fetchImpl.mock.calls[0][1].body).toBe(fetchImpl.mock.calls[1][1].body);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up after the timeout without throwing', async () => {
    const hang = vi.fn((_, { signal }) => new Promise((_, reject) =>
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))));
    const log = quietLog();
    const result = await refreshSnapshot({ fetchImpl: hang, file: tempFile(), log, timeoutMs: 20 });
    expect(result).toEqual({ updated: false, reason: 'no reply within 0.02s' });
    expect(log.warn.mock.calls.join(' ')).toContain('No usable snapshot exists');
  });

  it('survives a network failure with no snapshot at all', async () => {
    const file = tempFile();
    const result = await refreshSnapshot({ fetchImpl: vi.fn().mockRejectedValue(new TypeError('fetch failed')), file, log: quietLog() });
    expect(result).toEqual({ updated: false, reason: 'fetch failed' });
    expect(existsSync(file)).toBe(false);
  });
});
