# BrowseBeats restyle + click-to-preview at 15s

**Date:** 2026-05-16
**Type:** UI redesign + small UX change

## Summary

Two changes scoped to the beat-picking experience on the Setup screen:

1. Restyle the `BrowseBeats` modal from the legacy yellow theme to the existing Ice & Chrome (cyan/navy) palette so it matches the rest of [Setup.tsx](../../../components/Setup.tsx).
2. Change preview behavior: clicking a beat row anywhere (the modal AND the desktop inline list) selects the beat AND auto-starts a preview at the 15-second mark; the preview auto-stops 15 seconds later.

Game playback (after PLAY) is **not** affected by the 15s rule — it still begins at the start of the song.

## Files touched

| File | Status | Purpose |
|---|---|---|
| [hooks/useBeatPreview.ts](../../../hooks/useBeatPreview.ts) | NEW | Shared preview-audio state/logic |
| [hooks/useBeatPreview.test.ts](../../../hooks/useBeatPreview.test.ts) | NEW | Unit tests for the hook |
| [components/BrowseBeats.tsx](../../../components/BrowseBeats.tsx) | CHANGED | Re-skin + use shared hook + click-row-to-preview |
| [components/BrowseBeats.test.ts](../../../components/BrowseBeats.test.ts) | CHANGED | Drop dead test, add row-click test |
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

**Internal state:**
- One reused `HTMLAudioElement` held in a ref.
- One `setTimeout` handle (auto-stop timer) held in a ref.
- React state for `previewingId`.

**Behavior:**
- `startPreview(beat)`: stops any current preview, swaps `audio.src` to the beat, waits for `loadedmetadata`, then sets `audio.currentTime = clamp(15, 0, duration - 1)` and calls `audio.play()`. Schedules a 15-second `setTimeout` that calls `stopPreview`.
- `togglePreview(beat)`: if `previewingId === beat.id`, calls `stopPreview`; otherwise `startPreview(beat)`.
- `stopPreview()`: pauses audio, clears timer, sets `previewingId = null`.
- Errors on the audio element or a failed `play()` reset `previewingId` to null (no UI toast — same silent fail the current code uses).
- Effect cleanup on unmount: pause audio + clear timer.

**Edge cases:**
- Beat duration unknown at construction time → we wait for `loadedmetadata`. Until then the audio doesn't play.
- Duration < 16s → start is clamped to `max(0, duration - 1)`. Auto-stop timer still fires at 15s, but the audio will hit the end naturally first.
- Rapid clicks across different beats → `startPreview` calls `stopPreview` first, then sets new src. The previous `loadedmetadata` listener used `{ once: true }`, so a stale listener for the old src will fire at most once and may set `currentTime` on the new src. Mitigation: in `startPreview`, capture the target beat id in closure and abort the play if `audioRef.current` has been swapped, OR remove the prior listener explicitly. **Decision: remove the previous `loadedmetadata` listener before adding a new one** (track it in a ref).

### BrowseBeats integration

- Remove the local `audioRef`, `stopTimerRef`, `previewingId` state and the `startPreview` / `stopPreview` / `togglePreview` helpers. Use `useBeatPreview()` instead.
- In `renderRow`, the row's `onClick` and Enter/Space `onKeyDown` handlers call **both** `onChange(beat.id)` (select) and `startPreview(beat)` (preview).
- The standalone ▶ button keeps `togglePreview(beat)` and `e.stopPropagation()` so users can explicitly stop a preview without re-selecting.
- The modal close handler (`handleClose`) still calls `stopPreview()`.
- The `computePreviewStart` export and its test are deleted.

### Setup.tsx desktop inline list

- Import `useBeatPreview` at the top of the component.
- Each beat-row `<button>` in the desktop inline list calls both `chooseBeat(b.id)` and `startPreview(b)` on click.
- When `previewingId === b.id`, render a small ▮▮ "now-playing" indicator on the right side of the row, before the BPM number. Color: `text-[#5ec8ff]`. It's display-only — not a button, doesn't take focus.
- The "Browse all / search…" footer button is unchanged.
- On unmount the hook cleans itself up; no extra plumbing needed.

### Game playback

Unchanged. `hooks/useBeat.ts` still calls `a.currentTime = 0` in its `play()`. The 15s rule applies to previews only.

## Testing plan

- **NEW** `hooks/useBeatPreview.test.ts`:
  - Stub `window.HTMLMediaElement.prototype.play` to resolve (jsdom doesn't implement it).
  - Construct hook via `renderHook`. Verify:
    - `startPreview(beat1)` sets `previewingId === beat1.id`.
    - After dispatching `loadedmetadata` on the underlying audio (with `duration = 60`), `audio.currentTime === 15`.
    - With `duration = 8`, `audio.currentTime === 7`.
    - After 15s of fake time (`vi.useFakeTimers`), `previewingId === null`.
    - `startPreview(beat2)` while beat1 is previewing stops beat1 and updates `previewingId`.
    - `togglePreview(beat1)` on currently-previewing beat stops it.

- **CHANGED** `components/BrowseBeats.test.ts`:
  - Delete the `computePreviewStart` block.
  - Add: rendering rows, clicking a row fires `onChange` AND enters previewing state. Easiest path: mock `useBeatPreview` and assert `startPreview` is called with the right beat. Alternatively, assert on `aria-label`/class state of the ▶ button.
  - Keep existing filter / focus-trap / empty-state coverage.

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
