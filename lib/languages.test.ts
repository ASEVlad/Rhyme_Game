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
      const prompt = l.promptTemplate(7, l.themes[0]);
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

describe('Language theme pool', () => {
  it('every language has at least 12 themes', () => {
    for (const lang of LANGUAGES) {
      expect(lang.themes.length).toBeGreaterThanOrEqual(12);
    }
  });

  it('themes are non-empty strings', () => {
    for (const lang of LANGUAGES) {
      for (const t of lang.themes) {
        expect(typeof t).toBe('string');
        expect(t.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('promptTemplate with theme and exclusions', () => {
  it('includes the theme in the uk prompt', () => {
    const lang = getLanguage('uk');
    const p = lang.promptTemplate(10, 'природа');
    expect(p).toContain('природа');
  });

  it('includes the theme in the en prompt', () => {
    const lang = getLanguage('en');
    const p = lang.promptTemplate(10, 'nature');
    expect(p).toContain('nature');
  });

  it('appends excluded words when provided', () => {
    const lang = getLanguage('uk');
    const p = lang.promptTemplate(10, 'природа', { words: ['кіт', 'хата'], endings: [] });
    expect(p).toContain('кіт');
    expect(p).toContain('хата');
  });

  it('appends excluded endings when provided', () => {
    const lang = getLanguage('en');
    const p = lang.promptTemplate(5, 'nature', { words: [], endings: ['-ay', '-ight'] });
    expect(p).toContain('-ay');
    expect(p).toContain('-ight');
  });

  it('does not add exclusion text when lists are empty', () => {
    const lang = getLanguage('en');
    const noExclude = lang.promptTemplate(5, 'nature');
    const emptyExclude = lang.promptTemplate(5, 'nature', { words: [], endings: [] });
    expect(noExclude).toBe(emptyExclude);
  });

  it('uses exact word count when wordsPerGroup is provided', () => {
    const lang = getLanguage('en');
    const p = lang.promptTemplate(5, 'nature', undefined, undefined, 4);
    expect(p).toContain('Each group must have exactly 4 words.');
    expect(p).not.toContain('3–4 words');
  });

  it('uses native fallback group-size text when wordsPerGroup is null', () => {
    const lang = getLanguage('en');
    const p = lang.promptTemplate(5, 'nature', undefined, undefined, null);
    expect(p).toContain('3–4 words per group.');
  });

  it('injects difficultyHint as English vocabulary label', () => {
    const lang = getLanguage('uk');
    const p = lang.promptTemplate(5, 'природа', undefined, 'B2');
    expect(p).toContain('Vocabulary level: B2.');
    expect(p).not.toContain('підліток');
  });

  it('uses native fallback vocab text when difficultyHint is absent', () => {
    const lang = getLanguage('de');
    const p = lang.promptTemplate(5, 'Natur');
    expect(p).toContain('Jugendlicher');
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
