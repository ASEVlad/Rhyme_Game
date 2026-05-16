# BrowseBeats Restyle + Click-to-Preview + Random-Pick Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the `BrowseBeats` modal from the legacy yellow theme to the Ice & Chrome palette, make clicking any beat row (in the modal or the desktop inline list on Setup) auto-start a 15-second preview at the 15-second mark, and add a 🎲 random-pick button to the modal.

**Architecture:** Introduce a shared `useBeatPreview` hook that owns preview-audio state (one reused `HTMLAudioElement` per consumer). Use it from both `BrowseBeats.tsx` and `Setup.tsx`'s desktop inline list. `BrowseBeats` also gets a CSS reskin and a new random-pick button driven by a pure `pickRandom` helper.

**Tech Stack:** Next.js 14 / React 18 / TypeScript / Tailwind / Vitest + jsdom / @testing-library/react.

**Spec:** [docs/superpowers/specs/2026-05-16-browse-beats-restyle-design.md](../specs/2026-05-16-browse-beats-restyle-design.md)

---

## Task 1: Create `useBeatPreview` hook with full test coverage

**Files:**
- Create: `hooks/useBeatPreview.ts`
- Test: `hooks/useBeatPreview.test.tsx`

This task introduces the shared preview-audio hook in isolation. We write all tests first, watch them fail, then implement the hook.

- [ ] **Step 1: Create the test file with all hook tests**

Path: `hooks/useBeatPreview.test.tsx`

```tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBeatPreview } from './useBeatPreview';
import type { Beat } from '@/lib/beats';

const beat1: Beat = { id: 'b1', src: '/b1.mp3', title: 'B1', bpm: 90, barsPerLoop: 8, category: 'boom-bap' };
const beat2: Beat = { id: 'b2', src: '/b2.mp3', title: 'B2', bpm: 95, barsPerLoop: 8, category: 'trap' };

let audioInstance: HTMLAudioElement;
let playMock: ReturnType<typeof vi.fn>;
let pauseMock: ReturnType<typeof vi.fn>;
let mockDuration = 60;

beforeEach(() => {
  mockDuration = 60;
  vi.stubGlobal('Audio', vi.fn(() => {
    audioInstance = document.createElement('audio');
    playMock = vi.fn().mockResolvedValue(undefined);
    pauseMock = vi.fn();
    audioInstance.play = playMock as unknown as HTMLAudioElement['play'];
    audioInstance.pause = pauseMock as unknown as HTMLAudioElement['pause'];
    Object.defineProperty(audioInstance, 'duration', { get: () => mockDuration });
    return audioInstance;
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useBeatPreview', () => {
  it('startPreview sets previewingId synchronously', () => {
    const { result } = renderHook(() => useBeatPreview());
    act(() => { result.current.startPreview(beat1); });
    expect(result.current.previewingId).toBe('b1');
  });

  it('on loadedmetadata sets currentTime to 15 and calls play (duration ≥ 16)', () => {
    const { result } = renderHook(() => useBeatPreview());
    act(() => { result.current.startPreview(beat1); });
    act(() => { audioInstance.dispatchEvent(new Event('loadedmetadata')); });
    expect(audioInstance.currentTime).toBe(15);
    expect(playMock).toHaveBeenCalledOnce();
  });

  it('clamps currentTime to duration - 1 when duration < 16', () => {
    mockDuration = 8;
    const { result } = renderHook(() => useBeatPreview());
    act(() => { result.current.startPreview(beat1); });
    act(() => { audioInstance.dispatchEvent(new Event('loadedmetadata')); });
    expect(audioInstance.currentTime).toBe(7);
  });

  it('auto-stops after 15s of fake time', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useBeatPreview());
    act(() => { result.current.startPreview(beat1); });
    act(() => { audioInstance.dispatchEvent(new Event('loadedmetadata')); });
    expect(result.current.previewingId).toBe('b1');
    act(() => { vi.advanceTimersByTime(15000); });
    expect(result.current.previewingId).toBe(null);
    expect(pauseMock).toHaveBeenCalled();
  });

  it('swap startPreview removes the stale loadedmetadata listener', () => {
    const { result } = renderHook(() => useBeatPreview());
    act(() => { result.current.startPreview(beat1); });
    const firstAudio = audioInstance;
    // Switch to beat2 BEFORE beat1 metadata fires.
    act(() => { result.current.startPreview(beat2); });
    expect(audioInstance).toBe(firstAudio); // audio element is reused
    // Dispatch loadedmetadata once; only beat2's listener should be attached.
    act(() => { firstAudio.dispatchEvent(new Event('loadedmetadata')); });
    expect(playMock).toHaveBeenCalledTimes(1);
    expect(result.current.previewingId).toBe('b2');
  });

  it('togglePreview stops when called on currently previewing beat', () => {
    const { result } = renderHook(() => useBeatPreview());
    act(() => { result.current.togglePreview(beat1); });
    expect(result.current.previewingId).toBe('b1');
    act(() => { result.current.togglePreview(beat1); });
    expect(result.current.previewingId).toBe(null);
  });

  it('togglePreview switches when called on a different beat', () => {
    const { result } = renderHook(() => useBeatPreview());
    act(() => { result.current.togglePreview(beat1); });
    act(() => { result.current.togglePreview(beat2); });
    expect(result.current.previewingId).toBe('b2');
  });

  it('unmount cleanup pauses audio and clears any pending timer', () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useBeatPreview());
    act(() => { result.current.startPreview(beat1); });
    act(() => { audioInstance.dispatchEvent(new Event('loadedmetadata')); });
    unmount();
    expect(pauseMock).toHaveBeenCalled();
    // If the timer leaked, advancing past 15s would still call pause again.
    pauseMock.mockClear();
    act(() => { vi.advanceTimersByTime(16000); });
    expect(pauseMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test file — expect it to fail (module not found)**

Run: `npx vitest run hooks/useBeatPreview.test.tsx`
Expected: FAIL — `Cannot find module './useBeatPreview'` or equivalent.

- [ ] **Step 3: Create the hook**

Path: `hooks/useBeatPreview.ts`

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Beat } from '@/lib/beats';

export const PREVIEW_START_SEC = 15;
export const PREVIEW_DURATION_MS = 15000;

export type BeatPreviewHandle = {
  previewingId: string | null;
  startPreview: (beat: Beat) => void;
  togglePreview: (beat: Beat) => void;
  stopPreview: () => void;
};

export function useBeatPreview(): BeatPreviewHandle {
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metaListenerRef = useRef<(() => void) | null>(null);

  const stopPreview = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      if (metaListenerRef.current) {
        audio.removeEventListener('loadedmetadata', metaListenerRef.current);
        metaListenerRef.current = null;
      }
      audio.pause();
    }
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    setPreviewingId(null);
  }, []);

  const startPreview = useCallback((beat: Beat) => {
    stopPreview();
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    audio.loop = false;
    audio.src = beat.src;
    const onMeta = () => {
      audio.currentTime = Math.min(
        PREVIEW_START_SEC,
        Math.max(0, (audio.duration || 0) - 1),
      );
      audio.play().catch(() => setPreviewingId(null));
      stopTimerRef.current = setTimeout(stopPreview, PREVIEW_DURATION_MS);
    };
    audio.addEventListener('loadedmetadata', onMeta);
    metaListenerRef.current = onMeta;
    audio.addEventListener('error', () => setPreviewingId(null), { once: true });
    setPreviewingId(beat.id);
  }, [stopPreview]);

  const togglePreview = useCallback((beat: Beat) => {
    if (previewingId === beat.id) stopPreview();
    else startPreview(beat);
  }, [previewingId, startPreview, stopPreview]);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        if (metaListenerRef.current) {
          audio.removeEventListener('loadedmetadata', metaListenerRef.current);
          metaListenerRef.current = null;
        }
        audio.pause();
      }
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
    };
  }, []);

  return { previewingId, startPreview, togglePreview, stopPreview };
}
```

- [ ] **Step 4: Run the tests — expect all 8 to pass**

Run: `npx vitest run hooks/useBeatPreview.test.tsx`
Expected: PASS — 8/8 tests green.

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: full suite passes (no other tests touch the hook yet).

