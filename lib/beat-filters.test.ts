// lib/beat-filters.test.ts
import { describe, it, expect } from 'vitest';
import { bpmBucket, availableCategories, filterBeats, buildSectionLists } from './beat-filters';
import type { Beat } from './beats';

const bb = (id: string, bpm: number, opts: Partial<Beat> = {}): Beat => ({
  id, bpm,
  src: `/beats/${id}.mp3`,
  title: opts.title ?? `Beat ${id}`,
  barsPerLoop: 8,
  category: opts.category ?? 'boom-bap',
  ...opts,
});

describe('bpmBucket', () => {
  it('puts BPMs below 85 in slow', () => {
    expect(bpmBucket(70)).toBe('slow');
    expect(bpmBucket(84.99)).toBe('slow');
  });
  it('puts exactly 85 in mid (inclusive low)', () => {
    expect(bpmBucket(85)).toBe('mid');
  });
  it('puts 85-100 inclusive in mid', () => {
    expect(bpmBucket(85.01)).toBe('mid');
    expect(bpmBucket(100)).toBe('mid');
  });
  it('puts above 100 in fast', () => {
    expect(bpmBucket(100.01)).toBe('fast');
    expect(bpmBucket(140)).toBe('fast');
  });
});

describe('availableCategories', () => {
  it('returns categories in first-seen order, deduped', () => {
    const beats = [
      bb('a', 90, { category: 'boom-bap' }),
      bb('b', 95, { category: 'trap' }),
      bb('c', 100, { category: 'boom-bap' }),
      bb('d', 80, { category: 'lo-fi' }),
    ];
    expect(availableCategories(beats)).toEqual(['boom-bap', 'trap', 'lo-fi']);
  });

  it('returns empty for empty input', () => {
    expect(availableCategories([])).toEqual([]);
  });

  it('appends "youtube" as a virtual chip when any beat has source==="youtube"', () => {
    const beats = [
      bb('a', 90, { category: 'boom-bap' }),
      bb('yt-1', 88, { category: 'boom-bap', source: 'youtube' }),
    ];
    const result = availableCategories(beats);
    expect(result).toContain('boom-bap');
    expect(result).toContain('youtube');
    expect(result[result.length - 1]).toBe('youtube');
  });

  it('returns youtube only once even with multiple YT beats', () => {
    const beats = [
      bb('yt-1', 88, { category: 'boom-bap', source: 'youtube' }),
      bb('yt-2', 90, { category: 'trap', source: 'youtube' }),
    ];
    expect(availableCategories(beats).filter(c => c === 'youtube')).toHaveLength(1);
  });
});

describe('filterBeats', () => {
  const beats: Beat[] = [
    bb('a', 70, { category: 'boom-bap', title: 'Alpha' }),
    bb('b', 90, { category: 'boom-bap', title: 'Bravo' }),
    bb('c', 90, { category: 'trap',     title: 'Charlie' }),
    bb('d', 110, { category: 'trap',    title: 'Delta' }),
    bb('e', 88,  { category: 'boom-bap', source: 'youtube', title: 'Echo Stream' }),
  ];

  it('returns everything sorted by BPM ascending when criteria are "all" / ""', () => {
    expect(filterBeats(beats, { bucket: 'all', category: 'all', query: '' })
      .map(b => b.id)).toEqual(['a', 'e', 'b', 'c', 'd']);
  });

  it('keeps input order for tied BPMs (stable sort)', () => {
    const result = filterBeats(beats, { bucket: 'all', category: 'all', query: '' });
    const bIdx = result.findIndex(x => x.id === 'b');
    const cIdx = result.findIndex(x => x.id === 'c');
    expect(bIdx).toBeLessThan(cIdx);
  });

  it('filters by bucket', () => {
    expect(filterBeats(beats, { bucket: 'fast', category: 'all', query: '' }).map(b => b.id))
      .toEqual(['d']);
    expect(filterBeats(beats, { bucket: 'slow', category: 'all', query: '' }).map(b => b.id))
      .toEqual(['a']);
  });

  it('filters by real category', () => {
    expect(filterBeats(beats, { bucket: 'all', category: 'trap', query: '' }).map(b => b.id))
      .toEqual(['c', 'd']);
  });

  it('filters by virtual "youtube" category (source field)', () => {
    expect(filterBeats(beats, { bucket: 'all', category: 'youtube', query: '' }).map(b => b.id))
      .toEqual(['e']);
  });

  it('AND-combines bucket + category + query', () => {
    expect(filterBeats(beats, { bucket: 'mid', category: 'boom-bap', query: 'br' }).map(b => b.id))
      .toEqual(['b']);
  });

  it('case-insensitive substring match', () => {
    expect(filterBeats(beats, { bucket: 'all', category: 'all', query: 'ALPHA' }).map(b => b.id))
      .toEqual(['a']);
  });

  it('treats whitespace-only query as empty', () => {
    expect(filterBeats(beats, { bucket: 'all', category: 'all', query: '   ' }).map(b => b.id))
      .toEqual(['a', 'e', 'b', 'c', 'd']);
  });
});

describe('buildSectionLists', () => {
  const beats: Beat[] = [
    bb('a', 70), bb('b', 90), bb('c', 90), bb('d', 110), bb('e', 88, { source: 'youtube' }),
  ];

  it('returns recents (in stored order) and main (excluding recents, sorted by BPM)', () => {
    const result = buildSectionLists(beats, ['c', 'a'], { bucket: 'all', category: 'all', query: '' });
    expect(result.recents.map(b => b.id)).toEqual(['c', 'a']);  // preserve stored order
    expect(result.main.map(b => b.id)).toEqual(['e', 'b', 'd']); // BPM asc, recents removed
    expect(result.emptyAfterFilter).toBe(false);
  });

  it('drops stored IDs that are not in the beats prop', () => {
    const result = buildSectionLists(beats, ['c', 'gone-123', 'a'], { bucket: 'all', category: 'all', query: '' });
    expect(result.recents.map(b => b.id)).toEqual(['c', 'a']);
  });

  it('applies the same filter to both lists', () => {
    const result = buildSectionLists(beats, ['a', 'd'], { bucket: 'fast', category: 'all', query: '' });
    expect(result.recents.map(b => b.id)).toEqual(['d']);  // a (70 BPM) excluded by bucket
    expect(result.main.map(b => b.id)).toEqual([]);        // d already in recents
    expect(result.emptyAfterFilter).toBe(false);
  });

  it('reports emptyAfterFilter=true when both lists are empty', () => {
    const result = buildSectionLists(beats, ['a'], { bucket: 'all', category: 'all', query: 'no-such-title' });
    expect(result.recents).toEqual([]);
    expect(result.main).toEqual([]);
    expect(result.emptyAfterFilter).toBe(true);
  });

  it('with empty recents, main contains all filter-matching beats', () => {
    const result = buildSectionLists(beats, [], { bucket: 'all', category: 'all', query: '' });
    expect(result.recents).toEqual([]);
    expect(result.main.map(b => b.id)).toEqual(['a', 'e', 'b', 'c', 'd']);
  });
});
