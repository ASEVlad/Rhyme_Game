// components/BrowseBeats.test.ts
import { describe, it, expect } from 'vitest';
import { computePreviewStart } from './BrowseBeats';
import type { Beat } from '@/lib/beats';

const baseBeat: Beat = {
  id: 'x', src: '/x.mp3', title: 'X', bpm: 90, barsPerLoop: 8, category: 'boom-bap',
};

describe('computePreviewStart', () => {
  it('defaults to startOffset + 8 when neither previewOffset nor a short duration applies', () => {
    expect(computePreviewStart({ ...baseBeat, startOffset: 4 }, 120)).toBe(12);
  });

  it('uses 8 when startOffset is unset', () => {
    expect(computePreviewStart(baseBeat, 120)).toBe(8);
  });

  it('honours an explicit previewOffset', () => {
    expect(computePreviewStart({ ...baseBeat, startOffset: 2, previewOffset: 20 }, 120)).toBe(20);
  });

  it('clamps to duration - 1 when the desired start would overrun', () => {
    expect(computePreviewStart({ ...baseBeat, previewOffset: 100 }, 30)).toBe(29);
  });

  it('returns 0 when duration is less than 1 (degenerate)', () => {
    expect(computePreviewStart({ ...baseBeat, previewOffset: 5 }, 0.5)).toBe(0);
  });
});
