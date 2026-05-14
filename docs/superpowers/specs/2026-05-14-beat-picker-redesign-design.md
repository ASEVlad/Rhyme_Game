# Beat Picker Redesign — Design Spec

**Date:** 2026-05-14
**Status:** Approved (pending spec review)

## Summary

Replace the current single-beat ◀ ▶ stepper in `components/BeatPicker.tsx` with a full-screen browse modal that exposes all bundled beats at once, lets the user filter by tempo bucket and category, search by title, and preview a short snippet before committing. Add a "Recently played" list backed by `localStorage` so frequently-used beats are one tap away on re-entry. Tempo (BPM) becomes a first-class display and filter dimension.

## Goals

- Surface all 44 bundled beats (today 43 are hidden behind ◀ ▶ at any moment).
- Let the user filter by BPM bucket (`<85` / `85-100` / `>100`) — the explicit ask.
- Let the user preview a ~8-second snippet without starting a session.
- Show BPM prominently per row.
- Auto-track "recently played" so common picks come back to the top.
- No regression to the rest of Setup (language picker, PLAY button, logout, YouTube URL block).
- Plant a forward-pointer button on Setup that links to a future dedicated YouTube gameplay page at `/yt` (the page itself is stubbed; full design comes in a follow-up spec).

## Non-goals (out of scope for this spec)

- Favorites / pinning beats (recents covers the common case).
- Auto-scroll the selected beat into view on modal open (polish follow-up).
- Pre-populating per-beat `previewOffset` values (manual calibration follow-up via the `/calibrate` page).
- Time-stretch / playback-rate to a target BPM.
- A dedicated `/beats` route.
- Auto-defaulting Setup's selected beat to most-recent on first load (stays `BEATS[0]`).
- A standalone integration test for `Game.handlePlay → addRecentBeat` (covered manually + by the `recent-beats.ts` unit tests).
- Theme / level / category control for rhymes (handled in the next spec).
- Building out the `/yt` page itself (this spec only adds the navigation button and a placeholder route).
- Unifying YouTube beats into the BrowseBeats modal or into the recently-played store (intentionally deferred to the future `/yt` spec).
- Removing the existing inline YouTube URL input from Setup — kept verbatim so the working feature does not regress before `/yt` replaces it.

## Stack

No additions. Same Next.js 14 + TypeScript + Tailwind + HTML5 `<audio>` foundation as today.

## User flow

```
[Setup]
  ┌──────────────────────────────────┐
  │ Medicate              90 BPM ›   │ ← tappable summary (replaces ◀ ▶ stepper)
  └──────────────────────────────────┘
  [YouTube URL block]                     (unchanged — existing inline flow)
  [▶ Try YouTube mode →]                  (NEW — links to /yt)
  [Language picker]                       (unchanged)
  [PLAY]                                  (unchanged)
        │
        │ tap summary
        ▼
[BrowseBeats modal — full-screen overlay]
  Header: "Browse beats"            ✕
  Search:  ▢ Search by title…
  BPM:     [All BPM] [<85] [85-100] [>100]
  Cat:     [all categories] [boom-bap] [trap] [jazz] [lo-fi] [other]
  ★ Recently played   (hidden if empty after filter)
    90  Medicate         boom-bap  ▶
    84  Bliss            lo-fi     ▶
  All beats — sorted by BPM
    72  90s Lo-Fi        lo-fi     ▶
    75  Oath             other     ▶
    …
  ─────────────────────────────────
  [           Done            ]  ← sticky bottom
        │
        │ tap row = live select
        │ tap ✕ / Done / Esc / backdrop = close
        ▼
[Setup, updated summary]
```

## Architecture

```
components/
  Setup.tsx          # renders summary card (inline) + <BrowseBeats /> when open
                     # keeps existing YouTube URL block verbatim
                     # adds a "Try YouTube mode" link to /yt
  BrowseBeats.tsx    # NEW — full-screen modal: filters, list, preview audio

app/
  yt/page.tsx        # NEW — placeholder "Coming soon" route for future YouTube gameplay

lib/
  beat-filters.ts    # NEW — pure filterBeats(), bpmBucket(), availableCategories()
  recent-beats.ts    # NEW — localStorage-backed recent IDs (BUNDLED beats only),
                     # mirrors language-storage.ts
  beats.ts           # MODIFIED — add optional `previewOffset?: number` field
```

Deleted: `components/BeatPicker.tsx` and `components/BeatPicker.test.tsx`. The `availableCategories` helper moves into `lib/beat-filters.ts`.

The summary card on Setup is intentionally **inline** in `Setup.tsx` (≈10 lines of JSX) rather than its own component file — a separate file would be premature abstraction.

