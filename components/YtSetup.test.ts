// components/YtSetup.test.ts
import { describe, it, expect } from 'vitest';
import { buildYtBeat } from './YtSetup';

const base = { id: 'abc123', src: '/beats/abc123.mp3', title: 'Dark Bap', bpm: 90, barsPerLoop: 64 };

describe('buildYtBeat', () => {
  it('maps basic fields', () => {
    const beat = buildYtBeat(base);
    expect(beat.id).toBe('abc123');
    expect(beat.src).toBe('/beats/abc123.mp3');
    expect(beat.title).toBe('Dark Bap');
    expect(beat.bpm).toBe(90);
    expect(beat.barsPerLoop).toBe(64);
  });

  it('sets source to youtube when source field is "youtube"', () => {
    const beat = buildYtBeat({ ...base, source: 'youtube' });
    expect(beat.source).toBe('youtube');
  });

  it('omits source when field is absent', () => {
    const beat = buildYtBeat(base);
    expect('source' in beat).toBe(false);
  });

  it('omits source when source field is not "youtube"', () => {
    const beat = buildYtBeat({ ...base, source: 'other' });
    expect('source' in beat).toBe(false);
  });

  it('defaults category to "other" when absent', () => {
    const beat = buildYtBeat(base);
    expect(beat.category).toBe('other');
  });

  it('uses provided category', () => {
    const beat = buildYtBeat({ ...base, category: 'trap' });
    expect(beat.category).toBe('trap');
  });
});
