import { describe, it, expect } from 'vitest';
import { rowOpacity } from './WordGrid';

describe('rowOpacity', () => {
  const ws = 4; // windowSize

  it('returns 1 for the active row', () => {
    expect(rowOpacity(5, 5, ws)).toBe(1);
  });

  it('returns 0.07 for the single near-past row', () => {
    expect(rowOpacity(4, 5, ws)).toBe(0.07);
  });

  it('returns 0 for invisible buffer rows above', () => {
    expect(rowOpacity(3, 5, ws)).toBe(0);
    expect(rowOpacity(0, 5, ws)).toBe(0);
  });

  it('returns 0.28 for upcoming rows within the window', () => {
    expect(rowOpacity(6, 5, ws)).toBe(0.28);  // activeRow + 1
    expect(rowOpacity(9, 5, ws)).toBe(0.28);  // activeRow + windowSize
  });

  it('returns 0 for the invisible buffer row below the window', () => {
    expect(rowOpacity(10, 5, ws)).toBe(0); // activeRow + windowSize + 1
    expect(rowOpacity(11, 5, ws)).toBe(0);
  });

  it('works correctly at activeRow = 0 (start of game)', () => {
    expect(rowOpacity(0, 0, ws)).toBe(1);    // active
    expect(rowOpacity(-1, 0, ws)).toBe(0.07); // near past (will be null bar, just needs opacity)
    expect(rowOpacity(-2, 0, ws)).toBe(0);   // buffer
    expect(rowOpacity(1, 0, ws)).toBe(0.28); // upcoming
    expect(rowOpacity(5, 0, ws)).toBe(0);    // buffer below
  });
});