- [ ] **Step 6: Commit**

```bash
git add hooks/useBeatPreview.ts hooks/useBeatPreview.test.tsx
git commit -m "feat: useBeatPreview hook with 15s start + 15s autostop"
```

---

## Task 2: Reskin `BrowseBeats` to Ice & Chrome (CSS only)

**Files:**
- Modify: `components/BrowseBeats.tsx`

Pure visual swap — no behavior changes. The existing `BrowseBeats.test.ts` (which only tests `computePreviewStart`) keeps passing because `computePreviewStart` is untouched in this task.

- [ ] **Step 1: Replace the modal root + header in `components/BrowseBeats.tsx`**

Locate the JSX block starting with `<div role="dialog" aria-modal="true" aria-label="Browse beats"` and ending at the search input. Replace with:

```tsx
return (
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Browse beats"
    className="bg-[#060c14] text-white flex flex-col h-full"
    style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(94,200,255,0.22) 0%, transparent 100%)' }}
  >
    <div className="flex items-center px-4 pt-4">
      <strong className="text-lg">Browse beats</strong>
      <button
        ref={closeBtnRef}
        type="button"
        onClick={handleClose}
        aria-label="Close"
        className="ml-auto h-11 w-11 rounded-full bg-[rgba(94,200,255,0.08)] border border-[rgba(94,200,255,0.18)] text-base flex items-center justify-center"
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
        className="w-full rounded-xl bg-[rgba(94,200,255,0.06)] border border-[rgba(94,200,255,0.30)] px-3 py-2 text-sm placeholder:text-white/40 outline-none"
      />
    </div>
```

(Random-pick button is added in Task 4 — leave the header as above for now.)

- [ ] **Step 2: Swap BPM-bucket chip classes**

Locate the BPM-bucket chip `map` (`['all','slow','mid','fast']`). Replace the chip `<button>` with:

```tsx
<button
  key={key}
  type="button"
  onClick={() => setBucket(key)}
  aria-pressed={bucket === key}
  className={[
    'rounded-full px-3 py-1 text-xs font-bold',
    bucket === key ? 'text-[#060c14]' : 'bg-[rgba(94,200,255,0.06)] text-white/70',
  ].join(' ')}
  style={bucket === key ? { background: 'linear-gradient(135deg,#5ec8ff,#2860e0)' } : undefined}
>
  {label}
</button>
```

- [ ] **Step 3: Swap category chip classes**

Locate the "all categories" button and the `cats.map(...)` block. Replace both with:

```tsx
<button
  type="button"
  onClick={() => setCategory('all')}
  aria-pressed={category === 'all'}
  className={[
    'rounded-full px-3 py-1 text-[11px] font-semibold',
    category === 'all' ? 'bg-[rgba(94,200,255,0.18)] text-white' : 'bg-[rgba(94,200,255,0.04)] text-white/50',
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
      category === cat ? 'bg-[rgba(94,200,255,0.18)] text-white' : 'bg-[rgba(94,200,255,0.04)] text-white/50',
    ].join(' ')}
  >
    {cat === 'youtube' ? 'YouTube' : cat}
  </button>
))}
```

- [ ] **Step 4: Swap row + BPM color + preview button colors inside `renderRow`**

Replace the body of `renderRow` (keep its signature and structure) with:

```tsx
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
        isSelected
          ? 'bg-[rgba(94,200,255,0.12)] border border-[rgba(94,200,255,0.25)]'
          : 'bg-[rgba(94,200,255,0.04)] hover:bg-[rgba(94,200,255,0.08)]',
      ].join(' ')}
    >
      <div className="text-[#5ec8ff] font-extrabold text-xl w-12 text-center leading-none">
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
          isPreviewing ? 'text-[#060c14]' : 'bg-[rgba(94,200,255,0.10)] hover:bg-[rgba(94,200,255,0.18)]',
        ].join(' ')}
        style={isPreviewing ? { background: 'linear-gradient(135deg,#5ec8ff,#2860e0)' } : undefined}
      >
        {isPreviewing ? '▮▮' : '▶'}
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Swap empty-state "Clear filters" link color and Done button**

Locate the "Clear filters" button and replace its className with:

```tsx
className="mt-3 text-[#5ec8ff] underline text-sm"
```

Locate the sticky footer Done button block at the bottom. Replace with:

```tsx
<div className="sticky bottom-0 left-0 right-0 p-4 bg-[#060c14]/80 backdrop-blur-sm">
  <button
    type="button"
    onClick={handleClose}
    className="w-full rounded-2xl text-[#060c14] font-extrabold py-3 text-base"
    style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', boxShadow: '0 0 24px rgba(94,200,255,0.45)' }}
  >
    Done
  </button>
