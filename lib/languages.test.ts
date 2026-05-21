import { describe, it, expect } from 'vitest';
import { LANGUAGES, DEFAULT_LANGUAGE, getLanguage, type LanguageId } from './languages';
import { FALLBACK_GROUPS_BY_LANGUAGE } from './fallback-groups';
import { TOPICS } from './topics';
import { getRhymeScheme } from './rhyme-schemes';

const EXPECTED_IDS: LanguageId[] = ['uk', 'en', 'es', 'de', 'pl'];

describe('LANGUAGES', () => {
  it('contains all five supported languages in a stable order', () => {
    expect(LANGUAGES.map(l => l.id)).toEqual(EXPECTED_IDS);
  });

  it('each entry has a non-empty native label and a prompt template', () => {
    const scheme = getRhymeScheme('AABB');
    for (const l of LANGUAGES) {
      expect(l.label.length).toBeGreaterThan(0);
      expect(typeof l.promptTemplate).toBe('function');
      const prompt = l.promptTemplate(7, l.themes[0], undefined, undefined, scheme);
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

describe('promptTemplate (shared rap-game prompt across all languages)', () => {
  const scheme = getRhymeScheme('AABB');

  it('every language samples 10 or 11 random topics from the pool', () => {
    for (const l of LANGUAGES) {
      const p = l.promptTemplate(10, l.themes[0], undefined, undefined, scheme);
      const match = /Theme:\s*([^\n]+)/.exec(p);
      expect(match).not.toBeNull();
      const themes = match![1].split(',').map(s => s.trim());
      expect(themes.length).toBeGreaterThanOrEqual(10);
      expect(themes.length).toBeLessThanOrEqual(11);
      for (const t of themes) {
        expect(TOPICS).toContain(t);
      }
    }
  });

  it('embeds the canonical English language name in the prompt', () => {
    const cases: Array<[LanguageId, string]> = [
      ['uk', 'Ukrainian'],
      ['en', 'English'],
      ['es', 'Spanish'],
      ['de', 'German'],
      ['pl', 'Polish'],
    ];
    for (const [id, name] of cases) {
      const p = getLanguage(id).promptTemplate(5, '', undefined, undefined, scheme);
      expect(p).toContain(`Language: ${name}`);
    }
  });

  it('appends excluded words and endings when provided', () => {
    const lang = getLanguage('en');
    const p = lang.promptTemplate(
      5,
      '',
      { words: ['cat', 'bat'], endings: ['-at'] },
      undefined,
      scheme,
    );
    expect(p).toContain('cat');
    expect(p).toContain('bat');
    expect(p).toContain('-at');
  });

  it('does not add exclusion text when lists are empty', () => {
    const lang = getLanguage('en');
    const noExclude = lang.promptTemplate(5, '', undefined, undefined, scheme);
    const emptyExclude = lang.promptTemplate(5, '', { words: [], endings: [] }, undefined, scheme);
    expect(noExclude).not.toContain('Do not use');
    expect(emptyExclude).not.toContain('Do not use');
  });

  it('embeds the scheme pattern', () => {
    const lang = getLanguage('de');
    const p = lang.promptTemplate(5, '', undefined, undefined, getRhymeScheme('ABBA'));
    expect(p).toContain('ABBA');
  });

  it('renders Difficulty: <level> based on the hint, for any language', () => {
    for (const l of LANGUAGES) {
      expect(l.promptTemplate(5, '', undefined, 'very common words a young child would know', scheme))
        .toContain('Difficulty: easy');
      expect(l.promptTemplate(5, '', undefined, 'common words a teenager would recognize', scheme))
        .toContain('Difficulty: medium');
      expect(l.promptTemplate(5, '', undefined, 'expressive, less common vocabulary', scheme))
        .toContain('Difficulty: hard');
      expect(l.promptTemplate(5, '', undefined, 'rare, abstract, or sophisticated vocabulary', scheme))
        .toContain('Difficulty: hard');
    }
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
