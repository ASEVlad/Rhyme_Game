# Design: Game Polish Fixes (2026-05-16)

Four user-reported issues addressed together because they all sit on the
gameplay path and share visual language ("Ice & Chrome" theme).

1. The `Loading…` screen is plain text and feels disconnected from the rest of the game.
2. The bouncing ball does not appear to land on the tiles.
3. The audio plays its full natural length regardless of how many rhyme bars were sampled.
4. The "Nice work!" end screen uses leftover yellow/white styling that doesn't match the rest of the app.

The four fixes are scoped to a single iteration and a single implementation plan.

---

## 1. Loading screen — animated ball + grid preview

### Current behavior
[`Game.tsx:39-45`](../../../components/Game.tsx#L39-L45) renders:

```tsx
<div className="flex min-h-screen items-center justify-center text-xl">
  Loading…
</div>
```

Plain text on the page's default (near-black) background. No theme, no
preview of what comes next.

### Target behavior
Replace the loading view with a dimmed preview of the gameplay screen:

- **Background:** identical navy `#060c14` + cyan radial top-glow used in the playing phase.
- **Grid skeleton:** a `WordGrid` rendered with `bars=[]` (and no `activeRow` highlight), so all cells are the faint `bg-[rgba(94,200,255,0.06)]` placeholder cells, no words.
- **Ball preview:** the new `BouncingBall` (see §2) animated at the chosen beat's BPM, driven by a local `requestAnimationFrame` clock rather than the gameplay loop. It hops cell → cell → cell → cell across the active row indefinitely while loading.
- **Caption:** subtle "Loading rhymes…" text below the grid at low-opacity cyan.

### Why this matches the rest of the game
- Same layout proportions as the playing phase, so when the phase flips
  `loading → playing` the only visible change is words appearing and the
  caption fading out.
- Reuses the same primitives (`WordGrid`, `BouncingBall`) — no separate
  loading-screen component tree to keep in sync with the theme.

### Component shape
A new `LoadingScreen` component:

```
LoadingScreen({ bpm }: { bpm: number })
```

- Mounts a local raf loop that advances `ballX` 0→1 at `bpm/60/4` cycles per second.
- Reuses the navy + radial-glow wrapper from `Game`'s playing branch (extract a
  small helper or inline the same style — see §4 for the shared wrapper note).

