import { describe, it, expect } from 'vitest';
import { flattenBars } from './flatten-bars';
import { getRhymeScheme } from './rhyme-schemes';

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

describe('flattenBars — alternating scheme', () => {
  it('interleaves groups in ABAB order', () => {
    const groups = [
      { ending: '-a', words: ['a0', 'a1'] },
      { ending: '-b', words: ['b0', 'b1'] },
      { ending: '-c', words: ['c0', 'c1'] },
      { ending: '-d', words: ['d0', 'd1'] },
    ];
    const bars = flattenBars(groups, getRhymeScheme('alternating'));
    expect(bars.map(b => b.word)).toEqual(['a0', 'b0', 'a1', 'b1', 'c0', 'd0', 'c1', 'd1']);
  });

  it('assigns per-pair colors: pair0 = yellow/blue, pair1 = orange/red', () => {
    const groups = [
      { ending: '-a', words: ['a0', 'a1'] },
      { ending: '-b', words: ['b0', 'b1'] },
      { ending: '-c', words: ['c0', 'c1'] },
      { ending: '-d', words: ['d0', 'd1'] },
    ];
    const bars = flattenBars(groups, getRhymeScheme('alternating'));
    expect(bars.map(b => b.color)).toEqual([
      'yellow', 'blue', 'yellow', 'blue',
      'orange', 'red',  'orange', 'red',
    ]);
  });

  it('sets groupIndex to the original group position', () => {
    const groups = [
      { ending: '-a', words: ['a0', 'a1'] },
      { ending: '-b', words: ['b0', 'b1'] },
    ];
    const bars = flattenBars(groups, getRhymeScheme('alternating'));
    expect(bars.map(b => b.groupIndex)).toEqual([0, 1, 0, 1]);
  });

  it('appends an unpaired last group sequentially when group count is odd', () => {
    const groups = [
      { ending: '-a', words: ['a0', 'a1'] },
      { ending: '-b', words: ['b0', 'b1'] },
      { ending: '-c', words: ['c0', 'c1'] },
    ];
    const bars = flattenBars(groups, getRhymeScheme('alternating'));
    expect(bars.map(b => b.word)).toEqual(['a0', 'b0', 'a1', 'b1', 'c0', 'c1']);
    expect(bars.slice(4).map(b => b.color)).toEqual(['orange', 'orange']);
  });

  it('does not crash on empty groups', () => {
    expect(flattenBars([], getRhymeScheme('alternating'))).toEqual([]);
  });
});

describe('flattenBars — non-alternating schemes stay sequential', () => {
  it('couplets scheme produces sequential bars', () => {
    const groups = [
      { ending: '-a', words: ['a0', 'a1'] },
      { ending: '-b', words: ['b0', 'b1'] },
    ];
    const bars = flattenBars(groups, getRhymeScheme('couplets'));
    expect(bars.map(b => b.word)).toEqual(['a0', 'a1', 'b0', 'b1']);
  });

  it('bar4 scheme produces sequential bars', () => {
    const groups = [
      { ending: '-a', words: ['a0', 'a1', 'a2', 'a3'] },
      { ending: '-b', words: ['b0', 'b1', 'b2', 'b3'] },
    ];
    const bars = flattenBars(groups, getRhymeScheme('bar4'));
    expect(bars.map(b => b.word)).toEqual(['a0', 'a1', 'a2', 'a3', 'b0', 'b1', 'b2', 'b3']);
  });

  it('no scheme argument produces sequential bars (backward compat)', () => {
    const groups = [
      { ending: '-x', words: ['x0', 'x1'] },
      { ending: '-y', words: ['y0', 'y1'] },
    ];
    const bars = flattenBars(groups);
    expect(bars.map(b => b.word)).toEqual(['x0', 'x1', 'y0', 'y1']);
  });
});
