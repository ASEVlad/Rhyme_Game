# Beat Picker Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-beat ◀ ▶ stepper in `components/BeatPicker.tsx` with a full-screen `<BrowseBeats />` modal that exposes every beat in `allBeats = [...BEATS, ...ytCatalog]` at once, filters by BPM bucket / category / title search, previews snippets, and tracks recently-played beats in `localStorage`. Add a placeholder `/yt` route and a forward-pointer link from Setup for a future dedicated YouTube gameplay flow.

**Architecture:** Pure filter + storage helpers in `lib/`, a single client component in `components/BrowseBeats.tsx` that composes them, an inline tappable summary card in `Setup.tsx` that opens the modal, and a one-line addition in `Game.tsx` that records bundled/catalog plays. The vitest setup is `environment: 'node'` (no jsdom) — testing is targeted at pure helpers; the component itself is verified manually.

**Tech Stack:** Next.js 14 App Router, TypeScript, React 18, Tailwind, HTML5 `<audio>`, vitest (node env).

**Spec:** `docs/superpowers/specs/2026-05-14-beat-picker-redesign-design.md`

---

## File map

| File | Action |
|------|--------|
| `lib/beats.ts` | Modify — add optional `previewOffset?: number` to `Beat` |
| `lib/beat-filters.ts` | Create — `bpmBucket`, `availableCategories`, `filterBeats`, `buildSectionLists` |
| `lib/beat-filters.test.ts` | Create — unit tests for the above |
| `lib/recent-beats.ts` | Create — `loadRecentBeats`, `addRecentBeat` (mirrors `lib/language-storage.ts`) |
| `lib/recent-beats.test.ts` | Create — unit tests |
| `app/yt/page.tsx` | Create — placeholder "Coming soon" page |
| `components/BrowseBeats.tsx` | Create — full-screen modal + audio + exported `computePreviewStart` |
| `components/BrowseBeats.test.ts` | Create — unit tests for `computePreviewStart` |
| `components/Setup.tsx` | Modify — replace `<BeatPicker />` with inline summary card + `<BrowseBeats />`; add "Try YouTube mode →" link |
| `components/Game.tsx` | Modify — call `addRecentBeat(beat.id)` in `handlePlay` |
| `components/BeatPicker.tsx` | Delete |
| `components/BeatPicker.test.tsx` | Delete |

---

### Task 1: Add `previewOffset` to the `Beat` type

**Files:**
- Modify: `lib/beats.ts:9-18`

- [ ] **Step 1: Add the optional field**

Read the existing `Beat` type. Add a single optional field:

```ts
export type Beat = {
  id: string;
  src: string;
  title: string;
  bpm: number;
  barsPerLoop: number;
  startOffset?: number;  // seconds before beat 1; omit or 0 = file starts on beat 1
  category: BeatCategory;
  source?: 'youtube';    // present only for YT-downloaded beats
  previewOffset?: number; // seconds from file start to begin preview playback; defaults derived from startOffset
};
```

- [ ] **Step 2: Verify the project still type-checks and tests pass**

```bash
npx vitest run
```
Expected: all existing tests pass (no `previewOffset` consumers yet).

- [ ] **Step 3: Commit**

```bash
git add lib/beats.ts
git commit -m "feat(beats): add optional previewOffset field to Beat type"
```

---

### Task 2: `lib/beat-filters.ts` pure helpers (TDD)

**Files:**
- Create: `lib/beat-filters.ts`
- Create: `lib/beat-filters.test.ts`

- [ ] **Step 1: Write the failing tests for `bpmBucket`**

```ts
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
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run lib/beat-filters.test.ts
```
Expected: FAIL — "Cannot find module './beat-filters'".

- [ ] **Step 3: Implement the minimum to make `bpmBucket` pass**

