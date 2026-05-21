import { describe, it, expect } from 'vitest';
import { TOPICS, pickRandomTopics } from './topics';

describe('TOPICS', () => {
  it('has exactly 100 entries', () => {
    expect(TOPICS.length).toBe(100);
  });

  it('has no duplicates', () => {
    expect(new Set(TOPICS).size).toBe(TOPICS.length);
  });

  it('every entry is a non-empty string', () => {
    for (const t of TOPICS) {
      expect(typeof t).toBe('string');
      expect(t.length).toBeGreaterThan(0);
    }
  });
});

describe('pickRandomTopics', () => {
  it('returns the requested count', () => {
    expect(pickRandomTopics(5).length).toBe(5);
    expect(pickRandomTopics(1).length).toBe(1);
  });

  it('returns an empty array for n <= 0', () => {
    expect(pickRandomTopics(0)).toEqual([]);
    expect(pickRandomTopics(-3)).toEqual([]);
  });

  it('caps at TOPICS length when n is larger', () => {
    expect(pickRandomTopics(1000).length).toBe(TOPICS.length);
  });

  it('returns only items from the pool', () => {
    const sample = pickRandomTopics(15);
    for (const t of sample) {
      expect(TOPICS).toContain(t);
    }
  });

  it('returns no duplicates within a single call', () => {
    const sample = pickRandomTopics(20);
    expect(new Set(sample).size).toBe(sample.length);
  });

  it('does not always return the same items (samples differ across calls)', () => {
    // 5 calls of 5 items each; the union should very likely exceed 5.
    const union = new Set<string>();
    for (let i = 0; i < 5; i++) {
      for (const t of pickRandomTopics(5)) union.add(t);
    }
    expect(union.size).toBeGreaterThan(5);
  });
});
