import { describe, it, expect } from 'vitest';
import { availableCategories } from './BeatPicker';
import type { Beat } from '@/lib/beats';

const boomBap: Beat = { id: 'b1', src: '/b1.mp3', title: 'Beat 1', bpm: 90, barsPerLoop: 8, category: 'boom-bap' };
const trap: Beat = { id: 'b2', src: '/b2.mp3', title: 'Beat 2', bpm: 140, barsPerLoop: 8, category: 'trap' };
const trap2: Beat = { id: 'b3', src: '/b3.mp3', title: 'Beat 3', bpm: 145, barsPerLoop: 8, category: 'trap' };

describe('availableCategories', () => {
  it('returns ordered unique categories present in the beats array', () => {
    const result = availableCategories([boomBap, trap, trap2]);
    expect(result).toEqual(['boom-bap', 'trap']);
  });

  it('returns a single category when all beats share the same category', () => {
    const result = availableCategories([trap, trap2]);
    expect(result).toEqual(['trap']);
  });

  it('returns an empty array for an empty beats array', () => {
    expect(availableCategories([])).toEqual([]);
  });

  it('chips for categories with 0 beats are not returned (only present categories included)', () => {
    // Only 'boom-bap' and 'trap' are present; 'jazz', 'lo-fi', 'drill', 'other' must not appear
    const result = availableCategories([boomBap, trap]);
    expect(result).not.toContain('jazz');
    expect(result).not.toContain('lo-fi');
    expect(result).not.toContain('drill');
    expect(result).not.toContain('other');
    expect(result).toEqual(['boom-bap', 'trap']);
  });

  it('preserves insertion order of first occurrence', () => {
    const lo: Beat = { id: 'b4', src: '/b4.mp3', title: 'Beat 4', bpm: 70, barsPerLoop: 8, category: 'lo-fi' };
    const result = availableCategories([trap, lo, boomBap]);
    expect(result).toEqual(['trap', 'lo-fi', 'boom-bap']);
  });
});
