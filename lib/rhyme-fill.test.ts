import { describe, it, expect } from 'vitest';
import { computeRhymeFillPlan } from './rhyme-fill';

describe('computeRhymeFillPlan', () => {
  it('computes targetBars from duration, bpm, startOffset', () => {
    // 180s at 90bpm with 0 offset: 180 * 90 / 240 = 67.5 → 67 bars
    const plan = computeRhymeFillPlan({ duration: 180, bpm: 90, startOffset: 0, wordsPerGroup: null });
    expect(plan.targetBars).toBe(67);
  });

  it('subtracts startOffset before computing bars', () => {
    // (180 - 4)s at 90bpm: 176 * 90 / 240 = 66 bars
    const plan = computeRhymeFillPlan({ duration: 180, bpm: 90, startOffset: 4, wordsPerGroup: null });
    expect(plan.targetBars).toBe(66);
  });

  it('uses wordsPerGroup=2 for free scheme (null) — conservative under-estimate', () => {
    // 67 targetBars / 2 minWords = 34 groups
    const plan = computeRhymeFillPlan({ duration: 180, bpm: 90, startOffset: 0, wordsPerGroup: null });
    expect(plan.count).toBe(34);
  });

  it('uses scheme.wordsPerGroup when set (couplets = 2)', () => {
    // 67 / 2 = 34
    const plan = computeRhymeFillPlan({ duration: 180, bpm: 90, startOffset: 0, wordsPerGroup: 2 });
    expect(plan.count).toBe(34);
  });

  it('uses scheme.wordsPerGroup when set (bar4 = 4)', () => {
    // 67 / 4 = 17 (ceil)
    const plan = computeRhymeFillPlan({ duration: 180, bpm: 90, startOffset: 0, wordsPerGroup: 4 });
    expect(plan.count).toBe(17);
  });

  it('clamps count to the 4..40 range', () => {
    // tiny song
    expect(computeRhymeFillPlan({ duration: 10, bpm: 90, startOffset: 0, wordsPerGroup: null }).count).toBe(4);
    // huge song
    expect(computeRhymeFillPlan({ duration: 2000, bpm: 120, startOffset: 0, wordsPerGroup: 2 }).count).toBe(40);
  });

  it('returns 0 targetBars (not negative) when startOffset >= duration', () => {
    const plan = computeRhymeFillPlan({ duration: 5, bpm: 90, startOffset: 10, wordsPerGroup: null });
    expect(plan.targetBars).toBe(0);
  });
});
