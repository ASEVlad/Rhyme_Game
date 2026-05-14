// lib/recent-beats.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadRecentBeats, addRecentBeat } from './recent-beats';

const KEY = 'rhyme.recentBeats';

function stubStorage(initial?: string) {
  const store = new Map<string, string>();
  if (initial !== undefined) store.set(KEY, initial);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  });
  return store;
}

describe('loadRecentBeats', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it('returns [] when localStorage is unavailable (SSR)', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(loadRecentBeats()).toEqual([]);
  });

  it('returns [] when key is missing', () => {
    stubStorage();
    expect(loadRecentBeats()).toEqual([]);
  });

  it('returns the parsed array of strings', () => {
    stubStorage(JSON.stringify(['a', 'b', 'c']));
    expect(loadRecentBeats()).toEqual(['a', 'b', 'c']);
  });

  it('returns [] when JSON is malformed', () => {
    stubStorage('not json');
    expect(loadRecentBeats()).toEqual([]);
  });

  it('returns [] when stored value is not an array', () => {
    stubStorage(JSON.stringify({ a: 1 }));
    expect(loadRecentBeats()).toEqual([]);
  });

  it('drops non-string entries silently', () => {
    stubStorage(JSON.stringify(['a', 42, null, 'b']));
    expect(loadRecentBeats()).toEqual(['a', 'b']);
  });

  it('returns [] when getItem throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('boom'); }, setItem: () => {}, removeItem: () => {} });
    expect(loadRecentBeats()).toEqual([]);
  });
});

describe('addRecentBeat', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it('writes a single-entry array to a fresh store', () => {
    const store = stubStorage();
    addRecentBeat('x');
    expect(JSON.parse(store.get(KEY)!)).toEqual(['x']);
  });

  it('prepends new IDs (most-recent first)', () => {
    const store = stubStorage(JSON.stringify(['a', 'b']));
    addRecentBeat('c');
    expect(JSON.parse(store.get(KEY)!)).toEqual(['c', 'a', 'b']);
  });

  it('deduplicates: existing ID moves to the front', () => {
    const store = stubStorage(JSON.stringify(['a', 'b', 'c']));
    addRecentBeat('b');
    expect(JSON.parse(store.get(KEY)!)).toEqual(['b', 'a', 'c']);
  });

  it('caps at 5 entries', () => {
    const store = stubStorage(JSON.stringify(['a', 'b', 'c', 'd', 'e']));
    addRecentBeat('f');
    expect(JSON.parse(store.get(KEY)!)).toEqual(['f', 'a', 'b', 'c', 'd']);
  });

  it('no-ops silently when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => addRecentBeat('z')).not.toThrow();
  });

  it('no-ops silently when setItem throws (quota)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); },
      removeItem: () => {},
    });
    expect(() => addRecentBeat('z')).not.toThrow();
  });
});
