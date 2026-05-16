# BrowseBeats restyle + click-to-preview at 15s

**Date:** 2026-05-16
**Type:** UI redesign + small UX change

## Summary

Two changes scoped to the beat-picking experience on the Setup screen:

1. Restyle the `BrowseBeats` modal from the legacy yellow theme to the existing Ice & Chrome (cyan/navy) palette so it matches the rest of [Setup.tsx](../../../components/Setup.tsx).
2. Change preview behavior: clicking a beat row anywhere (the modal AND the desktop inline list) selects the beat AND auto-starts a preview at the 15-second mark; the preview auto-stops 15 seconds later.
3. Add a 🎲 random-pick button to the `BrowseBeats` modal header. It picks a uniformly random beat from the currently-filtered list, selects it, and auto-starts the 15s preview.

Game playback (after PLAY) is **not** affected by the 15s rule — it still begins at the start of the song.

## Files touched

| File | Status | Purpose |
|---|---|---|
| [hooks/useBeatPreview.ts](../../../hooks/useBeatPreview.ts) | NEW | Shared preview-audio state/logic |
| [hooks/useBeatPreview.test.tsx](../../../hooks/useBeatPreview.test.tsx) | NEW | jsdom unit tests for the hook |
| [components/BrowseBeats.tsx](../../../components/BrowseBeats.tsx) | CHANGED | Re-skin + use shared hook + click-row-to-preview |
| [components/BrowseBeats.test.ts](../../../components/BrowseBeats.test.ts) | DELETED | Only tested `computePreviewStart`, which is being removed |
| [components/BrowseBeats.test.tsx](../../../components/BrowseBeats.test.tsx) | NEW | jsdom tests for row click → preview, random-pick button, and `pickRandom` |
| [components/Setup.tsx](../../../components/Setup.tsx) | CHANGED | Desktop inline list uses the hook; "now-playing" indicator on previewing row |
| [components/Setup.preview.test.tsx](../../../components/Setup.preview.test.tsx) | NEW | jsdom render test for click-to-preview on the desktop list |

No new dependencies. No changes to `hooks/useBeat.ts`, no changes to the Beat type, no changes to `lib/beat-filters.ts`, no changes to `/yt`.

## Visual restyle: BrowseBeats → Ice & Chrome

Class-only swaps inside `components/BrowseBeats.tsx`. Layout, filter ordering, recents/main sections, focus-trap, and Esc handling are unchanged.

| Element | Today | After |
|---|---|---|
| modal root | `bg-bg text-white` | `bg-[#060c14] text-white` plus inline `style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(94,200,255,0.22) 0%, transparent 100%)' }}` |
| selected row | `bg-rhyme-yellow/16 outline outline-1 outline-rhyme-yellow` | `bg-[rgba(94,200,255,0.12)] border border-[rgba(94,200,255,0.25)]` |
| unselected row | `bg-white/[0.03] hover:bg-white/[0.08]` | `bg-[rgba(94,200,255,0.04)] hover:bg-[rgba(94,200,255,0.08)]` |
| BPM number | `text-rhyme-yellow` | `text-[#5ec8ff]` |
| BPM "BPM" label | `text-white/40` | unchanged |
| BPM-bucket chip (active) | `bg-rhyme-yellow text-bg` | inline `style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)' }}` + `text-[#060c14]` |
| BPM-bucket chip (inactive) | `bg-white/[0.08] text-white` | `bg-[rgba(94,200,255,0.06)] text-white/70` |
| category chip (active) | `bg-white/20 text-white` | `bg-[rgba(94,200,255,0.18)] text-white` |
| category chip (inactive) | `bg-white/[0.04] text-white/50` | `bg-[rgba(94,200,255,0.04)] text-white/50` |
| preview ▶ button (previewing) | `bg-rhyme-yellow text-bg` | cyan gradient + `text-[#060c14]` |
| preview ▶ button (idle) | `bg-white/15 hover:bg-white/25` | `bg-[rgba(94,200,255,0.10)] hover:bg-[rgba(94,200,255,0.18)]` |
| search input | `bg-white/[0.06]` | `bg-[rgba(94,200,255,0.06)] border border-[rgba(94,200,255,0.30)]` |
| close ✕ button | `bg-white/10` | `bg-[rgba(94,200,255,0.08)] border border-[rgba(94,200,255,0.18)]` |
| sticky footer bg | `bg-bg/80` | `bg-[#060c14]/80` |
| Done button | `bg-rhyme-yellow text-bg` | cyan gradient + `text-[#060c14]` + `boxShadow: '0 0 24px rgba(94,200,255,0.45)'` |
| "Clear filters" link | `text-rhyme-yellow` | `text-[#5ec8ff]` |
| "Recently played" / "All beats" headers | `text-white/40` | unchanged |

