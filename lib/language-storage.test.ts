import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadLanguage, saveLanguage } from './language-storage';

const STORAGE_KEY = 'rhyme-language';

function setupBrowser({ language, stored }: { language?: string; stored?: string | null } = {}) {
  const store = new Map<string, string>();
  if (stored !== undefined && stored !== null) store.set(STORAGE_KEY, stored);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  });
  vi.stubGlobal('navigator', { language: language ?? 'en-US' });
  return store;
}

describe('loadLanguage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the stored value when valid', () => {
    setupBrowser({ stored: 'es' });
    expect(loadLanguage()).toBe('es');
  });

  it('ignores an invalid stored value and sniffs navigator.language', () => {
    setupBrowser({ stored: 'ru', language: 'de-AT' });
    expect(loadLanguage()).toBe('de');
  });

  it('sniffs navigator.language when nothing is stored', () => {
    setupBrowser({ language: 'pl-PL' });
    expect(loadLanguage()).toBe('pl');
  });

  it('lowercases and prefix-matches navigator.language', () => {
    setupBrowser({ language: 'EN-GB' });
    expect(loadLanguage()).toBe('en');
  });

  it('defaults to uk when navigator.language is unsupported', () => {
    setupBrowser({ language: 'ja-JP' });
    expect(loadLanguage()).toBe('uk');
  });

  it('defaults to uk when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    vi.stubGlobal('navigator', undefined);
    expect(loadLanguage()).toBe('uk');
  });
});

describe('saveLanguage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes to localStorage', () => {
    const store = setupBrowser();
    saveLanguage('pl');
    expect(store.get(STORAGE_KEY)).toBe('pl');
  });

  it('silently no-ops when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => saveLanguage('en')).not.toThrow();
  });
});