</div>
```

- [ ] **Step 6: Run tests (existing `BrowseBeats.test.ts` should still pass)**

Run: `npx vitest run components/BrowseBeats.test.ts`
Expected: PASS — `computePreviewStart` is untouched.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: full suite passes.

- [ ] **Step 8: Manually verify the modal**

Run: `npm run dev`
Open the app, click "Browse all / search…" in Setup (desktop, ≥ md breakpoint) or open the picker on mobile (< md). Confirm:
- Modal background is dark navy with a cyan glow at the top.
- BPM numbers are cyan (`#5ec8ff`).
- Selected row has a cyan-tinted background with a thin cyan border.
- Filter chips' active state is the cyan gradient.
- Done button is the cyan gradient.

Note: this is a visual check — if there's no way to launch the UI right now, document the limitation in the commit body and move on. Type-check below covers the static guarantees.

- [ ] **Step 9: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add components/BrowseBeats.tsx
git commit -m "feat: restyle BrowseBeats modal to Ice & Chrome palette"
```

---

## Task 3: Refactor `BrowseBeats` to use `useBeatPreview` + click-row-to-preview

**Files:**
- Modify: `components/BrowseBeats.tsx`
- Delete: `components/BrowseBeats.test.ts`
- Create: `components/BrowseBeats.test.tsx`

This task removes the local preview state in `BrowseBeats` and replaces it with the shared hook, removes the unused `computePreviewStart` + its old test file, and changes row-click to both select AND start a preview. New jsdom tests cover the new behavior.

- [ ] **Step 1: Write the new test file `components/BrowseBeats.test.tsx`**

```tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Beat } from '@/lib/beats';

const startPreviewMock = vi.fn();
const togglePreviewMock = vi.fn();
const stopPreviewMock = vi.fn();
let previewingIdValue: string | null = null;

vi.mock('@/hooks/useBeatPreview', () => ({
  useBeatPreview: () => ({
    previewingId: previewingIdValue,
    startPreview: startPreviewMock,
    togglePreview: togglePreviewMock,
    stopPreview: stopPreviewMock,
  }),
  PREVIEW_START_SEC: 15,
  PREVIEW_DURATION_MS: 15000,
}));

vi.mock('@/lib/recent-beats', () => ({
  loadRecentBeats: () => [],
}));

import { BrowseBeats } from './BrowseBeats';

const beats: Beat[] = [
  { id: 'b1', src: '/b1.mp3', title: 'Beat One', bpm: 80, barsPerLoop: 8, category: 'boom-bap' },
  { id: 'b2', src: '/b2.mp3', title: 'Beat Two', bpm: 92, barsPerLoop: 8, category: 'trap' },
  { id: 'b3', src: '/b3.mp3', title: 'Beat Three', bpm: 105, barsPerLoop: 8, category: 'drill' },
];

const noop = () => {};

beforeEach(() => {
  startPreviewMock.mockReset();
  togglePreviewMock.mockReset();
  stopPreviewMock.mockReset();
  previewingIdValue = null;
});