### Relationship to the YouTube beat feature

`<BrowseBeats />` handles only the bundled `BEATS` array. The existing YouTube URL input block remains in `Setup.tsx` untouched — same component code, same mutual-exclusivity logic with the bundled-beat selection (loading a YT beat sets `beatId = null`; picking a bundled beat clears the YT pill). The new summary card on Setup represents the bundled-beat selection only; when a YT beat is the active beat (Setup's `activeBeat`), the existing YT pill displays alongside the summary card (the YT pill is already mutually exclusive with the YT input field — same pattern, no change).

Recently played stores **bundled beat IDs only.** YouTube beats have hash IDs that are never in `BEATS`, are cached only as ephemeral `/tmp` files (evicted after the 3 most-recent), and are scheduled to be redesigned around a future `/yt` route. Adding them to recents now would create dead entries; surfacing them there is intentionally deferred.

## Component contracts

### `<BrowseBeats />`

```ts
type Props = {
  beats: Beat[];                       // typically BEATS
  selectedId: string | null;
  onChange: (id: string) => void;      // called immediately on row tap (live select)
  onClose: () => void;                 // called on ✕, Done button, or Esc key
};
```

Internal state: `query` (string), `bucket` (`BpmBucket`), `category` (`BeatCategory | 'all'`), `previewingId` (string | null). All four reset to defaults on each mount — filter state is **not** preserved across modal opens by design.

The `<audio>` element is created once via `useRef` and reused for all previews.

### Inline summary card on Setup

Plain JSX inside `Setup.tsx`:

```tsx
<button onClick={() => setBrowseOpen(true)} className="…">
  <span className="title">{selectedBeat?.title ?? 'Pick a beat'}</span>
  <span className="bpm">{selectedBeat?.bpm.toFixed(1)} BPM</span>
  <span className="chev">›</span>
</button>
```

## Filtering and sorting

`lib/beat-filters.ts`:

```ts
export type BpmBucket = 'all' | 'slow' | 'mid' | 'fast';

// Partition (labels match exactly):
//   slow: bpm < 85           label "<85"
//   mid:  85 ≤ bpm ≤ 100     label "85-100"
//   fast: bpm > 100          label ">100"
// Boundary values 85 and 100 both land in `mid`.
export function bpmBucket(bpm: number): Exclude<BpmBucket, 'all'>;

export function availableCategories(beats: Beat[]): BeatCategory[];

export type FilterCriteria = {
  bucket: BpmBucket;
  category: BeatCategory | 'all';
  query: string;            // whitespace-trimmed before matching
};

export function filterBeats(beats: Beat[], c: FilterCriteria): Beat[];
```

- All three criteria AND-combine.
- `query.trim()` is the matched string; whitespace-only = empty (no narrowing).
- Match is case-insensitive `String.prototype.includes` on `beat.title`.
- Result is sorted by `bpm` ascending. Ties keep input order (stable sort).
- `bucket: 'all'` and `category: 'all'` are no-ops.

The "All BPM" / "all categories" chips are themselves selectable; the four BPM chips and the (1 + N) category chips are each a mutually-exclusive group.

## Recently played

`lib/recent-beats.ts` (mirrors `lib/language-storage.ts`):

```ts
const KEY = 'rhyme.recentBeats';
const CAP = 5;

export function loadRecentBeats(): string[];       // safe: returns [] on any failure
export function addRecentBeat(id: string): void;   // prepend, dedup, cap at CAP
```

- Storage shape: `JSON.stringify(string[])` — array of beat IDs, most-recent first.
- `loadRecentBeats` returns `[]` on: missing key, `localStorage` unavailable (SSR or disabled), parse failure, non-array, contained non-strings. Console-warn on the corrupted cases.
- `addRecentBeat`:
  - Prepends `id`.
  - De-duplicates: any earlier occurrence is removed before prepend.
  - Caps to `CAP` entries.
  - No-ops if `localStorage` unavailable.
  - Wrapped in `try/catch` so quota or serialization failures are swallowed (no-op, `console.warn`).
- **Caller responsibility:** `Game.handlePlay` calls `addRecentBeat(beatId)` immediately before transitioning to `'loading'`. Replays via `EndScreen.onPlayAgain` re-use the same beat and re-call this on the next session start, which is correct.

### Render-time filtering of recents

In `<BrowseBeats />`, the recents list is computed as:

```ts
const recentBeats = loadRecentBeats()
  .map(id => beats.find(b => b.id === id))      // drop stale IDs (no longer in BEATS)
  .filter((b): b is Beat => Boolean(b));

const recentsAfterFilter = filterBeats(recentBeats, criteria);
const mainAfterFilter    = filterBeats(
  beats.filter(b => !recentBeats.some(r => r.id === b.id)),  // exclude recents from main
  criteria,
);
```

- The "★ Recently played" section is hidden when `recentsAfterFilter.length === 0`.
- A beat that appears in recents is **never** shown in the "All beats" section.
- `loadRecentBeats()` is called inside a `useEffect` on mount to avoid SSR/hydration mismatch (same pattern as Setup's language reconcile).

## Preview audio

A single `<audio>` element managed inside `<BrowseBeats />` via `useRef`.

```ts
function computePreviewStart(beat: Beat, duration: number): number {
  const desired = beat.previewOffset ?? ((beat.startOffset ?? 0) + 8);
  return Math.min(desired, Math.max(0, duration - 1));
}
```

- `Beat` gains an optional `previewOffset?: number` field (seconds). No values populated in v1; defaults derive from the formula above.
- The clamp uses `audio.duration - 1` so playback doesn't bump immediately into EOF.

Behavior:

| Action | Effect |
|---|---|
| Tap ▶ on row X (no preview active) | Stop any timer, set `audio.src` to X's `src`, attach a one-shot `loadedmetadata` handler that sets `currentTime = computePreviewStart(X, audio.duration)` and calls `audio.play()`, start 8s auto-stop timer, set `previewingId = X` |
| Tap ▶ on row X (X already playing) | Pause, clear timer, `previewingId = null` |
| Tap ▶ on row Y while X is playing | Stop X (pause + clear timer), then start Y as above |
| Tap row body (not the ▶) | Calls `onChange(rowId)`. Preview is **not** affected — keeps playing if active |
| Auto-stop timer fires | Pause, `previewingId = null` |
| Modal close (`onClose`) | Pause, clear timer, `previewingId = null` |
| `audio` error event | `console.warn`, reset `previewingId = null`; row's ▶ icon returns to idle |
| Component unmounts | useEffect cleanup pauses + clears timer |

iOS autoplay: the ▶ tap is a user gesture, which unlocks audio. Subsequent previews then work without further gestures during the modal's lifetime.

## Empty / error states

| Situation | UI |
|---|---|
| `BEATS.length === 0` | "No beats added yet." (current behavior preserved). Checked **before** the filter-result check below |
| Both recents and main empty after filtering | "No beats match these filters." + a "Clear filters" link that resets `bucket`, `category`, `query` to defaults |
| `localStorage` unavailable | Recents silently disabled; no error UI |
| `localStorage` corrupted | Treated as empty; `console.warn` logged once |
| Audio fails to load | Silent; ▶ icon resets; `console.warn` |
| Beat ID in recents no longer in `BEATS` | Filtered out by the `.map(...).filter(Boolean)` pipeline; no UI |

## Visual design

- Modal: full-viewport overlay, `position: fixed; inset: 0`, background `#0e1330`. Rendered as a sibling inside Setup (no React portal — the app has a single modal need).
- Header row: bold "Browse beats" left, ✕ button right (44×44 tap target).
- Search input: full-width pill, muted background.
- Filter chip rows:
  - BPM row visually prominent (white-on-yellow active state, same as today's BeatPicker categories).
  - Category row visually muted (lower contrast) — secondary filter.
- Beat row: BPM number in `rhyme-yellow`, ~20px bold, fixed-width gutter; title bold 14px; category small 10px uppercase; ▶ button 30×30 right-aligned.
- Selected row: `bg-rhyme-yellow/16` with a 1px `outline: rhyme-yellow`.
- Playing row's ▶ icon swaps to a pause glyph (`▮▮`).
- Sticky bottom: full-width "Done" button (`rhyme-yellow` background), `position: sticky; bottom: 0` with a small backdrop blur so list content fades under it.
- No emojis. No icons beyond ▶ / ▮▮ / ✕ / ›.

## Accessibility

- Modal has `role="dialog"`, `aria-modal="true"`, `aria-label="Browse beats"`.
- On open: focus moves to the ✕ button.
- On close: focus returns to the Setup summary card that opened the modal.
- Focus trap inside the modal (Tab cycles within; Shift+Tab reverses).
- Esc key closes the modal.
- Each chip is a `<button>` with `aria-pressed={active}`.
- Each row is a `<div role="button" tabIndex={0}>` with `aria-label={`${title}, ${bpm} BPM, ${category}`}`, `aria-current={isSelected}`, and an `onKeyDown` that fires the select on Enter/Space. (A native `<button>` would be ideal, but the row contains the ▶ button inside it; nesting `<button>` inside `<button>` is invalid HTML.)
- The ▶ button is a nested `<button>` with `aria-label={previewing ? 'Stop preview' : 'Preview beat'}` and calls `e.stopPropagation()` so the row's select handler doesn't fire.
- The row visually shows `▮▮` instead of `▶` iff `previewingId === row.id`.

## Hydration / SSR

- `<BrowseBeats />` is a `'use client'` component; `loadRecentBeats()` is called inside a `useEffect` on mount.
- Server-render shows an empty recents section, which then populates after mount. Acceptable because the modal opens only on user gesture; the empty-then-populate transition is invisible.

## Wiring changes

`components/Setup.tsx`:
- Drop `import { BeatPicker } from './BeatPicker'`.
- Add inline summary card + `useState<boolean>(false)` for `browseOpen`.
- Render `<BrowseBeats ... />` conditionally when `browseOpen`.
- `BEATS` import already present, reused.
- The YouTube URL block (the `ytState` machine, the input/Load button, the loaded pill, the error text) is **unchanged**. The summary card sits where `<BeatPicker />` sat; the YT block stays where it is below.
- Add a small "Try YouTube mode →" `next/link` to `/yt` directly under the YT block (or wherever it fits visually). Renders as a muted text link, not a primary button.

`app/yt/page.tsx` (NEW):
- Server-rendered page. Title: "YouTube Mode". Body: "Coming soon." plus a `← Back` link to `/`.
- Protected by the same middleware as `/` (no auth changes needed; the existing matcher already covers it).

`components/Game.tsx`, in `handlePlay` (the current signature already takes a `Beat` thanks to the YouTube feature):
```ts
function handlePlay(beat: Beat, lang: LanguageId) {
  // Only record bundled beats. YT beats use hash IDs that aren't in BEATS,
  // and their gameplay will move to /yt in a future spec.
  if (BEATS.some(b => b.id === beat.id)) {
    addRecentBeat(beat.id);       // NEW
  }
  setActiveBeat(beat);
  setLanguageId(lang);
  setLoadError(null);
  setPhase('loading');
}
```

`lib/beats.ts`:
- Add `previewOffset?: number;` to the `Beat` type. No data values change.

## Testing strategy

**Unit (vitest)**
- `lib/beat-filters.test.ts`:
  - Bucket partitioning: BPMs at exact boundaries (85, 85.01, 100, 100.01) sort into the correct bucket.
  - `filterBeats` combines bucket × category × query (AND semantics).
  - `query.trim()` empty matches everything.
  - Sort is BPM ascending, stable.
  - `availableCategories` returns distinct categories in first-seen order.
- `lib/recent-beats.test.ts`:
  - `addRecentBeat` prepends, dedups, caps at 5.
  - `loadRecentBeats` returns `[]` on missing key, non-array, non-string entries, parse failure.
  - Both fns no-op when `localStorage` throws (simulate by stubbing).

**Component (vitest + jsdom)**
- `<BrowseBeats />`:
  - Renders both sections when both have content.
  - Hides "Recently played" header when empty after filter.
  - Tapping a row calls `onChange` with that ID.
  - Tapping ▶ then ▶ again on the same row toggles play/pause (mock `HTMLAudioElement.prototype.play/pause`).
  - Tapping ▶ on row B while row A is playing pauses A and starts B.
  - Tapping ✕ / Done / Esc all invoke `onClose`.
  - Empty state ("No beats match…") shown when filter yields nothing; "Clear filters" link resets state.
  - Recents render excludes IDs that aren't in `beats` prop.

**Manual**
- Open the modal on a real mobile device (iOS Safari + Android Chrome): scroll smoothness, tap target size, sticky Done remains visible, ✕ reachable, iOS audio unlocks on first ▶ gesture.
- Quitting the modal stops preview audio (`audio.paused === true` post-close).
- Selecting a beat → starting a session → returning to Setup → reopening the modal: the beat appears in "Recently played".

## File-by-file deliverables

```
NEW:
  components/BrowseBeats.tsx
  lib/beat-filters.ts
  lib/beat-filters.test.ts
  lib/recent-beats.ts
  lib/recent-beats.test.ts
  app/yt/page.tsx               # "Coming soon" placeholder

MODIFIED:
  components/Setup.tsx          # inline summary card + BrowseBeats render + /yt link;
                                # existing YouTube URL block unchanged
  components/Game.tsx           # addRecentBeat call in handlePlay, bundled-only guard
  lib/beats.ts                  # add optional previewOffset field to Beat

DELETED:
  components/BeatPicker.tsx
  components/BeatPicker.test.tsx
```