```ts
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
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run lib/beat-filters.test.ts
```
Expected: 4 of 4 bpmBucket tests pass; other test names fail with import errors (we'll add the symbols next).

- [ ] **Step 5: Write failing tests for `availableCategories`**

Append to `lib/beat-filters.test.ts`:

```ts
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
```

- [ ] **Step 6: Implement `availableCategories`**

Append to `lib/beat-filters.ts`:

```ts
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
```

- [ ] **Step 7: Run — expect PASS for these four**

```bash
npx vitest run lib/beat-filters.test.ts -t availableCategories
```
Expected: 4 pass.

- [ ] **Step 8: Write failing tests for `filterBeats`**

Append to `lib/beat-filters.test.ts`:

```ts
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
```

- [ ] **Step 9: Implement `filterBeats`**

Append to `lib/beat-filters.ts`:

```ts
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
```

- [ ] **Step 10: Run — expect PASS**

```bash
npx vitest run lib/beat-filters.test.ts -t filterBeats
```
Expected: 8 pass.

- [ ] **Step 11: Write failing tests for `buildSectionLists`**

Append to `lib/beat-filters.test.ts`:

```ts
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
```

- [ ] **Step 12: Implement `buildSectionLists`**

Append to `lib/beat-filters.ts`:

```ts
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
```

- [ ] **Step 13: Run all `beat-filters` tests — expect ALL PASS**

```bash
npx vitest run lib/beat-filters.test.ts
```
Expected: every test in the file passes (4 bpmBucket + 4 availableCategories + 8 filterBeats + 5 buildSectionLists = 21 tests).

- [ ] **Step 14: Commit**

```bash
git add lib/beat-filters.ts lib/beat-filters.test.ts
git commit -m "feat(beat-filters): pure filter/sort/section helpers for picker"
```

---

### Task 3: `lib/recent-beats.ts` localStorage helpers (TDD)

**Files:**
- Create: `lib/recent-beats.ts`
- Create: `lib/recent-beats.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/recent-beats.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadRecentBeats, addRecentBeat } from './recent-beats';

const KEY = 'rhyme.recentBeats';

function stubStorage(initial?: string) {
  const store = new Map<string, string>();
  if (initial !== undefined) store.set(KEY, initial);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  });
  return store;
}

describe('loadRecentBeats', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it('returns [] when localStorage is unavailable (SSR)', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(loadRecentBeats()).toEqual([]);
  });

  it('returns [] when key is missing', () => {
    stubStorage();
    expect(loadRecentBeats()).toEqual([]);
  });

  it('returns the parsed array of strings', () => {
    stubStorage(JSON.stringify(['a', 'b', 'c']));
    expect(loadRecentBeats()).toEqual(['a', 'b', 'c']);
  });

  it('returns [] when JSON is malformed', () => {
    stubStorage('not json');
    expect(loadRecentBeats()).toEqual([]);
  });

  it('returns [] when stored value is not an array', () => {
    stubStorage(JSON.stringify({ a: 1 }));
    expect(loadRecentBeats()).toEqual([]);
  });

  it('drops non-string entries silently', () => {
    stubStorage(JSON.stringify(['a', 42, null, 'b']));
    expect(loadRecentBeats()).toEqual(['a', 'b']);
  });

  it('returns [] when getItem throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('boom'); }, setItem: () => {}, removeItem: () => {} });
    expect(loadRecentBeats()).toEqual([]);
  });
});

describe('addRecentBeat', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it('writes a single-entry array to a fresh store', () => {
    const store = stubStorage();
    addRecentBeat('x');
    expect(JSON.parse(store.get(KEY)!)).toEqual(['x']);
  });

  it('prepends new IDs (most-recent first)', () => {
    const store = stubStorage(JSON.stringify(['a', 'b']));
    addRecentBeat('c');
    expect(JSON.parse(store.get(KEY)!)).toEqual(['c', 'a', 'b']);
  });

  it('deduplicates: existing ID moves to the front', () => {
    const store = stubStorage(JSON.stringify(['a', 'b', 'c']));
    addRecentBeat('b');
    expect(JSON.parse(store.get(KEY)!)).toEqual(['b', 'a', 'c']);
  });

  it('caps at 5 entries', () => {
    const store = stubStorage(JSON.stringify(['a', 'b', 'c', 'd', 'e']));
    addRecentBeat('f');
    expect(JSON.parse(store.get(KEY)!)).toEqual(['f', 'a', 'b', 'c', 'd']);
  });

  it('no-ops silently when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => addRecentBeat('z')).not.toThrow();
  });

  it('no-ops silently when setItem throws (quota)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); },
      removeItem: () => {},
    });
    expect(() => addRecentBeat('z')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run lib/recent-beats.test.ts
```
Expected: FAIL — "Cannot find module './recent-beats'".

- [ ] **Step 3: Implement `lib/recent-beats.ts`**

```ts
// lib/recent-beats.ts
// Client-only. Stores recently-played beat IDs in localStorage.
const KEY = 'rhyme.recentBeats';
const CAP = 5;

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadRecentBeats(): string[] {
  const s = getStorage();
  if (!s) return [];
  let raw: string | null;
  try {
    raw = s.getItem(KEY);
  } catch {
    return [];
  }
  if (raw == null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('[recent-beats] malformed localStorage value; ignoring');
    return [];
  }
  if (!Array.isArray(parsed)) {
    console.warn('[recent-beats] localStorage value is not an array; ignoring');
    return [];
  }
  return parsed.filter((x): x is string => typeof x === 'string');
}

export function addRecentBeat(id: string): void {
  const s = getStorage();
  if (!s) return;
  try {
    const current = loadRecentBeats().filter(x => x !== id);
    const next = [id, ...current].slice(0, CAP);
    s.setItem(KEY, JSON.stringify(next));
  } catch {
    console.warn('[recent-beats] failed to write recents; ignoring');
  }
}
```

- [ ] **Step 4: Run — expect ALL PASS**

```bash
npx vitest run lib/recent-beats.test.ts
```
Expected: 13 pass (7 loadRecentBeats + 6 addRecentBeat).

- [ ] **Step 5: Commit**

```bash
git add lib/recent-beats.ts lib/recent-beats.test.ts
git commit -m "feat(recent-beats): localStorage helper for recently-played beats"
```

---

### Task 4: `app/yt/page.tsx` placeholder route

**Files:**
- Create: `app/yt/page.tsx`

- [ ] **Step 1: Write the placeholder page**

```tsx
// app/yt/page.tsx
import Link from 'next/link';

export default function YtPlaceholder() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-extrabold">YouTube Mode</h1>
      <p className="text-white/70">Coming soon.</p>
      <Link href="/" className="text-white/60 hover:text-white">← Back</Link>
    </main>
  );
}
```

- [ ] **Step 2: Smoke-test the route locally**

```bash
npm run dev
```
Open `http://localhost:3000/yt` in a browser. Expected: middleware redirects to `/login` if unauthenticated; after logging in, the page renders "YouTube Mode / Coming soon. / ← Back". Confirm the ← Back link returns to `/`. Stop the dev server (Ctrl-C) when done.

- [ ] **Step 3: Run the existing test suite (sanity)**

```bash
npx vitest run
```
Expected: all tests pass (no new test files in this task; just verifying the project still type-checks under `vitest`).

- [ ] **Step 4: Commit**

```bash
git add app/yt/page.tsx
git commit -m "feat(yt): placeholder route for future YouTube gameplay"
```

---

### Task 5: `components/BrowseBeats.tsx` modal component + `computePreviewStart` tests

**Files:**
- Create: `components/BrowseBeats.tsx`
- Create: `components/BrowseBeats.test.ts`

This task creates a single new client component. Because vitest is in `node` environment (no jsdom), the React tree itself is verified manually; only the pure exported helper `computePreviewStart` is unit-tested.

- [ ] **Step 1: Write the failing test for `computePreviewStart`**

```ts
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
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npx vitest run components/BrowseBeats.test.ts
```
Expected: FAIL — "Cannot find module './BrowseBeats'".

- [ ] **Step 3: Implement `components/BrowseBeats.tsx`**

```tsx
// components/BrowseBeats.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Beat } from '@/lib/beats';
import {
  buildSectionLists, availableCategories,
  type BpmBucket, type CategoryChip, type FilterCriteria,
} from '@/lib/beat-filters';
import { loadRecentBeats } from '@/lib/recent-beats';

type Props = {
  beats: Beat[];                       // typically allBeats = [...BEATS, ...ytCatalog]
  selectedId: string | null;
  onChange: (id: string) => void;
  onClose: () => void;
};

const AUTO_STOP_MS = 8000;

export function computePreviewStart(beat: Beat, duration: number): number {
  const desired = beat.previewOffset ?? ((beat.startOffset ?? 0) + 8);
  return Math.min(desired, Math.max(0, duration - 1));
}

export function BrowseBeats({ beats, selectedId, onChange, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState<BpmBucket>('all');
  const [category, setCategory] = useState<CategoryChip | 'all'>('all');
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Read recents after mount (avoid SSR/hydration mismatch).
  useEffect(() => { setRecentIds(loadRecentBeats()); }, []);

  // Focus the close button on mount; cleanup pauses preview + clears timer on unmount.
  useEffect(() => {
    closeBtnRef.current?.focus();
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    };
  }, []);

  // Esc closes the modal.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const criteria: FilterCriteria = { bucket, category, query };
  const { recents, main, emptyAfterFilter } = useMemo(
    () => buildSectionLists(beats, recentIds, criteria),
    [beats, recentIds, bucket, category, query],
  );
  const cats = useMemo(() => availableCategories(beats), [beats]);

  function stopPreview() {
    if (audioRef.current) { audioRef.current.pause(); }
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    setPreviewingId(null);
  }

  function startPreview(beat: Beat) {
    stopPreview();
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    audio.src = beat.src;
    const onMeta = () => {
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.currentTime = computePreviewStart(beat, audio.duration || 0);
      audio.play().catch(() => {
        console.warn('[BrowseBeats] preview play failed');
        setPreviewingId(null);
      });
      stopTimerRef.current = setTimeout(stopPreview, AUTO_STOP_MS);
    };
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('error', () => {
      console.warn('[BrowseBeats] preview audio error');
      setPreviewingId(null);
    }, { once: true });
    setPreviewingId(beat.id);
  }

  function togglePreview(beat: Beat) {
    if (previewingId === beat.id) stopPreview();
    else startPreview(beat);
  }

  function clearFilters() {
    setQuery('');
    setBucket('all');
    setCategory('all');
  }

  function handleClose() {
    stopPreview();
    onClose();
  }

  function renderRow(beat: Beat) {
    const isSelected = beat.id === selectedId;
    const isPreviewing = previewingId === beat.id;
    return (
      <div
        key={beat.id}
        role="button"
        tabIndex={0}
        onClick={() => onChange(beat.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(beat.id); } }}
        aria-label={`${beat.title}, ${beat.bpm} BPM, ${beat.source === 'youtube' ? 'youtube' : beat.category}`}
        aria-current={isSelected ? 'true' : undefined}
        className={[
          'flex items-center gap-3 rounded-xl p-2 mb-1',
          isSelected ? 'bg-rhyme-yellow/16 outline outline-1 outline-rhyme-yellow' : 'bg-white/[0.03] hover:bg-white/[0.08]',
        ].join(' ')}
      >
        <div className="text-rhyme-yellow font-extrabold text-xl w-12 text-center leading-none">
          {Number.isInteger(beat.bpm) ? beat.bpm : beat.bpm.toFixed(1)}
          <small className="block text-[9px] text-white/40 mt-0.5">BPM</small>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate">{beat.title}</div>
          <div className="text-[10px] text-white/50 uppercase tracking-wide">
            {beat.source === 'youtube' ? 'youtube' : beat.category}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); togglePreview(beat); }}
          aria-label={isPreviewing ? 'Stop preview' : 'Preview beat'}
          className={[
            'h-8 w-8 rounded-full text-xs flex items-center justify-center shrink-0',
            isPreviewing ? 'bg-rhyme-yellow text-bg' : 'bg-white/15 hover:bg-white/25',
          ].join(' ')}
        >
          {isPreviewing ? '▮▮' : '▶'}
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Browse beats"
      className="fixed inset-0 z-50 bg-bg text-white flex flex-col"
    >
      <div className="flex items-center px-4 pt-4">
        <strong className="text-lg">Browse beats</strong>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="ml-auto h-11 w-11 rounded-full bg-white/10 text-base flex items-center justify-center"
        >
          ✕
        </button>
      </div>

      <div className="px-4 pt-3">
        <input
          type="search"
          placeholder="Search by title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl bg-white/[0.06] px-3 py-2 text-sm placeholder:text-white/40 outline-none"
        />
      </div>

      <div className="px-4 pt-3 flex flex-wrap gap-2">
        {([
          ['all',  'All BPM'],
          ['slow', '<85'],
          ['mid',  '85-100'],
          ['fast', '>100'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setBucket(key)}
            aria-pressed={bucket === key}
            className={[
              'rounded-full px-3 py-1 text-xs font-bold',
              bucket === key ? 'bg-rhyme-yellow text-bg' : 'bg-white/[0.08] text-white',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory('all')}
          aria-pressed={category === 'all'}
          className={[
            'rounded-full px-3 py-1 text-[11px] font-semibold',
            category === 'all' ? 'bg-white/20 text-white' : 'bg-white/[0.04] text-white/50',
          ].join(' ')}
        >
          all categories
        </button>
        {cats.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            aria-pressed={category === cat}
            className={[
              'rounded-full px-3 py-1 text-[11px] font-semibold',
              category === cat ? 'bg-white/20 text-white' : 'bg-white/[0.04] text-white/50',
            ].join(' ')}
          >
            {cat === 'youtube' ? 'YouTube' : cat}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        {beats.length === 0 ? (
          <p className="text-center text-white/60 mt-12">No beats added yet</p>
        ) : emptyAfterFilter ? (
          <div className="text-center mt-12">
            <p className="text-white/60">No beats match these filters.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 text-rhyme-yellow underline text-sm"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            {recents.length > 0 && (
              <>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">★ Recently played</div>
                {recents.map(renderRow)}
              </>
            )}
            <div className="text-[10px] uppercase tracking-wider text-white/40 mt-4 mb-2">All beats — sorted by BPM</div>
            {main.map(renderRow)}
          </>
        )}
      </div>

      <div className="sticky bottom-0 left-0 right-0 p-4 bg-bg/80 backdrop-blur-sm">
        <button
          type="button"
          onClick={handleClose}
          className="w-full rounded-2xl bg-rhyme-yellow text-bg font-extrabold py-3 text-base"
        >
          Done
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the `computePreviewStart` tests — expect PASS**

```bash
npx vitest run components/BrowseBeats.test.ts
```
Expected: 5 of 5 pass.

- [ ] **Step 5: Re-run the entire suite (sanity)**

```bash
npx vitest run
```
Expected: all tests pass; no regressions.

- [ ] **Step 6: Commit**

```bash
git add components/BrowseBeats.tsx components/BrowseBeats.test.ts
git commit -m "feat(BrowseBeats): full-screen modal for filterable beat browsing"
```

---

### Task 6: Wire `<BrowseBeats />` into `Setup.tsx` and delete the old `BeatPicker`

**Files:**
- Modify: `components/Setup.tsx`
- Delete: `components/BeatPicker.tsx`
- Delete: `components/BeatPicker.test.tsx`

- [ ] **Step 1: Read the current `components/Setup.tsx` and locate the `<BeatPicker />` invocation**

The existing render block looks like:

```tsx
<BeatPicker beats={allBeats} selectedId={beatId} onChange={chooseBeat} />
```

It will be replaced by a tappable summary card and a conditionally-rendered `<BrowseBeats />`.

- [ ] **Step 2: Update the imports at the top of `Setup.tsx`**

Replace:

```tsx
import { BeatPicker } from './BeatPicker';
```

with:

```tsx
import { BrowseBeats } from './BrowseBeats';
```

- [ ] **Step 3: Add `browseOpen` state next to the other `useState` calls**

In the component body, after the existing `useState` declarations:

```tsx
const [browseOpen, setBrowseOpen] = useState(false);
```

- [ ] **Step 4: Derive `selectedBundled` and replace the `<BeatPicker .../>` line with the summary card**

The summary card must reflect the **picker selection** (bundled or catalog), independent of any loaded YT-URL beat in `ytState`. Otherwise, the card duplicates the YT pill below and points at a beat the modal won't highlight.

First, refactor the existing `activeBeat` derivation to expose `selectedBundled` separately. Find:

```tsx
const activeBeat: Beat | null =
  ytState.status === 'loaded' ? ytState.beat :
  beatId ? (pickBeat(beatId) ?? allBeats.find(b => b.id === beatId) ?? null) : null;
```

Replace with:

```tsx
const selectedBundled: Beat | null =
  beatId ? (pickBeat(beatId) ?? allBeats.find(b => b.id === beatId) ?? null) : null;

const activeBeat: Beat | null =
  ytState.status === 'loaded' ? ytState.beat : selectedBundled;
```

Then replace:

```tsx
<BeatPicker beats={allBeats} selectedId={beatId} onChange={chooseBeat} />
```

with the summary card driven by `selectedBundled`:

```tsx
<button
  type="button"
  onClick={() => setBrowseOpen(true)}
  className="w-full flex items-center justify-between rounded-2xl bg-white/[0.06] px-4 py-3 text-left"
>
  <span className="font-bold truncate">{selectedBundled?.title ?? 'Pick a beat'}</span>
  <span className="flex items-center gap-2 text-white/60 text-sm">
    {selectedBundled ? `${Number.isInteger(selectedBundled.bpm) ? selectedBundled.bpm : selectedBundled.bpm.toFixed(1)} BPM` : ''}
    <span aria-hidden="true">›</span>
  </span>
</button>
```

- [ ] **Step 5: Render `<BrowseBeats />` conditionally at the bottom of the returned JSX**

Add this just before the closing `</main>` of the Setup component:

```tsx
{browseOpen && (
  <BrowseBeats
    beats={allBeats}
    selectedId={beatId}
    onChange={(id) => { chooseBeat(id); }}
    onClose={() => setBrowseOpen(false)}
  />
)}
```

(`chooseBeat` already clears the YT pill, so the modal's live-select automatically preserves the existing mutual-exclusivity behaviour.)

- [ ] **Step 6: Delete the old picker files**

```bash
git rm components/BeatPicker.tsx components/BeatPicker.test.tsx
```

(The `availableCategories` tests covered by `lib/beat-filters.test.ts` already verify equivalent behavior, including the `source: 'youtube'` virtual chip.)

- [ ] **Step 7: Run the suite — expect ALL PASS**

```bash
npx vitest run
```
Expected: every test passes; no references to `./BeatPicker` remain.

- [ ] **Step 8: Smoke-test in the browser**

```bash
npm run dev
```
Open the app, log in, click the new summary card. Verify:
- The modal opens, lists every beat sorted by BPM ascending
- The bucket chips filter correctly (try `<85`, `85-100`, `>100`)
- The category chips filter correctly (try `boom-bap`, `lo-fi`)
- If any YT catalog beat exists in `/beats/yt-catalog.json`, the "youtube" chip appears and filters to it
- Tap a row → its yellow outline appears and the Setup summary card updates after closing
- ▶ on a row plays a preview clip; ▶ on another row swaps; ▶ again on the playing row stops
- ✕, Done, and Esc all close the modal and stop preview audio
- Search "med" narrows to Medicate (case-insensitive)
- "Clear filters" link appears when filters produce no results and resets them

Stop dev server (Ctrl-C).

- [ ] **Step 9: Commit**

```bash
git add components/Setup.tsx
git commit -m "feat(Setup): replace BeatPicker stepper with BrowseBeats modal"
```

---

### Task 7: Record recent beats in `Game.handlePlay`

**Files:**
- Modify: `components/Game.tsx`

- [ ] **Step 1: Add the import at the top of `Game.tsx`**

After the existing imports, add:

```tsx
import { addRecentBeat } from '@/lib/recent-beats';
```

- [ ] **Step 2: Update `handlePlay` to record the beat**

Find the existing `handlePlay`:

```tsx
function handlePlay(beat: Beat, lang: LanguageId) {
  setActiveBeat(beat);
  setLanguageId(lang);
  setLoadError(null);
  setPhase('loading');
}
```

Replace with:

```tsx
function handlePlay(beat: Beat, lang: LanguageId) {
  addRecentBeat(beat.id);
  setActiveBeat(beat);
  setLanguageId(lang);
  setLoadError(null);
  setPhase('loading');
}
```

(All beats reaching `handlePlay` originate from Setup's `activeBeat` — bundled, catalog, or freshly-loaded YT URL — and have persistent IDs. Stale IDs are filtered out at render time by `buildSectionLists`.)

- [ ] **Step 3: Run the suite — expect ALL PASS**

```bash
npx vitest run
```
Expected: no regressions.

- [ ] **Step 4: Smoke-test recents in the browser**

```bash
npm run dev
```
Pick a beat → press PLAY → wait briefly → press ← (back) to return to Setup → open the modal. Expected: the just-played beat appears in the new "★ Recently played" section at the top. Replay with two more beats and confirm:
- The list orders most-recent-first
- Re-playing the same beat moves it to the top (no duplicate)
- After 6 different beats are played, only the latest 5 remain in recents
- Recents are present after a hard refresh (localStorage persists)

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add components/Game.tsx
git commit -m "feat(Game): record played beats in recents store"
```

---

### Task 8: Add the "Try YouTube mode →" forward-pointer link

**Files:**
- Modify: `components/Setup.tsx`

- [ ] **Step 1: Add the `next/link` import (if not present)**

Near the top of `Setup.tsx`, with the other imports:

```tsx
import Link from 'next/link';
```

- [ ] **Step 2: Insert the link below the YouTube URL block**

The YouTube URL section is wrapped in a `<div className="space-y-1">…</div>` block that lives between the BrowseBeats summary card and the `<LanguagePicker />`. After the closing `</div>` of that block, before the `<LanguagePicker />`, add:

```tsx
<Link
  href="/yt"
  className="block text-center text-xs text-white/50 hover:text-white/80 underline"
>
  Try YouTube mode →
</Link>
```

- [ ] **Step 3: Smoke-test the link**

```bash
npm run dev
```
On the Setup screen, click "Try YouTube mode →". Expected: navigation to `/yt`, which shows "YouTube Mode / Coming soon. / ← Back". Click ← Back; expected: return to Setup with the previous beat selection intact.

Stop dev server.

- [ ] **Step 4: Run the suite (sanity)**

```bash
npx vitest run
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/Setup.tsx
git commit -m "feat(Setup): forward-pointer link to /yt placeholder"
```

---

## Post-implementation manual verification checklist

After all eight tasks are committed:

- [ ] On Setup, the summary card replaces the old ◀ ▶ stepper.
- [ ] Tapping the summary card opens the full-screen BrowseBeats modal.
- [ ] The BPM bucket filter (`<85` / `85-100` / `>100`) and category chips both narrow the list.
- [ ] Selecting a row updates the Setup summary card after the modal closes.
- [ ] Previews start ~8 s into each track and auto-stop after 8 s.
- [ ] Esc, ✕, and the bottom "Done" button all close the modal and stop preview audio.
- [ ] After playing a session, the beat appears in the modal's "★ Recently played" section.
- [ ] The "Try YouTube mode →" link routes to `/yt` and back.
- [ ] The existing YT URL input still works (paste → Load → PLAY).
- [ ] All 21 + 13 + 5 = 39 new unit tests pass under `npx vitest run` and the prior suite still passes.

## Self-review checks performed

- **Spec coverage:** every requirement in `2026-05-14-beat-picker-redesign-design.md` (BPM bucket filter, category filter, search, preview, recents, summary card, YT URL block preserved, `/yt` placeholder, forward-pointer link, `previewOffset` field, deletion of old BeatPicker) maps to a task above.
- **Placeholder scan:** no "TBD", "TODO", "implement later", or unspecified handlers; every step that produces code shows the code.
- **Type consistency:** `BpmBucket`, `CategoryChip`, `FilterCriteria`, `buildSectionLists`, `computePreviewStart`, `loadRecentBeats`, `addRecentBeat` names and shapes are stable across tasks 2, 3, and 5.
- **Order of dependencies:** Task 1 (Beat field) lands before Task 5 consumes it; Tasks 2 & 3 land before Task 5/6/7 import them; Task 4 (route) lands before Task 8 (link).
