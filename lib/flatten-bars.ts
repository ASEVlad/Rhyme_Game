import type { RhymeBlock } from './fallback-groups';
import { RHYME_COLORS, type RhymeColor } from './colors';
import type { RhymeScheme } from './rhyme-schemes';

export type Bar = {
  /** Empty string for X / silent slots. */
  word: string;
  color: RhymeColor;
  blockIndex: number;
};

/**
 * Expand 4-bar blocks into a flat list of bars, one bar per pattern position.
 * X slots become silent bars (word=''). Color cycles per (block, rhyme-family).
 */
export function flattenBars(blocks: RhymeBlock[], scheme: RhymeScheme): Bar[] {
  const pattern = scheme.pattern;
  const bars: Bar[] = [];
  blocks.forEach((block, blockIdx) => {
    for (let i = 0; i < 4; i++) {
      const letter = pattern[i] ?? 'A';
      const word = block.words[i] ?? '';
      if (letter === 'X' || !word) {
        bars.push({ word: '', color: 'yellow', blockIndex: blockIdx });
        continue;
      }
      const familyIdx = letter === 'A' ? 0 : 1;
      const color = RHYME_COLORS[(blockIdx * 2 + familyIdx) % RHYME_COLORS.length];
      bars.push({ word, color, blockIndex: blockIdx });
    }
  });
  return bars;
}