describe('BrowseBeats — click-to-preview', () => {
  it('clicking a row calls onChange and startPreview with the same beat', () => {
    const onChange = vi.fn();
    render(<BrowseBeats beats={beats} selectedId={null} onChange={onChange} onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Beat One, 80 BPM/i }));
    expect(onChange).toHaveBeenCalledWith('b1');
    expect(startPreviewMock).toHaveBeenCalledWith(beats[0]);
  });

  it('clicking the preview ▶ button calls togglePreview without changing selection', () => {
    const onChange = vi.fn();
    render(<BrowseBeats beats={beats} selectedId={null} onChange={onChange} onClose={noop} />);
    // Three rows → three "Preview beat" buttons; click the first.
    const previewButtons = screen.getAllByRole('button', { name: 'Preview beat' });
    fireEvent.click(previewButtons[0]);
    expect(togglePreviewMock).toHaveBeenCalled();
    // First arg of first call is some beat from `beats`
    expect(beats).toContain(togglePreviewMock.mock.calls[0][0]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('close handler stops preview', () => {
    const onClose = vi.fn();
    render(<BrowseBeats beats={beats} selectedId={null} onChange={noop} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(stopPreviewMock).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('BrowseBeats — filters & rendering', () => {
  it('renders all beats when no filters are applied', () => {
    render(<BrowseBeats beats={beats} selectedId={null} onChange={noop} onClose={noop} />);
    expect(screen.getByText('Beat One')).toBeInTheDocument();
    expect(screen.getByText('Beat Two')).toBeInTheDocument();
    expect(screen.getByText('Beat Three')).toBeInTheDocument();
  });

  it('search input filters by title (case-insensitive substring)', () => {
    render(<BrowseBeats beats={beats} selectedId={null} onChange={noop} onClose={noop} />);
    fireEvent.change(screen.getByPlaceholderText(/Search by title/i), { target: { value: 'three' } });
    expect(screen.queryByText('Beat One')).not.toBeInTheDocument();
    expect(screen.getByText('Beat Three')).toBeInTheDocument();
  });

  it('BPM bucket chip filters out non-matching beats', () => {
    render(<BrowseBeats beats={beats} selectedId={null} onChange={noop} onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: '<85' }));
    expect(screen.getByText('Beat One')).toBeInTheDocument();
    expect(screen.queryByText('Beat Two')).not.toBeInTheDocument();
    expect(screen.queryByText('Beat Three')).not.toBeInTheDocument();
  });

  it('shows empty-state message and a Clear filters action when filters exclude everything', () => {
    render(<BrowseBeats beats={beats} selectedId={null} onChange={noop} onClose={noop} />);
    fireEvent.change(screen.getByPlaceholderText(/Search by title/i), { target: { value: 'zzz' } });
    expect(screen.getByText(/No beats match/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Clear filters/i }));
    expect(screen.getByText('Beat One')).toBeInTheDocument();
  });
});

describe('BrowseBeats — keyboard', () => {
  it('Escape closes the modal', () => {
    const onClose = vi.fn();
    render(<BrowseBeats beats={beats} selectedId={null} onChange={noop} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the new test file — expect failures**

Run: `npx vitest run components/BrowseBeats.test.tsx`
Expected: FAIL — the row's `onClick` doesn't yet call `startPreview`, so `startPreviewMock` won't have been called. Some tests may pass (filters, escape, close) since that behavior already exists.

- [ ] **Step 3: Update `components/BrowseBeats.tsx` to use the shared hook**

Replace the imports at the top of the file with the following. `useCallback` is no longer needed; `useRef` stays for `closeBtnRef`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Beat } from '@/lib/beats';
import {
  buildSectionLists, availableCategories,
  type BpmBucket, type CategoryChip,
} from '@/lib/beat-filters';
import { loadRecentBeats } from '@/lib/recent-beats';
import { useBeatPreview } from '@/hooks/useBeatPreview';
```

Remove the exported `computePreviewStart` function and the `AUTO_STOP_MS` constant. Remove `audioRef`, `stopTimerRef`, and the local `previewingId` state. Remove the local `stopPreview` / `startPreview` / `togglePreview` definitions.

Inside the `BrowseBeats` component, near the other hooks, add:

```tsx
const { previewingId, startPreview, togglePreview, stopPreview } = useBeatPreview();
```

Update the cleanup effect that focuses the close button and pauses preview on unmount. Replace the original effect with:

```tsx
useEffect(() => {
  closeBtnRef.current?.focus();
  // hook handles its own cleanup; nothing extra here
}, []);
```

Update `handleClose` to call the hook's `stopPreview`:

```tsx
function handleClose() {
  stopPreview();
  onClose();
}
```

- [ ] **Step 4: Update `renderRow` so the row click also starts a preview**

Update the row's `onClick` and `onKeyDown` handlers (the styling block from Task 2 remains the same):

```tsx
onClick={() => { onChange(beat.id); startPreview(beat); }}
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onChange(beat.id);
    startPreview(beat);
  }
}}
```

The ▶ button keeps `togglePreview(beat)` and `e.stopPropagation()` — unchanged from Task 2.

- [ ] **Step 5: Delete the old `.ts` test file**

Run:

```bash
git rm components/BrowseBeats.test.ts
```

- [ ] **Step 6: Run the new test file**

Run: `npx vitest run components/BrowseBeats.test.tsx`
Expected: PASS — all tests green.

- [ ] **Step 7: Type-check + full suite**

Run:
```bash
npx tsc --noEmit
npm test
```
Expected: zero TS errors; full suite passes.

- [ ] **Step 8: Commit**

```bash
git add components/BrowseBeats.tsx components/BrowseBeats.test.tsx components/BrowseBeats.test.ts
git commit -m "feat: BrowseBeats uses useBeatPreview, click-row starts 15s preview"
```

---

## Task 4: Add `pickRandom` helper + 🎲 random-pick button to `BrowseBeats`

**Files:**
- Modify: `components/BrowseBeats.tsx`
- Modify: `components/BrowseBeats.test.tsx`

- [ ] **Step 1: Append tests to `components/BrowseBeats.test.tsx`**

Append the following `describe` blocks at the end of the file:

```tsx
import { pickRandom } from './BrowseBeats';

describe('pickRandom', () => {
  it('returns null for an empty array', () => {
    expect(pickRandom([])).toBeNull();
  });

  it('returns the first element when Math.random returns 0', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickRandom(['a', 'b', 'c'])).toBe('a');
    spy.mockRestore();
  });

  it('returns the last element when Math.random returns just below 1', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.9999);
    expect(pickRandom(['a', 'b', 'c'])).toBe('c');
    spy.mockRestore();
  });
});

