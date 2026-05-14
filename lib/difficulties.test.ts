import { describe, it, expect } from 'vitest';
import { getDifficulty, DEFAULT_DIFFICULTY, DIFFICULTIES } from './difficulties';

describe('getDifficulty', () => {
  it('returns the default difficulty for null', () => {
    expect(getDifficulty(null).id).toBe(DEFAULT_DIFFICULTY);
  });

  it('returns the default difficulty for undefined', () => {
    expect(getDifficulty(undefined).id).toBe(DEFAULT_DIFFICULTY);
  });

  it('returns the default difficulty for an unknown id', () => {
    expect(getDifficulty('legendary').id).toBe(DEFAULT_DIFFICULTY);
  });

  it('returns the correct difficulty for each valid id', () => {
    for (const d of DIFFICULTIES) {
      expect(getDifficulty(d.id).id).toBe(d.id);
    }
  });

  it('default difficulty is beginner', () => {
    expect(DEFAULT_DIFFICULTY).toBe('beginner');
  });
});
