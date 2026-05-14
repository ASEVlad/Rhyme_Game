import { describe, it, expect } from 'vitest';
import { LANGUAGES, DEFAULT_LANGUAGE, getLanguage, type LanguageId } from './languages';

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
