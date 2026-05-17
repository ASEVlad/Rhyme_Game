import { describe, it, expect } from 'vitest';
import { computeRhymeFillPlan } from './rhyme-fill';

describe('computeRhymeFillPlan', () => {
  it('computes targetBars from playable duration', () => {
    // 60s at 90bpm with 0 offset: 60 * 90 / 240 = 22.5 → 22 bars
    const plan = computeRhymeFillPlan({ duration: 60, bpm: 90, startOffset: 0, wordsPerGroup: null });
    expect(plan.targetBars).toBe(22);
  });

  it('subtracts startOffset before computing bars', () => {
    // (60 - 4)s at 90bpm: 56 * 90 / 240 = 21 bars
    const plan = computeRhymeFillPlan({ duration: 60, bpm: 90, startOffset: 4, wordsPerGroup: null });
    expect(plan.targetBars).toBe(21);
  });

  it('uses wordsPerGroup=2 for free scheme (null) — conservative under-estimate', () => {
    // 22 targetBars / 2 minWords = 11 groups
    const plan = computeRhymeFillPlan({ duration: 60, bpm: 90, startOffset: 0, wordsPerGroup: null });
    expect(plan.count).toBe(11);
  });

  it('uses scheme.wordsPerGroup when set (couplets = 2)', () => {
    const plan = computeRhymeFillPlan({ duration: 60, bpm: 90, startOffset: 0, wordsPerGroup: 2 });
    expect(plan.count).toBe(11);
  });

  it('uses scheme.wordsPerGroup when set (bar4 = 4)', () => {
    // ceil(22 / 4) = 6
    const plan = computeRhymeFillPlan({ duration: 60, bpm: 90, startOffset: 0, wordsPerGroup: 4 });
    expect(plan.count).toBe(6);
  });

  it('clamps count to the 4..40 range', () => {
    // tiny song → MIN_GROUPS floor
    expect(
      computeRhymeFillPlan({ duration: 10, bpm: 90, startOffset: 0, wordsPerGroup: null }).count
    ).toBe(4);
    // extreme bpm to push above 40 even with the 90s cap → MAX_GROUPS ceiling
    expect(
      computeRhymeFillPlan({ duration: 90, bpm: 240, startOffset: 0, wordsPerGroup: 1 }).count
    ).toBe(40);
  });

  it('returns 0 targetBars (not negative) when startOffset >= duration', () => {
    const plan = computeRhymeFillPlan({ duration: 5, bpm: 90, startOffset: 10, wordsPerGroup: null });
    expect(plan.targetBars).toBe(0);
  });

  it('caps targetBars at MAX_RHYME_SECONDS (90s) for long songs', () => {
    // 240s playable would give 90 bars uncapped; with 90s cap: floor(90*90/240) = 33
    const plan = computeRhymeFillPlan({ duration: 240, bpm: 90, startOffset: 0, wordsPerGroup: 4 });
    expect(plan.targetBars).toBe(33);
    // ceil(33 / 4) = 9 groups
    expect(plan.count).toBe(9);
  });

  it('applies cap after startOffset subtraction', () => {
    // 300s duration - 4s offset = 296s playable, capped to 90 → floor(90*90/240) = 33 bars
    const plan = computeRhymeFillPlan({ duration: 300, bpm: 90, startOffset: 4, wordsPerGroup: 4 });
    expect(plan.targetBars).toBe(33);
  });

  it('does not affect songs shorter than the cap', () => {
    // 60s playable < 90s cap → behavior identical to pre-cap math
    // ceil(floor(60*90/240) / 4) = ceil(22/4) = 6
    const plan = computeRhymeFillPlan({ duration: 60, bpm: 90, startOffset: 0, wordsPerGroup: 4 });
    expect(plan.count).toBe(6);
  });
});
