import type { RhymeGroup } from './fallback-groups';
import { RHYME_COLORS, type RhymeColor } from './colors';
import type { RhymeScheme } from './rhyme-schemes';

export type Bar = {
  word: string;
  color: RhymeColor;
  groupIndex: number;
};

export function flattenBars(groups: RhymeGroup[], scheme?: RhymeScheme): Bar[] {
  if (!scheme?.interleave) {
    const bars: Bar[] = [];
    groups.forEach((g, i) => {
      const color = RHYME_COLORS[i % RHYME_COLORS.length];
      g.words.forEach(word => bars.push({ word, color, groupIndex: i }));
    });
    return bars;
  }

  const bars: Bar[] = [];
  let pairIndex = 0;
  for (let i = 0; i + 1 < groups.length; i += 2) {
    const g0 = groups[i];
    const g1 = groups[i + 1];
    const color0 = RHYME_COLORS[(pairIndex * 2) % RHYME_COLORS.length];
    const color1 = RHYME_COLORS[(pairIndex * 2 + 1) % RHYME_COLORS.length];
    const maxLen = Math.max(g0.words.length, g1.words.length);
    for (let w = 0; w < maxLen; w++) {
      if (w < g0.words.length) bars.push({ word: g0.words[w], color: color0, groupIndex: i });
      if (w < g1.words.length) bars.push({ word: g1.words[w], color: color1, groupIndex: i + 1 });
    }
    pairIndex++;
  }
  if (groups.length % 2 === 1) {
    const last = groups[groups.length - 1];
    const color = RHYME_COLORS[(groups.length - 1) % RHYME_COLORS.length];
    last.words.forEach(word => bars.push({ word, color, groupIndex: groups.length - 1 }));
  }
  return bars;
}
