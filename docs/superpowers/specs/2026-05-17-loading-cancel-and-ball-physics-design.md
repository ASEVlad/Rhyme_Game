# Loading Cancel + Ping-Pong Ball Physics

Two small UX fixes for the `playing` flow:

1. The loading screen has no way out once the user clicks PLAY — they must wait for the rhyme fetch and audio to complete (or fail).
2. The bouncing-ball preview/play animation feels "upside down": the ball lingers on the tile (zero velocity at impact) and zips through the apex, which is the opposite of how a real ping-pong ball behaves under gravity.

## Goal

- A user mid-load can return to the setup screen with one click.
- The ball's vertical motion reads as a gravity-driven bounce: slow near the apex, snappy at impact.

## Non-goals

- No change to the ball's horizontal motion (still constant-velocity glide left-to-right).
- No change to the ball's landing position relative to the tile (center still meets the tile's top edge).
- No abort of the in-flight `/api/rhymes` request via `AbortController` — the existing `cancelled` flag in the loading effect already discards the result on phase change. We can revisit if needed.
- No change to the YouTube-import loading screen (`YtLoadingState`). That is a different loading state for a different flow (importing a new beat), and was not raised in the feedback.

## 1. Loading-screen cancel button

### Component changes

`components/LoadingScreen.tsx`

- Add an optional prop: `onCancel?: () => void`.
- When `onCancel` is defined, render a `Cancel` text button beneath the existing "Loading rhymes…" status line.
- Styling: low-emphasis text button, centered, `text-white/60 hover:text-white text-sm`, with a small top margin (`mt-3`).
- When `onCancel` is undefined, render nothing extra (preserves current behavior for any other caller).

### Wire-up

`components/YtGame.tsx`

- Pass `quitToSetup` from `useGamePhases` as `onCancel` to `<LoadingScreen … />`.

`hooks/useGamePhases.ts` — no changes. `quitToSetup` already:

- Calls `beatHandle.stop()` (no-op if audio hasn't started, but safe).
- Sets `phase` back to `'setup'`, which unmounts the loading effect; the effect's `cancelled` flag flips and the in-flight rhyme fetch result is discarded on resolve.

### Behavior

- Clicking `Cancel` returns the user to the setup screen with their previous beat / language / difficulty / scheme selections intact (state is held in `useGamePhases`).
- No error banner is shown — cancellation is a deliberate user action, not a load failure.

## 2. Ball bounce physics

### Math

Current `computeBounceY` (in `components/BouncingBall.tsx`):

```ts
const cellPhase = (x * 4) % 1;        // 0..1 within each beat cell
return Math.sin(cellPhase * Math.PI); // 0 → 1 → 0
```

`sin(πt)` has zero derivative at `t = 0.5` — meaning the ball has zero vertical velocity at the moment of impact. That reads visually as the ball "settling" on the tile, then accelerating away. A gravity-driven projectile has *maximum* velocity at impact and zero velocity at the apex — the opposite curve.

New formula:

```ts
const cellPhase = (x * 4) % 1;
const t = 1 - Math.abs(2 * cellPhase - 1); // triangle wave 0 → 1 → 0
return t * t;                              // squared: slow at apex, snappy at impact
```

Properties:

- `y(0) = 0`, `y(0.5) = 1`, `y(1) = 0` — unchanged invariants (apex at boundaries, ground at beat centers).
- `y'(0) = 0`, `y'(0.5±) = ±4` — slow at apex, max velocity at impact. Matches projectile motion.
- `y(0.25) = 0.25`, `y(0.75) = 0.25` — ball is much higher (closer to apex) at quarter-phase than the current `~0.707`.

### Rendering — unchanged

`top = -APEX_PX + yBounce * (APEX_PX - BALL_HALF)` stays as-is. The ball still meets the tile's top edge at impact and arcs up to `APEX_PX` between beats. Only the time-shape of the arc changes.

### Tests

`components/BouncingBall.test.ts`

- Keep the "0 at cell boundaries" test (still true).
- Keep the "1 at beat centers" test (still true).
- Replace the "~0.707 at quarter phase" test with the new value: at `x = 0.0625`, `cellPhase = 0.25`, so `y = (1 - 0.5)² = 0.25`. Use `toBeCloseTo(0.25)`.

## Files touched

- `components/LoadingScreen.tsx` — add `onCancel` prop, render `Cancel` button.
- `components/YtGame.tsx` — pass `quitToSetup` to `LoadingScreen`.
- `components/BouncingBall.tsx` — replace `computeBounceY` body.
- `components/BouncingBall.test.ts` — update quarter-phase assertion.

No new files. No new dependencies.

## Manual verification

- Start the dev server, open the game, click PLAY on any beat, click `Cancel` while the loading screen is up. Should return to setup with selections intact and no errors in the console.
- Play a round. The ball should clearly "hang" at the apex between beats and snap down onto each tile, rather than feeling like it slides along the tiles.
