import { describe, expect, it } from 'vitest';
import { asList, first, listText, safeUrl, shorten, toPlainText } from '../../src/services/text.js';

describe('first and asList', () => {
  it('handle strings, arrays and missing values', () => {
    expect(first(['a', 'b'])).toBe('a');
    expect(first('a')).toBe('a');
    expect(first(undefined)).toBe('');
    expect(first([])).toBe('');
    expect(asList('a')).toEqual(['a']);
    expect(asList(['a', 'b'])).toEqual(['a', 'b']);
    expect(asList(undefined)).toEqual([]);
    expect(asList('')).toEqual([]);
  });
});

describe('toPlainText', () => {
  it('removes tags and collapses whitespace', () => {
    expect(toPlainText('<p>Night <b>Mail</b></p>\n\n<p>1936</p>')).toBe('Night Mail 1936');
  });

  it('decodes entities', () => {
    expect(toPlainText('Fish &amp; chips &lt;3')).toBe('Fish & chips <3');
  });

  it('never runs markup', () => {
    window.__ran = false;
    const text = toPlainText('<img src=x onerror="window.__ran=true"><script>window.__ran=true</script>Safe');
    expect(text).toBe('Safe');
    expect(window.__ran).toBe(false);
  });

  it('returns empty text for empty input', () => {
    expect(toPlainText(null)).toBe('');
    expect(toPlainText('')).toBe('');
  });
});

describe('shorten', () => {
  it('leaves short text alone', () => {
    expect(shorten('Short', 10)).toBe('Short');
  });

  it('cuts at the last space and adds an ellipsis', () => {
    expect(shorten('The quick brown fox jumps', 12)).toBe('The quick…');
  });
});

describe('safeUrl', () => {
  it('keeps https links', () => {
    expect(safeUrl('https://en.wikipedia.org/wiki/Night_Mail')).toBe('https://en.wikipedia.org/wiki/Night_Mail');
  });

  it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'http://example.com', '/relative', '', null])(
    'rejects %j',
    value => expect(safeUrl(value)).toBe('')
  );
});

describe('listText', () => {
  it('joins without a comma before and', () => {
    expect(listText([])).toBe('');
    expect(listText(['BBC'])).toBe('BBC');
    expect(listText(['BBC', 'PBS'])).toBe('BBC and PBS');
    expect(listText(['BBC', 'PBS', 'History channel'])).toBe('BBC, PBS and History channel');
  });
});