### Edge cases
- No active beat (shouldn't happen in this phase, but defensively): fall back to 90 BPM for the preview animation.
- If `Loading` state finishes in <500ms, the screen still mounts/unmounts via
  the existing `AnimatePresence` flow.

---

## 2. Ball jumps on tiles like a ping-pong ball

### Current behavior
[`BouncingBall.tsx`](../../../components/BouncingBall.tsx) renders inside a
40px-tall row positioned *above* `WordGrid` in [`Game.tsx:77-80`](../../../components/Game.tsx#L77-L80).
The bounce equation `Math.sin(((x*4) % 1) * π)` already lands at tile centers
at the cell-center x values (0.125, 0.375, 0.625, 0.875 — see
[`BouncingBall.test.ts`](../../../components/BouncingBall.test.ts)). The
visual problem is that the ball's "low point" is the bottom of an empty
40px band; the tiles are entirely below this band, so the ball never
visually contacts them.

### Target behavior
The ball overlays the `WordGrid` and lands so its bottom edge meets the
top edge of the active row's tiles on each beat, with a small squash on impact.

### Layout change
Stop rendering the ball in its own row above the grid. Instead:

- Make `WordGrid`'s container `position: relative`.
- Render `BouncingBall` as an absolutely-positioned overlay anchored to the
  active row.
- Vertical range: ball center travels from `y = -BOUNCE_PX` (apex above the tile)
  down to `y = -BALL_RADIUS` (just kissing the tile top). At apex it's clearly
  above the row; at the trough it visually touches the tile.

**Important implementation detail:** `WordGrid` renders a sliding window
`[activeRow - 2, activeRow + windowSize + 1]` of rows ([WordGrid.tsx:40-43](../../../components/WordGrid.tsx#L40-L43)). The active row's
index *within the rendered DOM* is therefore always `2`, regardless of
the `activeRow` value — because the window slides as the game progresses,
but the active row is rendered at a fixed position relative to the
visible window. The ball overlay positions itself off the DOM index `2`,
not off the prop `activeRow`.

Preferred implementation: `BouncingBall` is rendered as a child of
`WordGrid` and positioned via the DOM index. Keeps positioning local to
one component.

### Bounce equation
Keep `computeBounceY(x) = sin(((x*4) % 1) * π)` (returns 0 at boundaries, 1 at beat centers, peaks midway).

This already produces a parabola-like arc per beat and is covered by tests.
**Do not change the math** — only the rendering geometry.

### Squash on impact (optional but recommended for the "ping-pong" feel)
At `yBounce > 0.92`, apply a CSS transform `scale(1.15, 0.85)`; otherwise `scale(1, 1)`.
This produces a brief 50-80ms squash near the bottom of each hop.

If this turns out fiddly during implementation, ship without the squash —
the corrected geometry alone solves the user's complaint.

### Acceptance check
At the 4th beat (`beatInBar` index 3, `ballX` ≈ 0.875), the ball's
bottom edge sits visually on top of the colored word tile in column 3
of the active row. Same for beats 0–2 over their respective empty tiles.

---

## 3. Rhymes fill the song

### Current behavior
- [`useBeat.ts:31`](../../../hooks/useBeat.ts#L31) sets `a.loop = true`.
- [`useGameLoop.ts:39-43`](../../../hooks/useGameLoop.ts#L39-L43) ends the game when `currentBar >= totalBars`.
- `totalBars` is derived from sampled rhyme groups (typically 8–32 bars). The audio loops indefinitely until the game ends; the song's natural length is irrelevant.

Result: regardless of song length, you hear ~30–90 seconds of (potentially looped) audio, with no relationship between rhyme count and song duration.

### Target behavior
The game plays the song **once, end-to-end**, and the rhymes are sized
to fill that duration.

### Implementation

**`useBeat`:**
- Set `a.loop = false`.
- Expose `duration` (number | null) on the `BeatHandle`, populated from a `loadedmetadata` listener.

**API request count must scale with duration.** A typical 3-minute song
at 90 BPM needs ~67 bars. The largest existing scheme (`free`: 10 groups
× up to 5 words) produces at most ~50 bars. So we cannot fill the song
by sampling more aggressively from a fixed-size response — we must ask
the API for more groups.

Add an optional `count` (or `targetBars`) field to the `/api/rhymes`
request body. The route currently uses `scheme.groupCount`
([rhymes.ts:86](../../../lib/rhymes.ts#L86)); change it to prefer the
client-supplied count when present, falling back to `scheme.groupCount`.

**`useGamePhases` loading effect:**
- Compute `targetBars` once `beatHandle.duration` is known:
  `targetBars = Math.floor((duration − (activeBeat.startOffset ?? 0)) × bpm / 240)`.
- Compute the API count: `count = clamp(Math.ceil(targetBars / minWords), 4, 40)`,
  where `minWords = scheme.wordsPerGroup ?? 2` (conservative: assume the
  short end of `free`'s 2–5 range so we don't under-request).
- Pass `count` in the `/api/rhymes` body.
- After the API responds, build bars from all returned groups; truncate to
  exactly `targetBars`. If the API returned fewer bars than `targetBars`
  (e.g. token-budget cap, exclusion exhaustion), accept the shortfall and
  let the song play out instrumental — this becomes the rare graceful
  degradation case, not the common case.

**Dependency / re-render hazard.** The existing loading effect uses
`[phase]` deps with an explicit eslint-disable that warns
"`playAgain()` deliberately re-uses the last settings by only setting
`phase`" ([useGamePhases.ts:128-132](../../../hooks/useGamePhases.ts#L128-L132)).
Adding `beatHandle.duration` as a dep would re-fire the effect on
`playAgain` if the duration value changes. Since `playAgain` re-uses the
same beat (same `audio` element), `duration` stays stable across replays —
so adding it as a dep is safe in practice. However, the implementation
must:
- Read `duration` from a ref or local snapshot inside the effect, OR
- Add `duration` to the deps AND update the eslint-disable comment to
  reflect the new dep set.

Whichever path is chosen, the `playAgain` flow must be exercised in
testing to confirm rhymes regenerate (currently each replay re-fetches
rhymes because the effect re-runs on `phase` going `setup → loading`).

**`useGameLoop`:**
- Add an `ended` event listener on the audio element. The `ended` event
  is the **sole** termination trigger; the existing
  `currentBar >= totalBars` check is removed (or kept only as a
  defensive safety net). Rationale: with `targetBars` computed from
  duration, both triggers should fire within ~1 bar of each other, but
  audio-end is more authoritative for "the song is over" semantics.

### Edge cases
- **Not enough rhyme groups:** if Claude's response is capped by tokens or
  exclusion exhaustion and we get fewer bars than `targetBars`, we accept
  the shortfall. The audio finishes naturally; the player hears
  instrumental for the tail. With the new dynamic `count` this should be
  rare even for long songs.
- **YouTube beats:** server-side `ffprobe` already estimates `barsPerLoop`
  ([`yt-beat/route.ts:59`](../../../app/api/yt-beat/route.ts#L59)). The
  client uses `audio.duration` identically to local beats — no special path.
- **Audio takes a long time to expose `duration`:** the `loadedmetadata`
  event fires very early; if it somehow doesn't fire within the loading
  effect, the loading screen simply persists until it does. No timeout
  needed for v1.
- **`startOffset > 0`:** subtract from duration when computing `targetBars`,
  so the playable region drives the bar count.
- **Token-budget concerns:** `count` is clamped to a max of 40 groups to
  keep Claude's response within `max_tokens: 4096`. For songs that need
  more than 40 groups' worth of bars (extremely long tracks), we cap
  groups and accept the instrumental tail.

### What is *not* changing
- `barsPerLoop` field on `Beat` stays in the data model. It's currently
  set by the YT-beat ingest server-side ([yt-beat/route.ts:207-215](../../../app/api/yt-beat/route.ts#L207-L215)) and threaded through `Setup`/`YtSetup`, but is not
  read by runtime gameplay code. Leaving it intact avoids churn in the
  beat data files and tests for no benefit.
- `session-time.ts`'s loop-wraparound logic stays in place; with
  `loop = false` it simply never trips. Harmless.
- `/api/rhymes` request shape: only adds an *optional* `count` field.
  Existing callers that don't pass it continue to work.

---

## 4. End screen restyle (Ice & Chrome)

### Current state
[`EndScreen.tsx`](../../../components/EndScreen.tsx) uses `bg-rhyme-yellow` /
`bg-white/10` on the page's default background — no theme wrapper, no glow.

### Target state
Match the Ice & Chrome theme established in Setup and gameplay:

- **Wrapper:** navy `#060c14` background with the same cyan radial top-glow
  used in the playing phase. Reuse the inline style currently in [`Game.tsx:59-60`](../../../components/Game.tsx#L59-L60). Consider extracting it to a small shared wrapper (e.g. `IceChromeFrame`) only if it cleans up the call sites; otherwise inline it.
- **Heading:** "Nice work!" — white, `text-5xl font-extrabold`, with a subtle
  cyan glow via `text-shadow: 0 0 16px rgba(94,200,255,0.45)`.
- **Primary button — Play again:**
  cyan→blue gradient `linear-gradient(135deg, #5ec8ff, #2860e0)`, **navy
  text `#060c14`** (matches Setup's PLAY button — needed for contrast on
  the cyan gradient), `font-extrabold`, generous padding, with the
  cyan glow `boxShadow: 0 0 32px rgba(94,200,255,0.45)`. See
  [Setup.tsx:356-357](../../../components/Setup.tsx#L356-L357) for the
  exact style being matched. Keep the existing `whileTap` motion.
- **Secondary button — Change beat:**
  transparent fill, `border border-[rgba(94,200,255,0.4)]`, cyan-tinted text
  (`text-[rgba(94,200,255,0.9)]`). Ghost variant of the primary.
- Layout: existing center-of-screen flex layout is fine; just keep the
  navy frame to the screen edges.

---

## File-level impact summary

| File | Change |
|---|---|
| `components/LoadingScreen.tsx` (new) | New themed loading view (§1) |
| `components/BouncingBall.tsx` | Geometry change — ball now positioned to land on tiles (§2). Optional squash transform. `computeBounceY` math unchanged. |
| `components/WordGrid.tsx` | Make container `position: relative`; render `BouncingBall` as a child overlay anchored to the active row (always DOM index 2 in the sliding window) (§2). Accept `ballX` already; now also owns ball positioning. |
| `components/Game.tsx` | Use `LoadingScreen` for the loading branch (§1); drop the standalone `<BouncingBall>` above the grid since it now lives inside `WordGrid` (§2) |
| `components/EndScreen.tsx` | Ice & Chrome restyle (§4) |
| `hooks/useBeat.ts` | `loop = false`; expose `duration` from `loadedmetadata` (§3) |
| `hooks/useGamePhases.ts` | Gate loading on `duration`; compute `targetBars`; pass dynamic `count` to API; trim to fill song (§3) |
| `hooks/useGameLoop.ts` | Listen for audio `ended` and terminate the game; remove `currentBar >= totalBars` as primary trigger (§3) |
| `app/api/rhymes/route.ts` | Accept optional `count` field in request body; pass through to `fetchRhymeGroups` (§3) |
| `lib/rhymes.ts` | `fetchRhymeGroups` accepts an explicit `count` overriding `scheme.groupCount` (§3) |

No data-model changes to `Beat`. One additive API field on `/api/rhymes`.

---

## Testing notes

- `BouncingBall.test.ts` — `computeBounceY` is unchanged, so existing tests
  continue to pass. No new unit tests for the geometry overlay (visual
  concern, hard to assert headlessly).
- Add a unit test for the `targetBars` / `count` derivation: given a known
  duration, BPM, `startOffset`, and scheme, assert the computed
  `targetBars` and API `count`. Pure function, easy to test.
- Add a unit test for `/api/rhymes` that confirms a request with `count`
  in the body overrides `scheme.groupCount`, and that omitting `count`
  preserves current behavior.
- Manual: open a long song and a short song, verify rhymes span the full
  song in both cases and the game ends when the audio ends.
- Manual: `playAgain` flow — confirm the loading effect re-fires and
  rhymes regenerate (the dependency-hazard note in §3 applies here).
- Manual: verify ball visibly lands on each cell on each beat (especially
  the word tile on the 4th beat) in both phone-portrait and desktop widths.
