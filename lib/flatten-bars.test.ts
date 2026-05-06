import { describe, it, expect } from 'vitest';
import { flattenBars } from './flatten-bars';

describe('flattenBars', () => {
  it('produces one bar per word, preserving order', () => {
    const groups = [
      { ending: '-ox', words: ['fox', 'box'] },
      { ending: '-ent', words: ['bent', 'tent'] },
    ];
    const bars = flattenBars(groups);
    expect(bars.map(b => b.word)).toEqual(['fox', 'box', 'bent', 'tent']);
  });

  it('assigns colors per group, round-robin', () => {
    const groups = [
      { ending: 'a', words: ['a1'] },
      { ending: 'b', words: ['b1'] },
      { ending: 'c', words: ['c1'] },
      { ending: 'd', words: ['d1'] },
      { ending: 'e', words: ['e1'] },
    ];
    const bars = flattenBars(groups);
    expect(bars.map(b => b.color)).toEqual(['yellow', 'blue', 'orange', 'red', 'yellow']);
  });

  it('keeps groupIndex consistent within a group', () => {
    const groups = [{ ending: 'a', words: ['x', 'y', 'z'] }];
    const bars = flattenBars(groups);
    expect(bars.map(b => b.groupIndex)).toEqual([0, 0, 0]);
  });

  it('returns empty array for empty input', () => {
    expect(flattenBars([])).toEqual([]);
  });
});
