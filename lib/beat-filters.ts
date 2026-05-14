// lib/beat-filters.ts
import type { Beat, BeatCategory } from './beats';

export type BpmBucket = 'all' | 'slow' | 'mid' | 'fast';

// slow: bpm < 85
// mid:  85 ≤ bpm ≤ 100
// fast: bpm > 100
export function bpmBucket(bpm: number): Exclude<BpmBucket, 'all'> {
  if (bpm < 85) return 'slow';
  if (bpm > 100) return 'fast';
  return 'mid';
}

// The picker treats `source === 'youtube'` as a virtual chip alongside the real categories.
export type CategoryChip = BeatCategory | 'youtube';

export function availableCategories(beats: Beat[]): CategoryChip[] {
  const seen = new Set<CategoryChip>();
  const result: CategoryChip[] = [];
  for (const b of beats) {
    if (!seen.has(b.category)) { seen.add(b.category); result.push(b.category); }
  }
  if (beats.some(b => b.source === 'youtube') && !seen.has('youtube')) {
    result.push('youtube');
  }
  return result;
}

export type FilterCriteria = {
  bucket: BpmBucket;
  category: CategoryChip | 'all';
  query: string;
};

export function filterBeats(beats: Beat[], c: FilterCriteria): Beat[] {
  const q = c.query.trim().toLowerCase();
  // Use Array.from + indexed map so we can sort stably by BPM while preserving input order on ties.
  const candidates = beats
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => {
      if (c.bucket !== 'all' && bpmBucket(b.bpm) !== c.bucket) return false;
      if (c.category !== 'all') {
        if (c.category === 'youtube') {
          if (b.source !== 'youtube') return false;
        } else if (b.category !== c.category) {
          return false;
        }
      }
      if (q && !b.title.toLowerCase().includes(q)) return false;
      return true;
    });
  candidates.sort((x, y) => x.b.bpm - y.b.bpm || x.i - y.i);
  return candidates.map(({ b }) => b);
}

export function buildSectionLists(
  beats: Beat[],
  recentIds: string[],
  criteria: FilterCriteria,
): { recents: Beat[]; main: Beat[]; emptyAfterFilter: boolean } {
  // Resolve recent IDs against the beats prop in stored order, drop stale.
  const recentBeats: Beat[] = [];
  for (const id of recentIds) {
    const beat = beats.find(b => b.id === id);
    if (beat) recentBeats.push(beat);
  }
  const recentIdSet = new Set(recentBeats.map(b => b.id));
  const mainCandidates = beats.filter(b => !recentIdSet.has(b.id));

  // Filter recents in stored order (NOT BPM-sorted — recents are presented chronologically).
  const recentsFiltered = recentBeats.filter(b =>
    filterBeats([b], criteria).length === 1);

  const main = filterBeats(mainCandidates, criteria);

  return {
    recents: recentsFiltered,
    main,
    emptyAfterFilter: recentsFiltered.length === 0 && main.length === 0,
  };
}
