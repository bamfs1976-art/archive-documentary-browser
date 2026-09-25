import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/blocklist.json', () => ({
  default: [
    { id: 'junk-upload_1.2', reason: 'modern TV upload' },
    { id: 'bad) OR (mediatype:texts', reason: 'hostile id, must be escaped' },
    { reason: 'missing id is ignored' }
  ]
}));

const { buildQuery } = await import('../../src/services/archive.js');

describe('blocklist', () => {
  it('hides listed identifiers with Lucene syntax stripped', () => {
    expect(buildQuery({})).toContain(' AND NOT identifier:(junk-upload_1.2 OR badORmediatypetexts)');
  });
});
