import { afterEach, describe, expect, it, vi } from 'vitest';
import { readCache, writeCache } from '../../src/services/storage.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  window.localStorage.clear();
});

describe('storage', () => {
  it('reads back what it wrote while fresh', () => {
    writeCache('k1', { a: 1 });
    expect(readCache('k1', 1000)).toEqual({ a: 1 });
  });

  it('returns null once the entry is too old', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    writeCache('k2', 'x');
    vi.setSystemTime(1000);
    expect(readCache('k2', 1000)).toBeNull();
    expect(readCache('k2', 1001)).toBe('x');
  });

  it('returns null for a missing or corrupt entry', () => {
    expect(readCache('missing', 1000)).toBeNull();
    window.localStorage.setItem('bad', '{not json');
    expect(readCache('bad', 1000)).toBeNull();
  });

  it('falls back to memory when localStorage throws', () => {
    const blocked = () => { throw new Error('blocked'); };
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    expect(() => writeCache('k3', [1, 2])).not.toThrow();
    expect(readCache('k3', 1000)).toEqual([1, 2]);
  });
});
