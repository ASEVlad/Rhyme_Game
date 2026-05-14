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
  startOffset?: number;  // seconds before beat 1 lands; omit or 0 = file starts on beat 1
  category: BeatCategory;
};
```

**Migration:** The existing `click-90` entry gets `category: 'other'`. `startOffset` is optional and defaults to `0`, so no change to the existing entry is required.

**`startOffset` semantics:** Represents the duration of silence or musical intro before the first downbeat of the loop. Since audio loops from `currentTime = 0`, the silence replays on every loop iteration. This is mathematically correct (the session time formula handles it) but means files with large offsets will sound slightly awkward on each loop boundary. The recommended practice is to export beat files trimmed to start on beat 1 and leave `startOffset` unset; use it only as a workaround for files you can't re-export.

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

`components/Game.tsx` — passes `beat.startOffset ?? 0` to `useGameLoop` (the `?? 0` handles the optional field).

---

## Calibration page

### Route

`app/calibrate/page.tsx` — client component, auth-gated by existing middleware (no special treatment needed). Accessible at `/calibrate`. This is a developer tool; no link to it appears in the game UI.

### Step-by-step flow

**Step 1 — Load a beat file**
A text input accepts a path relative to `public/` (e.g. `beats/night-trap.mp3`). Clicking **Load** triggers two independent operations in parallel:

- **Playback:** an `HTMLAudioElement` is created with `src = '/' + entered path` and set to loop. This is the element used for all subsequent `audio.currentTime` reads.
- **Analysis:** the same URL is fetched via `fetch()`, the response body converted to an `ArrayBuffer`, and decoded with `AudioContext.decodeAudioData()`. The resulting `AudioBuffer` is passed to `music-tempo` for BPM detection.

This works for any file in `public/beats/` — the beat does not need to exist in `beats.ts` yet. The `id` and `title` fields in the output default to the filename stem (e.g. `night-trap` from `beats/night-trap.mp3`) and can be edited inline before copying. The `src` field in the output is always `'/' + entered path` (e.g. `/beats/night-trap.mp3`).

**Step 2 — Measure BPM (auto + manual correction)**
`music-tempo` analyses the decoded `AudioBuffer` synchronously and returns a BPM estimate. This value pre-fills the BPM field. A **TAP** button is also shown: the user can tap along to the beat (8+ taps) and the page computes the average inter-tap interval as an override. A **Reset taps** link clears the tap history. The final BPM is whichever was set last (auto or tap). A confidence indicator shows how many taps have been collected (stabilises at 8+).

**Step 3 — Suggest category (Claude)**
Immediately after auto-detection completes, the page calls `POST /api/analyze-beat` with `{ bpm, title }`. Claude returns a suggested `category`. The result pre-selects one of the category chips; the user can override by clicking a different chip.

**Step 4 — Mark beat 1**
A single large button: **▼ MARK BEAT 1**. When clicked, the page records `audio.currentTime` as `startOffset`. The user listens for the first downbeat of the loop and taps the button exactly on it. The button can be clicked repeatedly; the last value wins. The page shows the recorded offset in seconds.

**Step 5 — Copy output**
Once BPM, category, and startOffset are all set, the output panel shows the complete `beats.ts` entry:

```ts
{
  id: 'night-trap',
  src: '/beats/night-trap.mp3',
  title: 'Night Trap',
  bpm: 94.0,
  barsPerLoop: /* fill in */,
  startOffset: 0.24,
  category: 'trap',
},
```

`barsPerLoop` is always left as `/* fill in */` — it cannot be reliably inferred and must be set manually by the developer (count the musical bars in the loop by ear or from the source). `startOffset` is always included in the output even when `0`, making it clear the field was calibrated and not accidentally omitted. A **Copy to clipboard** button copies the block.

---

## `/api/analyze-beat` route

**File:** `app/api/analyze-beat/route.ts`

**Method:** POST

**Auth:** required (existing middleware)

**Rate limit:** 10-per-60s-per-IP (more lenient than `/api/rhymes` since this is a dev tool called once per beat, not per game session).

**Request body:**
```ts
{ bpm: number; title: string }
```

**Server logic:**
1. Call Claude (`claude-haiku-4-5-20251001`) with tool-use using the following tool schema:
   ```ts
   {
     name: 'beat_category',
     description: 'Return the most likely genre category for a beat.',
     input_schema: {
       type: 'object',
       properties: {
         category: {
           type: 'string',
           enum: ['boom-bap', 'trap', 'jazz', 'lo-fi', 'drill', 'other'],
         },
       },
       required: ['category'],
     },
   }
   ```
2. Prompt: *"Given a beat titled '{title}' with a detected BPM of {bpm}, suggest the most likely genre category."*
3. Validate the returned `category` value is a member of `BeatCategory`.
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

The chip row matches the design reviewed in brainstorming (Option A: chips above the `◀ title ▶` row).

---

## New dependency

`music-tempo` (MIT licence, ~12 kB gzipped) — client-side BPM detection via Web Audio API. Added to `package.json`. Only imported inside `app/calibrate/page.tsx` (not the main game bundle).

---

## File-by-file deliverables

```
lib/
  beats.ts                    updated — BeatCategory type, optional startOffset + required category on Beat
  session-time.ts             updated — startOffset param in makeSessionTimer
hooks/
  useGameLoop.ts              updated — accept + pass startOffset to makeSessionTimer
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

- Unit test `makeSessionTimer` with `startOffset > 0`: verify session time is `0` during the silent prefix and counts correctly after.
- Unit test `BeatPicker` chip filtering: selecting a category shows only matching beats; selecting All restores all; chips with 0 beats are absent.
- Manual smoke test: calibrate one real beat file, paste entry into `beats.ts`, play a full session and verify the ball lands on downbeats throughout.
