import { describe, expect, it } from 'vitest';
import { DEFAULTS, buildSearch, isValidDocId, parseUrl } from '../../src/services/url.js';

describe('parseUrl', () => {
  it('returns the defaults for an empty address', () => {
    expect(parseUrl('')).toEqual(DEFAULTS);
  });

  it('reads every setting', () => {
    expect(parseUrl('?collection=modern&topic=history&sort=newest&q=coal+mining&doc=Q42')).toEqual({
      collection: 'modern', topic: 'history', sort: 'newest', q: 'coal mining', doc: 'Q42'
    });
  });

  it('falls back to defaults for unknown values', () => {
    expect(parseUrl('?collection=films&topic=cats&sort=random')).toEqual(DEFAULTS);
  });

  it('checks the documentary id against the collection', () => {
    expect(parseUrl('?doc=Night_Mail-1936.v2').doc).toBe('Night_Mail-1936.v2');
    expect(parseUrl('?doc=Q42').doc).toBe('Q42');
    expect(parseUrl('?collection=modern&doc=Night_Mail').doc).toBe('');
    expect(parseUrl('?doc=bad" OR mediatype:texts').doc).toBe('');
    expect(parseUrl(`?doc=${'a'.repeat(101)}`).doc).toBe('');
  });

  it('trims the search and caps its length', () => {
    expect(parseUrl('?q=++coal++').q).toBe('coal');
    expect(parseUrl(`?q=${'x'.repeat(300)}`).q).toHaveLength(200);
  });
});

describe('buildSearch', () => {
  it('leaves defaults out, so the home page has a clean address', () => {
    expect(buildSearch(DEFAULTS)).toBe('');
    expect(buildSearch({ ...DEFAULTS, topic: 'britain' })).toBe('?topic=britain');
  });

  it('writes settings in a fixed order and encodes the search', () => {
    expect(buildSearch({ collection: 'modern', topic: 'society', sort: 'title', q: 'fish & chips', doc: 'Q1' }))
      .toBe('?collection=modern&topic=society&sort=title&q=fish+%26+chips&doc=Q1');
  });

  it('round-trips through parseUrl', () => {
    const state = { collection: 'modern', topic: 'history', sort: 'oldest', q: 'Aberfan', doc: 'Q7' };
    expect(parseUrl(buildSearch(state))).toEqual(state);
  });
});

describe('isValidDocId', () => {
  it('knows each collection\'s id format', () => {
    expect(isValidDocId('archive', 'AboutBan1935')).toBe(true);
    expect(isValidDocId('modern', 'Q206388')).toBe(true);
    expect(isValidDocId('modern', 'AboutBan1935')).toBe(false);
    expect(isValidDocId('other', 'Q1')).toBe(false);
  });
});
