import { describe, it, expect } from 'vitest';
import { computeBounceY } from './BouncingBall';

describe('computeBounceY', () => {
  it('returns 0 at cell boundaries (ball at apex between beats)', () => {
    expect(computeBounceY(0)).toBeCloseTo(0);
    expect(computeBounceY(0.25)).toBeCloseTo(0);
    expect(computeBounceY(0.5)).toBeCloseTo(0);
    expect(computeBounceY(0.75)).toBeCloseTo(0);
    expect(computeBounceY(1)).toBeCloseTo(0);
  });

  it('returns 1 at cell midpoints (ball landed on tile, in sync with the kick)', () => {
    expect(computeBounceY(0.125)).toBeCloseTo(1); // mid cell 0
    expect(computeBounceY(0.375)).toBeCloseTo(1); // mid cell 1
    expect(computeBounceY(0.625)).toBeCloseTo(1); // mid cell 2
    expect(computeBounceY(0.875)).toBeCloseTo(1); // mid cell 3
  });

  it('returns 0.25 at quarter phase (squared-triangle, ball still near apex)', () => {
    // x=0.0625 → cellPhase=0.25 → 2·cellPhase−1 = −0.5 → t = 1 − |−0.5| = 0.5 → y = 0.25.
    // This value (vs. 0.5 for a linear triangle or 0.125 for cubed) locks in
    // the squared-triangle shape — ball spends most of the cell near the
    // apex and only snaps to the tile at each cell midpoint.
    expect(computeBounceY(0.0625)).toBeCloseTo(0.25);
  });
});
