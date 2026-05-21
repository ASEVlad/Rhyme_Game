import { describe, it, expect } from 'vitest';
import {
  getRhymeScheme,
  DEFAULT_SCHEME,
  RHYME_SCHEMES,
  nonEmptySlotsPerBlock,
  rhymeFamiliesInScheme,
} from './rhyme-schemes';

describe('getRhymeScheme', () => {
  it('returns the default scheme for null/undefined/unknown', () => {
    expect(getRhymeScheme(null).id).toBe(DEFAULT_SCHEME);
    expect(getRhymeScheme(undefined).id).toBe(DEFAULT_SCHEME);
    expect(getRhymeScheme('haiku').id).toBe(DEFAULT_SCHEME);
    expect(getRhymeScheme('free').id).toBe(DEFAULT_SCHEME);
  });

  it('returns the correct scheme for each valid id', () => {
    for (const s of RHYME_SCHEMES) {
      expect(getRhymeScheme(s.id).id).toBe(s.id);
    }
  });

  it('default scheme is AABB', () => {
    expect(DEFAULT_SCHEME).toBe('AABB');
  });
});

describe('RHYME_SCHEMES', () => {
  it('exposes the 7 expected ids', () => {
    expect(RHYME_SCHEMES.map(s => s.id)).toEqual([
      'AABB', 'ABAB', 'ABBA', 'AAAA', 'AAXX', 'AXAX', 'AXXA',
    ]);
  });

  it('every scheme has a 4-character pattern over {A,B,X}', () => {
    for (const s of RHYME_SCHEMES) {
      expect(s.pattern.length).toBe(4);
      for (const ch of s.pattern) {
        expect(['A', 'B', 'X']).toContain(ch);
      }
    }
  });

  it('label matches pattern (for compactness)', () => {
    for (const s of RHYME_SCHEMES) {
      expect(s.label).toBe(s.pattern);
    }
  });
});

describe('nonEmptySlotsPerBlock', () => {
  it('counts non-X chars in pattern', () => {
    expect(nonEmptySlotsPerBlock(getRhymeScheme('AAAA'))).toBe(4);
    expect(nonEmptySlotsPerBlock(getRhymeScheme('AABB'))).toBe(4);
    expect(nonEmptySlotsPerBlock(getRhymeScheme('AAXX'))).toBe(2);
    expect(nonEmptySlotsPerBlock(getRhymeScheme('AXAX'))).toBe(2);
    expect(nonEmptySlotsPerBlock(getRhymeScheme('AXXA'))).toBe(2);
  });
});

describe('rhymeFamiliesInScheme', () => {
  it('returns sorted distinct non-X letters', () => {
    expect(rhymeFamiliesInScheme(getRhymeScheme('AAAA'))).toEqual(['A']);
    expect(rhymeFamiliesInScheme(getRhymeScheme('AABB'))).toEqual(['A', 'B']);
    expect(rhymeFamiliesInScheme(getRhymeScheme('AXAX'))).toEqual(['A']);
    expect(rhymeFamiliesInScheme(getRhymeScheme('ABBA'))).toEqual(['A', 'B']);
  });
});
