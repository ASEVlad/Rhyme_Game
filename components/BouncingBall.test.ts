import { describe, it, expect } from 'vitest';
import { computeBounceY } from './BouncingBall';

describe('computeBounceY', () => {
  it('returns 0 at cell boundaries (ball at top, between beats)', () => {
    expect(computeBounceY(0)).toBeCloseTo(0);
    expect(computeBounceY(0.25)).toBeCloseTo(0);
    expect(computeBounceY(0.5)).toBeCloseTo(0);
    expect(computeBounceY(0.75)).toBeCloseTo(0);
    expect(computeBounceY(1)).toBeCloseTo(0);
  });

  it('returns 1 at beat centers (ball at bottom, on plate)', () => {
    expect(computeBounceY(0.125)).toBeCloseTo(1); // beat 0 center
    expect(computeBounceY(0.375)).toBeCloseTo(1); // beat 1 center
    expect(computeBounceY(0.625)).toBeCloseTo(1); // beat 2 center
    expect(computeBounceY(0.875)).toBeCloseTo(1); // beat 3 center
  });

  it('returns ~0.707 at quarter phase within a cell', () => {
    // x=0.0625 → cellPhase=0.25 → sin(π/4) ≈ 0.707
    expect(computeBounceY(0.0625)).toBeCloseTo(0.707, 2);
  });
});
