import { describe, it, expect } from 'vitest';
import { getRhymeScheme, DEFAULT_SCHEME, RHYME_SCHEMES } from './rhyme-schemes';

describe('getRhymeScheme', () => {
  it('returns the default scheme for null', () => {
    expect(getRhymeScheme(null).id).toBe(DEFAULT_SCHEME);
  });

  it('returns the default scheme for undefined', () => {
    expect(getRhymeScheme(undefined).id).toBe(DEFAULT_SCHEME);
  });

  it('returns the default scheme for an unknown id', () => {
    expect(getRhymeScheme('haiku').id).toBe(DEFAULT_SCHEME);
  });

  it('returns the correct scheme for each valid id', () => {
    for (const s of RHYME_SCHEMES) {
      expect(getRhymeScheme(s.id).id).toBe(s.id);
    }
  });

  it('default scheme is free', () => {
    expect(DEFAULT_SCHEME).toBe('free');
  });

  it('alternating scheme has interleave: true', () => {
    expect(getRhymeScheme('alternating').interleave).toBe(true);
  });

  it('non-alternating schemes have interleave: false', () => {
    expect(getRhymeScheme('free').interleave).toBe(false);
    expect(getRhymeScheme('couplets').interleave).toBe(false);
    expect(getRhymeScheme('bar4').interleave).toBe(false);
  });
});