Aria attributes, role values, focus management — all unchanged.

## Click-to-preview behavior

### Shared hook: `hooks/useBeatPreview.ts`

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

export function useBeatPreview(): BeatPreviewHandle { /* … */ }
```

**Internal state (all `useRef`):**
- `audioRef: HTMLAudioElement | null` — reused across previews; lazy-constructed on first call.
- `stopTimerRef: ReturnType<typeof setTimeout> | null` — auto-stop timer handle.
- `metaListenerRef: (() => void) | null` — last attached `loadedmetadata` handler, so we can `removeEventListener` it before attaching a new one.

Plus React state: `previewingId: string | null`.

**Behavior:**
- `startPreview(beat)`: calls `stopPreview()` first (which also removes any pending `loadedmetadata` listener via `metaListenerRef`); sets `audio.loop = false`; sets `audio.src = beat.src`; attaches a fresh `loadedmetadata` listener that does `audio.currentTime = Math.min(15, Math.max(0, (audio.duration || 0) - 1))` then `audio.play().catch(...)`; schedules `setTimeout(stopPreview, 15000)`; sets `previewingId = beat.id`.
- `togglePreview(beat)`: if `previewingId === beat.id`, calls `stopPreview`; otherwise `startPreview(beat)`.
- `stopPreview()`: pauses audio if present; removes `metaListenerRef` if non-null and clears the ref; clears `stopTimerRef` and nulls it; sets `previewingId = null`.
- Failed `play()` or audio `error` event → reset `previewingId` to null (no UI toast — matches current silent-fail behavior).
- Effect cleanup on unmount: same as `stopPreview` plus null `audioRef`.

**Edge cases:**
- Beat duration unknown at construction time → wait for `loadedmetadata`. Until then, audio doesn't play.
- Duration < 16s → start clamps to `max(0, duration - 1)`. Auto-stop timer fires at 15s but the audio naturally ends sooner (`loop=false`).
- Rapid clicks across different beats → `stopPreview` removes the previous `loadedmetadata` listener via `metaListenerRef`, so a stale handler can't mutate the new src's `currentTime`.

### BrowseBeats integration

- Remove the local `audioRef`, `stopTimerRef`, `previewingId` state and the `startPreview` / `stopPreview` / `togglePreview` helpers. Use `useBeatPreview()` instead.
- In `renderRow`, the row's `onClick` and Enter/Space `onKeyDown` handlers call **both** `onChange(beat.id)` (select) and `startPreview(beat)` (preview).
- The standalone ▶ button keeps `togglePreview(beat)` and `e.stopPropagation()` so users can explicitly stop a preview without re-selecting.
- The modal close handler (`handleClose`) still calls `stopPreview()`.
- The `computePreviewStart` export and its test are deleted.

### Random-pick button

- **Header layout change:** wrap the existing close button and the new 🎲 button in a right-side flex container so they group together. The current `<strong>Browse beats</strong>` stays as the leftmost child; the wrapper gets `ml-auto flex items-center gap-2`. The close button loses its own `ml-auto` (moves to the wrapper).
- Button markup: `<button type="button" aria-label="Pick a random beat" disabled={pool.length === 0} className="h-11 w-11 rounded-full bg-[rgba(94,200,255,0.08)] border border-[rgba(94,200,255,0.18)] flex items-center justify-center text-base disabled:opacity-40">🎲</button>`.
- **Disabled condition:** `pool.length === 0` (computed as `[...recents, ...main]`). Distinct from `emptyAfterFilter` — the random pool can be empty when no filters are applied (catalog edge case).
- On click:
  1. `const pool = [...recents, ...main];`
  2. Call `const beat = pickRandom(pool)`; if `null`, no-op (defensive — disabled state should prevent this).
  3. Call `onChange(beat.id)` and `startPreview(beat)`.
- **Helper:** `export function pickRandom<T>(arr: T[]): T | null` is added to and exported from `components/BrowseBeats.tsx`. Pure function, returns `null` for empty arrays, uses `Math.floor(Math.random() * arr.length)` otherwise. Unit-tested in `BrowseBeats.test.tsx` with `vi.spyOn(Math, 'random')`.
- Keyboard: button is in the natural tab order; the existing Tab focus-trap continues to work (the trap query already includes `button`).

### Setup.tsx desktop inline list

- Import `useBeatPreview` at the top of the component.
- Each beat-row `<button>` in the desktop inline list calls both `chooseBeat(b.id)` and `startPreview(b)` on click.
- When `previewingId === b.id`, render a small ▮▮ "now-playing" indicator on the right side of the row, before the BPM number. Color: `text-[#5ec8ff]`. It's display-only — not a button, doesn't take focus.
- The "Browse all / search…" footer button is unchanged.
- On unmount the hook cleans itself up; no extra plumbing needed.

### Game playback

Unchanged. `hooks/useBeat.ts` still calls `a.currentTime = 0` in its `play()`. The 15s rule applies to previews only.

## Testing plan

- **NEW** `hooks/useBeatPreview.test.tsx` (jsdom env — uses DOM Audio + React renderHook):
  - Stub `window.HTMLMediaElement.prototype.play` to a `vi.fn()` returning `Promise.resolve()` (jsdom doesn't implement playback).
  - Construct hook via `renderHook` from `@testing-library/react`. Verify:
    - `startPreview(beat1)` sets `previewingId === beat1.id` synchronously, before metadata fires.
    - After manually dispatching a `loadedmetadata` event on the audio element with `duration = 60`: `audio.currentTime === 15` and `play` was called.
    - Same flow with `duration = 8`: `audio.currentTime === 7`.
    - With `vi.useFakeTimers()`: dispatch `loadedmetadata` first (timer is scheduled inside the listener), then advance 15s — `previewingId === null` and `pause` was called.
    - `startPreview(beat2)` while beat1 is previewing: prior `loadedmetadata` listener is removed (no `currentTime` mutation if beat1's metadata fires post-swap), `previewingId === beat2.id`.
    - `togglePreview(beat1)` on currently-previewing beat: `previewingId === null`, `pause` called.

- **NEW** `components/BrowseBeats.test.tsx` (jsdom env, replaces the deleted `.ts`):
  - `pickRandom`: empty array → `null`; with `Math.random` stubbed to `0` returns first element; stubbed to `0.999...` returns last.
  - Click row → `onChange(beat.id)` called AND `startPreview(beat)` called (mock `useBeatPreview`).
  - Click random-pick 🎲 → `onChange` fires with the beat at the index `pickRandom` would return given the stubbed `Math.random`; `startPreview` fires with the same beat.
  - Random-pick button is `disabled` when `[...recents, ...main]` is empty (use filters that exclude all beats).
  - Keep coverage equivalent to deleted file: filter behavior, focus-trap on Tab/Shift-Tab, Esc closes, empty-state message.

- **NEW** `components/Setup.preview.test.tsx`:
  - jsdom env (matches the `*.test.tsx` glob in `vitest.config.ts`). Render `<Setup>`, click a beat row in the desktop inline list, assert the row gains the "now-playing" indicator. Mock `useBeatPreview` if direct asserting on the audio side-effect is fragile.
  - The existing `components/Setup.test.ts` (which only covers `computeActiveBeat`) stays in the node env, unchanged.

## Out of scope

- No changes to `/yt` page or `YtSetup` (existing rule from prior work).
- No changes to game playback start time.
- No new beat metadata fields. `Beat.previewOffset` / `Beat.startOffset` are untouched but no longer read by preview logic.
- No accessibility regressions; aria attributes and focus management are preserved.

## Open questions

None.
