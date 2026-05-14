import { describe, it, expect } from 'vitest';
import { LANGUAGES, DEFAULT_LANGUAGE, getLanguage, type LanguageId } from './languages';
import { FALLBACK_GROUPS_BY_LANGUAGE } from './fallback-groups';

const EXPECTED_IDS: LanguageId[] = ['uk', 'en', 'es', 'de', 'pl'];

describe('LANGUAGES', () => {
  it('contains all five supported languages in a stable order', () => {
    expect(LANGUAGES.map(l => l.id)).toEqual(EXPECTED_IDS);
  });

  it('each entry has a non-empty native label and a prompt template', () => {
    for (const l of LANGUAGES) {
      expect(l.label.length).toBeGreaterThan(0);
      expect(typeof l.promptTemplate).toBe('function');
      const prompt = l.promptTemplate(7);
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toContain('7');
    }
  });
});

describe('DEFAULT_LANGUAGE', () => {
  it('is uk', () => {
    expect(DEFAULT_LANGUAGE).toBe('uk');
  });
});

describe('getLanguage', () => {
  it('returns the matching language for a known id', () => {
    expect(getLanguage('en').id).toBe('en');
    expect(getLanguage('pl').id).toBe('pl');
  });

  it('falls back to uk for null, undefined, empty, or unknown ids', () => {
    expect(getLanguage(null).id).toBe('uk');
    expect(getLanguage(undefined).id).toBe('uk');
    expect(getLanguage('').id).toBe('uk');
    expect(getLanguage('ru').id).toBe('uk');
    expect(getLanguage('xx-YY').id).toBe('uk');
  });
});

describe('FALLBACK_GROUPS_BY_LANGUAGE', () => {
  it('has an entry for every supported language', () => {
    for (const id of EXPECTED_IDS) {
      expect(FALLBACK_GROUPS_BY_LANGUAGE[id]).toBeDefined();
    }
  });

  it('each language has at least 10 fallback groups', () => {
    for (const id of EXPECTED_IDS) {
      expect(FALLBACK_GROUPS_BY_LANGUAGE[id].length).toBeGreaterThanOrEqual(10);
    }
  });

  it('every group has a non-empty ending and at least 2 words', () => {
    for (const id of EXPECTED_IDS) {
      for (const group of FALLBACK_GROUPS_BY_LANGUAGE[id]) {
        expect(group.ending.length).toBeGreaterThan(0);
        expect(group.words.length).toBeGreaterThanOrEqual(2);
        for (const word of group.words) {
          expect(typeof word).toBe('string');
          expect(word.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
