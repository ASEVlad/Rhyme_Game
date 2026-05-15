import { describe, it, expect } from 'vitest';
import { computeActiveBeat } from './Setup';
import type { Beat } from '@/lib/beats';

const beat = (id: string): Beat => ({
  id,
  src: `/beats/${id}.mp3`,
  title: id,
  bpm: 90,
  barsPerLoop: 8,
  category: 'other',
});

const localBeat   = beat('local-1');
const urlBeat     = beat('yt-url');
const catalogBeat = beat('yt-cat');

describe('computeActiveBeat', () => {
  it('returns selectedBundled when beatSource is local', () => {
    expect(
      computeActiveBeat('local', localBeat, { status: 'idle' }, null, [])
    ).toBe(localBeat);
  });

  it('returns null when beatSource is local and no bundled beat selected', () => {
    expect(
      computeActiveBeat('local', null, { status: 'loaded', beat: urlBeat }, null, [])
    ).toBeNull();
  });

  it('ignores youtube state when beatSource is local', () => {
    expect(
      computeActiveBeat('local', null, { status: 'loaded', beat: urlBeat }, null, [])
    ).toBeNull();
  });

  it('returns url beat when youtube tab has a loaded beat', () => {
    expect(
      computeActiveBeat('youtube', null, { status: 'loaded', beat: urlBeat }, null, [])
    ).toBe(urlBeat);
  });

  it('returns catalog beat when youtube tab has a selected catalog id', () => {
    expect(
      computeActiveBeat('youtube', null, { status: 'idle' }, catalogBeat.id, [catalogBeat])
    ).toBe(catalogBeat);
  });

  it('prefers url beat over catalog beat', () => {
    expect(
      computeActiveBeat('youtube', null, { status: 'loaded', beat: urlBeat }, catalogBeat.id, [catalogBeat])
    ).toBe(urlBeat);
  });

  it('returns null when youtube tab has no url beat and no catalog selection', () => {
    expect(
      computeActiveBeat('youtube', null, { status: 'idle' }, null, [])
    ).toBeNull();
  });

  it('returns null when selectedCatalogId does not match any ytBeat', () => {
    expect(
      computeActiveBeat('youtube', null, { status: 'idle' }, 'ghost-id', [catalogBeat])
    ).toBeNull();
  });
});
