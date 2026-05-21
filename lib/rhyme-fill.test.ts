import { describe, it, expect } from 'vitest';
import { computeRhymeFillPlan } from './rhyme-fill';

describe('computeRhymeFillPlan', () => {
  it('computes targetBars from playable duration', () => {
    // 60s at 90bpm with 0 offset: 60 * 90 / 240 = 22.5 → 22 bars
    const plan = computeRhymeFillPlan({ duration: 60, bpm: 90, startOffset: 0 });
    expect(plan.targetBars).toBe(22);
  });

  it('subtracts startOffset before computing bars', () => {
    // (60 - 4)s at 90bpm: 56 * 90 / 240 = 21 bars
    const plan = computeRhymeFillPlan({ duration: 60, bpm: 90, startOffset: 4 });
    expect(plan.targetBars).toBe(21);
  });

  it('count is ceil(targetBars / 4) — one 4-bar block per ceil', () => {
    // 22 bars / 4 = 5.5 → 6 blocks
    const plan = computeRhymeFillPlan({ duration: 60, bpm: 90, startOffset: 0 });
    expect(plan.count).toBe(6);
  });

  it('clamps count to the [4, 25] range', () => {
    // tiny song → MIN_BLOCKS floor
    expect(
      computeRhymeFillPlan({ duration: 10, bpm: 90, startOffset: 0 }).count
    ).toBe(4);
    // 90s × 240bpm = 90 bars → ceil(90/4) = 23 blocks (within cap)
    const big = computeRhymeFillPlan({ duration: 90, bpm: 240, startOffset: 0 });
    expect(big.count).toBeLessThanOrEqual(25);
  });

  it('returns 0 targetBars (not negative) when startOffset >= duration', () => {
    const plan = computeRhymeFillPlan({ duration: 5, bpm: 90, startOffset: 10 });
    expect(plan.targetBars).toBe(0);
  });

  it('caps targetBars at MAX_RHYME_SECONDS (90s) for long songs', () => {
    // 240s playable would give 90 bars uncapped; with 90s cap: floor(90*90/240) = 33
    const plan = computeRhymeFillPlan({ duration: 240, bpm: 90, startOffset: 0 });
    expect(plan.targetBars).toBe(33);
    // ceil(33 / 4) = 9 blocks
    expect(plan.count).toBe(9);
  });

  it('applies cap after startOffset subtraction', () => {
    // 300s duration - 4s offset = 296s playable, capped to 90 → floor(90*90/240) = 33 bars
    const plan = computeRhymeFillPlan({ duration: 300, bpm: 90, startOffset: 4 });
    expect(plan.targetBars).toBe(33);
  });

  it('does not affect songs shorter than the cap', () => {
    // 60s playable < 90s cap → behavior identical to pre-cap math
    // ceil(22/4) = 6
    const plan = computeRhymeFillPlan({ duration: 60, bpm: 90, startOffset: 0 });
    expect(plan.count).toBe(6);
  });
});
