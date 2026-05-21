import { describe, it, expect } from 'vitest';
import { flattenBars } from './flatten-bars';
import { getRhymeScheme } from './rhyme-schemes';
import type { RhymeBlock } from './fallback-groups';

const block = (...words: string[]): RhymeBlock => ({ words });

describe('flattenBars', () => {
  it('emits 4 bars per block in order', () => {
    const blocks = [block('a1', 'a2', 'b1', 'b2'), block('c1', 'c2', 'd1', 'd2')];
    const bars = flattenBars(blocks, getRhymeScheme('AABB'));
    expect(bars.map(b => b.word)).toEqual(['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'd1', 'd2']);
  });

  it('assigns the same color within a rhyme family of a block (AABB)', () => {
    const blocks = [block('a1', 'a2', 'b1', 'b2')];
    const bars = flattenBars(blocks, getRhymeScheme('AABB'));
    // Block 0: A family → COLORS[0]=yellow, B family → COLORS[1]=blue
    expect(bars.map(b => b.color)).toEqual(['yellow', 'yellow', 'blue', 'blue']);
  });

  it('alternates colors per family in ABAB pattern', () => {
    const blocks = [block('a1', 'b1', 'a2', 'b2')];
    const bars = flattenBars(blocks, getRhymeScheme('ABAB'));
    expect(bars.map(b => b.color)).toEqual(['yellow', 'blue', 'yellow', 'blue']);
  });

  it('renders X slots as empty-word bars (silent)', () => {
    const blocks = [block('a1', 'a2', '', '')];
    const bars = flattenBars(blocks, getRhymeScheme('AAXX'));
    expect(bars.map(b => b.word)).toEqual(['a1', 'a2', '', '']);
  });

  it('AXAX places empty bars at positions 1 and 3', () => {
    const blocks = [block('w1', '', 'w2', '')];
    const bars = flattenBars(blocks, getRhymeScheme('AXAX'));
    expect(bars.map(b => b.word)).toEqual(['w1', '', 'w2', '']);
  });

  it('AAAA gives every bar the same color', () => {
    const blocks = [block('w1', 'w2', 'w3', 'w4')];
    const bars = flattenBars(blocks, getRhymeScheme('AAAA'));
    expect(new Set(bars.map(b => b.color)).size).toBe(1);
  });

  it('ABBA keeps the outer rhymes one color and the inner another', () => {
    const blocks = [block('outer1', 'inner1', 'inner2', 'outer2')];
    const bars = flattenBars(blocks, getRhymeScheme('ABBA'));
    expect(bars[0].color).toBe(bars[3].color);
    expect(bars[1].color).toBe(bars[2].color);
    expect(bars[0].color).not.toBe(bars[1].color);
  });

  it('uses new colors per block (block 1 different from block 0)', () => {
    const blocks = [
      block('a1', 'a2', 'b1', 'b2'),
      block('c1', 'c2', 'd1', 'd2'),
    ];
    const bars = flattenBars(blocks, getRhymeScheme('AABB'));
    // Block 0 family A=yellow, family B=blue
    expect(bars[0].color).toBe('yellow');
    expect(bars[2].color).toBe('blue');
    // Block 1 family A=orange, family B=red
    expect(bars[4].color).toBe('orange');
    expect(bars[6].color).toBe('red');
  });

  it('sets blockIndex per emitted bar', () => {
    const blocks = [block('a', 'a', 'b', 'b'), block('c', 'c', 'd', 'd')];
    const bars = flattenBars(blocks, getRhymeScheme('AABB'));
    expect(bars.map(b => b.blockIndex)).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
  });

  it('returns empty array for empty input', () => {
    expect(flattenBars([], getRhymeScheme('AABB'))).toEqual([]);
  });
});