describe('BrowseBeats — random-pick button', () => {
  it('renders the random-pick button', () => {
    render(<BrowseBeats beats={beats} selectedId={null} onChange={noop} onClose={noop} />);
    expect(screen.getByRole('button', { name: /Pick a random beat/i })).toBeInTheDocument();
  });

  it('clicking calls onChange and startPreview for the picked beat', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0); // → index 0 of the filtered pool
    const onChange = vi.fn();
    render(<BrowseBeats beats={beats} selectedId={null} onChange={onChange} onClose={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /Pick a random beat/i }));
    // Pool ordering after buildSectionLists sorts by BPM ascending: b1 (80), b2 (92), b3 (105).
    expect(onChange).toHaveBeenCalledWith('b1');
    expect(startPreviewMock).toHaveBeenCalledWith(beats[0]);
    spy.mockRestore();
  });

  it('is disabled when filters produce an empty pool', () => {
    render(<BrowseBeats beats={beats} selectedId={null} onChange={noop} onClose={noop} />);
    fireEvent.change(screen.getByPlaceholderText(/Search by title/i), { target: { value: 'zzz' } });
    expect(screen.getByRole('button', { name: /Pick a random beat/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the tests — expect failures**

Run: `npx vitest run components/BrowseBeats.test.tsx`
Expected: FAIL — `pickRandom` does not exist; "Pick a random beat" button is not in the DOM.

- [ ] **Step 3: Add the `pickRandom` helper and the 🎲 button to `BrowseBeats.tsx`**

At module scope (above the `BrowseBeats` component), add:

```tsx
export function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}
```

Inside the component, after `const { recents, main, emptyAfterFilter } = useMemo(...)`, compute the random-pick pool:

```tsx
const randomPool = useMemo(() => [...recents, ...main], [recents, main]);

function handleRandomPick() {
  const beat = pickRandom(randomPool);
  if (!beat) return;
  onChange(beat.id);
  startPreview(beat);
}
```

Replace the modal header `<div className="flex items-center px-4 pt-4">` block (from Task 2) with a version that adds the 🎲 button beside the close ✕ in a right-aligned group:

```tsx
<div className="flex items-center px-4 pt-4">
  <strong className="text-lg">Browse beats</strong>
  <div className="ml-auto flex items-center gap-2">
    <button
      type="button"
      onClick={handleRandomPick}
      aria-label="Pick a random beat"
      disabled={randomPool.length === 0}
      className="h-11 w-11 rounded-full bg-[rgba(94,200,255,0.08)] border border-[rgba(94,200,255,0.18)] text-base flex items-center justify-center disabled:opacity-40"
    >
      🎲
    </button>
    <button
      ref={closeBtnRef}
      type="button"
      onClick={handleClose}
      aria-label="Close"
      className="h-11 w-11 rounded-full bg-[rgba(94,200,255,0.08)] border border-[rgba(94,200,255,0.18)] text-base flex items-center justify-center"
    >
      ✕
    </button>
  </div>
</div>
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run components/BrowseBeats.test.tsx`
Expected: PASS — all tests green including the new `pickRandom` + 🎲 button suites.

- [ ] **Step 5: Type-check + full suite**

Run:
```bash
npx tsc --noEmit
npm test
```
Expected: zero TS errors; full suite passes.

- [ ] **Step 6: Manual verification (optional)**

Run: `npm run dev`. Open the modal, click 🎲 — a beat row should become selected and a preview should start at the 15s mark. Apply a filter that excludes all beats (e.g. search "zzz") — the 🎲 button should be visibly dimmed and unclickable.

- [ ] **Step 7: Commit**

```bash
git add components/BrowseBeats.tsx components/BrowseBeats.test.tsx
git commit -m "feat: add 🎲 random-pick to BrowseBeats with pickRandom helper"
```

---

## Task 5: Setup desktop list — click-to-preview + now-playing indicator

**Files:**
- Modify: `components/Setup.tsx`
- Create: `components/Setup.preview.test.tsx`

The desktop inline beat list inside `Setup.tsx` (visible at `md:` and above) currently only selects on click. We give it the same click-to-preview behavior via the shared hook, plus a small ▮▮ indicator on whichever row is currently previewing.

- [ ] **Step 1: Write the new test file**

Path: `components/Setup.preview.test.tsx`

```tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { Beat } from '@/lib/beats';

const startPreviewMock = vi.fn();
let previewingIdValue: string | null = null;

vi.mock('@/hooks/useBeatPreview', () => ({
  useBeatPreview: () => ({
    previewingId: previewingIdValue,
    startPreview: startPreviewMock,
    togglePreview: vi.fn(),
    stopPreview: vi.fn(),
  }),
  PREVIEW_START_SEC: 15,
  PREVIEW_DURATION_MS: 15000,
}));

vi.mock('@/lib/beats', async () => {
  const mod = await vi.importActual<typeof import('@/lib/beats')>('@/lib/beats');
  const BEATS: Beat[] = [
    { id: 'b1', src: '/b1.mp3', title: 'Beat One', bpm: 80, barsPerLoop: 8, category: 'boom-bap' },
    { id: 'b2', src: '/b2.mp3', title: 'Beat Two', bpm: 95, barsPerLoop: 8, category: 'trap' },
  ];
  return { ...mod, BEATS, pickBeat: (id: string) => BEATS.find(b => b.id === id) };
});

vi.mock('@/lib/language-storage', () => ({
  loadLanguage: () => 'en',
  saveLanguage: () => {},
}));

// Disable the YT catalog fetch so the desktop list shows only the bundled BEATS.
beforeEach(() => {
  startPreviewMock.mockReset();
  previewingIdValue = null;
  (global as any).fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => [] });
});

import { Setup } from './Setup';

describe('Setup — desktop inline beat list', () => {
  it('clicking a beat row calls startPreview', () => {
    render(
      <Setup
        initialBeatId={null}
        initialLanguageId="en"
        onPlay={() => {}}
        onLogout={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Beat Two/i }));
    expect(startPreviewMock).toHaveBeenCalled();
    expect(startPreviewMock.mock.calls[0][0].id).toBe('b2');
  });

  it('renders the ▮▮ now-playing indicator on the previewing row', () => {
    previewingIdValue = 'b1';
    render(
      <Setup
        initialBeatId={null}
        initialLanguageId="en"
        onPlay={() => {}}
        onLogout={() => {}}
      />,
    );
    const row = screen.getByRole('button', { name: /Beat One/i });
    expect(within(row).getByText('▮▮')).toBeInTheDocument();
    const otherRow = screen.getByRole('button', { name: /Beat Two/i });
    expect(within(otherRow).queryByText('▮▮')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the new test — expect failures**

Run: `npx vitest run components/Setup.preview.test.tsx`
Expected: FAIL — `startPreviewMock` never called because the desktop list doesn't yet call it; the ▮▮ text is not in the DOM.

- [ ] **Step 3: Wire the hook into `components/Setup.tsx`**

At the top of `components/Setup.tsx`, add the import:

```tsx
import { useBeatPreview } from '@/hooks/useBeatPreview';
```

Inside the `Setup` component, near the other hooks (e.g. just after `const [showAll, setShowAll] = useState(false);`), add:

```tsx
const { previewingId, startPreview } = useBeatPreview();
```

Do NOT modify `chooseBeat` — keep it as-is. The desktop list's row click will call both `chooseBeat(b.id)` and `startPreview(b)` inline (Step 4 below), which keeps `chooseBeat` ignorant of preview and avoids any declaration-order question with `allBeats`. The modal already triggers preview through its own row-click in `BrowseBeats` (from Task 3), so the modal path is unaffected.

- [ ] **Step 4: Add the ▮▮ indicator inside the desktop inline list**

Locate the desktop inline list inside `Setup.tsx` — the `<div className="hidden md:block rounded-2xl ...">` block containing the `allBeats.map(b => (...))` loop. Replace the inner `<button>` with:

```tsx
<button
  key={b.id}
  type="button"
  onClick={() => { chooseBeat(b.id); startPreview(b); }}
  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-[rgba(94,200,255,0.06)] transition-colors ${
    b.id === beatId && beatSource === 'local'
      ? 'bg-[rgba(94,200,255,0.12)] text-white'
      : 'text-white/70'
  }`}
>
  <span className="truncate">{b.title}</span>
  <span className="flex items-center gap-2 ml-2 shrink-0">
    {previewingId === b.id && (
      <span aria-hidden="true" className="text-[#5ec8ff] text-xs">▮▮</span>
    )}
    <span className="text-white/40 text-xs">
      {Number.isInteger(b.bpm) ? b.bpm : b.bpm.toFixed(1)} BPM
    </span>
  </span>
</button>
```

- [ ] **Step 5: Run the new test**

Run: `npx vitest run components/Setup.preview.test.tsx`
Expected: PASS.

- [ ] **Step 6: Type-check + full suite**

Run:
```bash
npx tsc --noEmit
npm test
```
Expected: zero TS errors; full suite passes.

- [ ] **Step 7: Manual verification (optional)**

Run: `npm run dev`. On the Setup screen at desktop width, click a beat in the inline list — the row should become selected, a preview should start at 15s, and a small cyan ▮▮ should appear beside that row's BPM number. After 15s the indicator disappears and the audio stops.

- [ ] **Step 8: Commit**

```bash
git add components/Setup.tsx components/Setup.preview.test.tsx
git commit -m "feat: Setup desktop list — click-to-preview at 15s + now-playing indicator"
```

---

## Final verification

- [ ] **Step 1: Run the entire test suite once more**

Run: `npm test`
Expected: every test green.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: clean Next.js build, no compile errors.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`. Walk through:
1. Open the Setup screen at mobile width — tap "Pick a beat" — modal opens in Ice & Chrome theme.
2. Tap 🎲 — a beat becomes selected, preview plays from ~15s, stops after 15s.
3. Tap a different beat row — preview swaps to it; selection updates.
4. Open Setup at desktop width — click a beat in the inline list — preview starts, ▮▮ appears beside that row, stops after 15s.
5. Click "Browse all / search…" — modal opens with the same restyled look.
6. Filter to an empty pool (search "zzzz") — 🎲 disabled.
