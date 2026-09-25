// @vitest-environment node
// The build script runs in Node, so test it there
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { MIN_DOCS, USER_AGENT, refreshSnapshot } from '../../scripts/fetch-modern.mjs';
import { QUERY } from '../../src/services/wikidataQuery.js';

const tempFile = () => join(mkdtempSync(join(tmpdir(), 'modern-')), 'data', 'modern.json');
const quietLog = () => ({ log: vi.fn(), warn: vi.fn() });
const bindings = n => Array.from({ length: n }, (_, i) => ({
  film: { value: `http://www.wikidata.org/entity/Q${i + 1}` },
  title: { value: `Film ${i + 1}` },
  released: { value: '2001-01-01T00:00:00Z' },
  countries: { value: 'Q25' }
}));
const reply = n => vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: { bindings: bindings(n) } }) });
const OLD = { generatedAt: '2026-01-01T00:00:00.000Z', count: 1, docs: [{ id: 'Q9', title: 'Old' }] };

describe('refreshSnapshot', () => {
  it('posts the shared query with a descriptive User-Agent', async () => {
    const fetchImpl = reply(MIN_DOCS);
    await refreshSnapshot({ fetchImpl, file: tempFile(), log: quietLog() });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://query.wikidata.org/sparql');
    expect(options.method).toBe('POST');
    expect(options.headers['User-Agent']).toBe(USER_AGENT);
    expect(new URLSearchParams(options.body).get('query')).toBe(QUERY);
  });

  it('writes a snapshot without topics, creating the folder', async () => {
    const file = tempFile();
    const log = quietLog();
    const result = await refreshSnapshot({ fetchImpl: reply(MIN_DOCS), file, log, now: () => new Date('2026-09-24T12:00:00Z') });
    expect(result).toEqual({ updated: true, count: MIN_DOCS });
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    expect(saved.generatedAt).toBe('2026-09-24T12:00:00.000Z');
    expect(saved.count).toBe(MIN_DOCS);
    expect(saved.docs[0]).toMatchObject({ id: 'Q1', title: 'Film 1', year: 2001, countries: ['Q25'] });
    expect(saved.docs[0]).not.toHaveProperty('topics');
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('keeps the old snapshot and warns when Wikidata errors', async () => {
    const file = tempFile();
    await refreshSnapshot({ fetchImpl: reply(MIN_DOCS), file, log: quietLog() });
    writeFileSync(file, JSON.stringify(OLD));
    const log = quietLog();
    const result = await refreshSnapshot({ fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 503 }), file, log });
    expect(result).toEqual({ updated: false, reason: 'Wikidata replied with status 503' });
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(OLD);
    expect(log.warn.mock.calls.join(' ')).toContain('Keeping the existing snapshot: 1 titles from 2026-01-01');
  });

  it('keeps the old snapshot when too few titles come back', async () => {
    const file = tempFile();
    await refreshSnapshot({ fetchImpl: reply(MIN_DOCS), file, log: quietLog() });
    writeFileSync(file, JSON.stringify(OLD));
    const result = await refreshSnapshot({ fetchImpl: reply(MIN_DOCS - 1), file, log: quietLog() });
    expect(result.updated).toBe(false);
    expect(result.reason).toMatch(/only 199 titles/);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(OLD);
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
