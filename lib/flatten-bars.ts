import type { RhymeGroup } from './fallback-groups';
import { RHYME_COLORS, type RhymeColor } from './colors';

export type Bar = {
  word: string;
  color: RhymeColor;
  groupIndex: number;
};

export function flattenBars(groups: RhymeGroup[]): Bar[] {
  const bars: Bar[] = [];
  groups.forEach((g, i) => {
    const color = RHYME_COLORS[i % RHYME_COLORS.length];
    g.words.forEach(word => bars.push({ word, color, groupIndex: i }));
  });
  return bars;
}
