# Beat Calibration & Category System — Design Spec

**Date:** 2026-05-14
**Status:** Approved

---

## Summary

Three problems with the current beats system:

1. **Unknown downbeat offset** — the ball starts moving from `t=0` but many audio files have silence or a short intro before beat 1 lands, so the ball is already mid-row when the first drum hit arrives.
2. **Unknown BPM** — no tooling exists to measure the actual BPM of a file you drop into `public/beats/`.
3. **No genre categories** — the BeatPicker shows a flat list; when beats grow to 8–10 tracks, users need to filter by genre (boom-bap, trap, jazz, etc.).

This spec adds a `/calibrate` page that auto-detects BPM, suggests genre via Claude, and lets the user mark beat 1. It also adds `startOffset` and `category` to the `Beat` type and updates the BeatPicker with genre chip filtering.

---

## Out of scope

- Beat ingestion from YouTube or other URLs (tracked separately — future spec).
- Automatic trimming of audio files.
- Changing the rhyme generation system.

---

## Data model

`lib/beats.ts`:

```ts
export type BeatCategory =
  | 'boom-bap'
  | 'trap'
  | 'jazz'
  | 'lo-fi'
  | 'drill'
  | 'other';

export type Beat = {
  id: string;
  src: string;
  title: string;
  bpm: number;
  barsPerLoop: number;
  startOffset: number;   // seconds before beat 1 lands; 0 = file starts on beat 1
  category: BeatCategory;
};
```

**Migration:** The existing `click-90` entry gets `startOffset: 0, category: 'other'`. No runtime behaviour changes for that beat.

**`startOffset` semantics:** Represents the duration of silence or musical intro before the first downbeat of the loop. The value only matters for the initial play — since audio loops from `currentTime = 0`, the silence replays on every loop iteration. This is mathematically correct (session time formula handles it) but means files with large offsets will sound slightly awkward on each loop boundary. The recommended practice is to export beat files trimmed to start on beat 1 and leave `startOffset: 0`; use the offset only as a workaround for files you can't re-export.

---

## Game loop change

`lib/session-time.ts` — `makeSessionTimer` gains a second parameter:

```ts
function makeSessionTimer(audio: HTMLAudioElement, startOffset = 0) {
  let loopsCompleted = 0;
  let lastT = 0;
  audio.addEventListener('seeking', () => { lastT = 0; });
  return () => {
    const t = audio.currentTime;
    if (t < lastT - 0.5) loopsCompleted++;
    lastT = t;
    return Math.max(0, loopsCompleted * audio.duration + t - startOffset);
  };
}
```

`Math.max(0, ...)` prevents negative session time during the initial silence.

`hooks/useGameLoop.ts` — receives `startOffset: number` and passes it to `makeSessionTimer`.

`components/Game.tsx` — passes `beat.startOffset ?? 0` to `useGameLoop`.

---

## Calibration page

### Route

`app/calibrate/page.tsx` — client component, auth-gated by existing middleware (no special treatment needed). Accessible at `/calibrate`. This is a developer tool; no link to it appears in the game UI.

### Step-by-step flow

**Step 1 — Select beat**
Dropdown lists every entry in `BEATS`. Selecting one starts playback on loop.

**Step 2 — Measure BPM (auto + manual correction)**
On load, the `music-tempo` npm package analyses the audio buffer and returns a BPM estimate. This value pre-fills the BPM field. A **TAP** button is also shown: the user can tap along to the beat (8+ taps) and the page computes average inter-tap interval as an override. A **Reset taps** link clears the tap history. The final BPM shown is whichever was set last (auto or tap). A confidence bar shows how many taps have been collected (locks at 8+).

**Step 3 — Suggest category (Claude)**
Immediately after auto-detection completes, the page calls `POST /api/analyze-beat` with `{ bpm, title }`. Claude returns a suggested `category`. The result pre-selects one of the category chips; the user can override by clicking a different chip.

**Step 4 — Mark beat 1**
A single large button: **▼ MARK BEAT 1**. When clicked, the page records `audio.currentTime` as `startOffset`. The user listens for the first downbeat of the loop and taps the button exactly on it. The button can be clicked repeatedly; the last value wins. The page shows the recorded offset in seconds.

**Step 5 — Copy output**
Once BPM, category, and startOffset are all set, Step 3 panel shows the complete `beats.ts` entry:

```ts
{
  id: 'night-trap',
  src: '/beats/night-trap.mp3',
  title: 'Night Trap',
  bpm: 94.0,
  barsPerLoop: 8,       // ← user fills this in manually
  startOffset: 0.24,
  category: 'trap',
},
```

`barsPerLoop` is left as a comment placeholder `/* fill in */` — it cannot be reliably inferred and must be set manually. A **Copy to clipboard** button copies the block.

---

## `/api/analyze-beat` route

**File:** `app/api/analyze-beat/route.ts`

**Method:** POST

**Auth:** required (existing middleware)

**Rate limit:** same in-memory 1-per-60s-per-IP guard as `/api/rhymes`.

**Request body:**
```ts
{ bpm: number; title: string }
```

**Server logic:**
1. Call Claude (`claude-haiku-4-5-20251001`) with tool-use, requesting a `beat_category` tool output.
2. Prompt: *"Given a beat titled '{title}' with a detected BPM of {bpm}, suggest the most likely genre category. Choose from: boom-bap, trap, jazz, lo-fi, drill, other."*
3. Validate response against `BeatCategory` union.
4. On any failure, return `{ category: 'other' }` — never error the client.

**Response:**
```ts
{ category: BeatCategory }
```

---

## BeatPicker — category filtering

`components/BeatPicker.tsx` receives the full `beats` array (unchanged). A row of category chips is rendered above the `◀ title ▶` control:

- An **All** chip is always shown first.
- One chip per category that has ≥ 1 beat in the `beats` array. Categories with 0 beats are hidden — no "empty state" needed.
- Selecting a chip filters the navigation to only beats in that category. The `◀ ▶` arrows cycle within the filtered set.
- If the currently selected beat is not in the new filtered set, the picker moves to the first beat in that category.
- Default selection: **All**.

The chip row is visually identical to the design reviewed in brainstorming (Option A: chips above the `◀ title ▶` row).

---

## New dependency

`music-tempo` (MIT licence, ~12 kB gzipped) — client-side BPM detection via Web Audio API. Added to `package.json`. Only loaded on the `/calibrate` page (dynamic import), so it does not affect the main game bundle.

---

## File-by-file deliverables

```
lib/
  beats.ts                    updated — BeatCategory type, startOffset + category on Beat
  session-time.ts             updated — startOffset param in makeSessionTimer
hooks/
  useGameLoop.ts              updated — pass startOffset to makeSessionTimer
components/
  Game.tsx                    updated — pass beat.startOffset ?? 0 to useGameLoop
  BeatPicker.tsx              updated — category chip row, filtered navigation
app/
  calibrate/page.tsx          new — calibration UI (client component)
  api/analyze-beat/route.ts   new — Claude category suggestion endpoint
package.json                  updated — add music-tempo
```

---

## Testing

- Unit test `makeSessionTimer` with `startOffset > 0`: verify session time is 0 during the silent prefix and counts correctly after offset.
- Unit test `BeatPicker` chip filtering: selecting a category hides beats of other categories; selecting All restores all.
- Manual smoke test: calibrate one real beat file, paste entry into `beats.ts`, play a full session and verify ball lands on downbeats.
