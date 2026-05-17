# Loading Cancel + Ping-Pong Ball Physics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Cancel button to the loading screen, and fix the bouncing-ball arc so it reads like a real gravity-driven ping-pong bounce (slow at apex, snappy at impact) instead of the current upside-down sine curve.

**Architecture:** Pure UI / pure-function changes — no new state, no new APIs, no new dependencies. `LoadingScreen` gains an optional `onCancel` prop wired by both top-level game containers (`Game.tsx` and `YtGame.tsx`) to the existing `quitToSetup()` from `useGamePhases`. `computeBounceY` swaps `sin(πt)` for a squared triangle-wave `(1 − |2t − 1|)²`.

**Tech Stack:** Next.js (React), TypeScript, Tailwind, Vitest. Tests run with `npm test` (= `vitest run`).

**Spec:** [docs/superpowers/specs/2026-05-17-loading-cancel-and-ball-physics-design.md](../specs/2026-05-17-loading-cancel-and-ball-physics-design.md)

---

## File map

- **Modify** [components/BouncingBall.tsx](../../../components/BouncingBall.tsx) — replace `computeBounceY` body.
- **Modify** [components/BouncingBall.test.ts](../../../components/BouncingBall.test.ts) — update quarter-phase assertion, keep boundary/center assertions.
- **Modify** [components/LoadingScreen.tsx](../../../components/LoadingScreen.tsx) — add optional `onCancel?: () => void` prop, render a `Cancel` text button when provided.
- **Modify** [components/Game.tsx](../../../components/Game.tsx) — pass `quitToSetup` as `onCancel` to `<LoadingScreen />`.
- **Modify** [components/YtGame.tsx](../../../components/YtGame.tsx) — pass `quitToSetup` as `onCancel` to `<LoadingScreen />`.

No new files. No package.json changes.

---

## Task 1: Ball physics — failing test first

**Files:**
- Test: `components/BouncingBall.test.ts`

The current test asserts `computeBounceY(0.0625) ≈ 0.707` (the sin-curve value). Under the new formula `(1 − |2·cellPhase − 1|)²`, the same input gives `0.25`. We update the test to assert the new value — this should fail against the unmodified implementation, proving the test is wired to the function we're about to change.

- [ ] **Step 1: Update the quarter-phase assertion**

Replace the existing third `it()` block in `components/BouncingBall.test.ts` with the new expectation. The file should end up as:

```typescript
import { describe, it, expect } from 'vitest';
import { computeBounceY } from './BouncingBall';

describe('computeBounceY', () => {
  it('returns 0 at cell boundaries (ball at top, between beats)', () => {
    expect(computeBounceY(0)).toBeCloseTo(0);
    expect(computeBounceY(0.25)).toBeCloseTo(0);
    expect(computeBounceY(0.5)).toBeCloseTo(0);
    expect(computeBounceY(0.75)).toBeCloseTo(0);
    expect(computeBounceY(1)).toBeCloseTo(0);
  });

  it('returns 1 at beat centers (ball at bottom, on plate)', () => {
    expect(computeBounceY(0.125)).toBeCloseTo(1); // beat 0 center
    expect(computeBounceY(0.375)).toBeCloseTo(1); // beat 1 center
    expect(computeBounceY(0.625)).toBeCloseTo(1); // beat 2 center
    expect(computeBounceY(0.875)).toBeCloseTo(1); // beat 3 center
  });

  it('returns 0.25 at quarter phase (squared-triangle, ball still near apex)', () => {
    // x=0.0625 → cellPhase=0.25 → t = 1 - |0.5 - 1| = 0.5 → y = 0.25.
    // This value (vs. 0.5 for a linear triangle or 0.125 for cubed) locks in
    // the squared-triangle shape — i.e. ball spends most of the cell near the
    // apex and only snaps to the tile near the beat center.
    expect(computeBounceY(0.0625)).toBeCloseTo(0.25);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails on the changed assertion**

Run: `npx vitest run components/BouncingBall.test.ts`

Expected: the first two `it()` blocks PASS (they're unchanged), the third FAILS with something like `expected 0.7071… to be close to 0.25`. This confirms the test is exercising the right function and the assertion is meaningful.

- [ ] **Step 3: Implement the new `computeBounceY`**

Replace the body of `computeBounceY` in `components/BouncingBall.tsx`. The new file (only the function changes; rest of file stays):

```typescript
'use client';

export function computeBounceY(x: number): number {
  const cellPhase = (x * 4) % 1;
  const t = 1 - Math.abs(2 * cellPhase - 1); // triangle wave: 0 → 1 → 0
  return t * t;                              // squared: slow at apex, fast at impact
}

const BALL_SIZE_PX = 14;       // matches w-3.5 h-3.5
const BALL_HALF = BALL_SIZE_PX / 2;
const APEX_PX = 36;             // how high the ball arcs above the tile top

type Props = {
  /** 0..1 across the row width. */
  x: number;
};

/**
 * Renders inside the active row container (which must be `position: relative`).
 * The ball's center lands on the row's top edge on each beat (so its lower
 * half visually presses into the tile for the impact feel), and arcs up to
 * `APEX_PX` above the row between beats. The arc is gravity-shaped: the
 * ball lingers near the apex and snaps down onto each tile.
 */
export function BouncingBall({ x }: Props) {
  const yBounce = computeBounceY(x);
  const top = -APEX_PX + yBounce * (APEX_PX - BALL_HALF);
  const isLanding = yBounce > 0.92;
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${x * 100}%`,
        top: `${top}px`,
        width: `${BALL_SIZE_PX}px`,
        height: `${BALL_SIZE_PX}px`,
        transform: `translateX(-50%) ${isLanding ? 'scale(1.15, 0.85)' : 'scale(1, 1)'}`,
        transition: 'transform 60ms ease-out',
        zIndex: 5,
      }}
    >
      <div
        className="h-full w-full rounded-full"
        style={{
          background: 'linear-gradient(135deg, #5ec8ff, #2860e0)',
          boxShadow: '0 0 14px rgba(94,200,255,0.9), 0 0 28px rgba(94,200,255,0.35)',
        }}
      />
    </div>
  );
}
```

(Note: the `isLanding > 0.92` squash effect still triggers correctly — under the new curve `yBounce > 0.92` corresponds to `t > sqrt(0.92) ≈ 0.959`, i.e. very close to landing, which is exactly when the squash should fire.)

- [ ] **Step 4: Run all `BouncingBall` tests and verify they pass**

Run: `npx vitest run components/BouncingBall.test.ts`

Expected: all three `it()` blocks PASS.

- [ ] **Step 5: Run the full test suite to confirm nothing else broke**

Run: `npm test`

Expected: full suite passes. (If unrelated pre-existing failures exist on the branch, note them but don't fix here.)

- [ ] **Step 6: Commit**

```bash
git add components/BouncingBall.tsx components/BouncingBall.test.ts
git commit -m "fix(bounce): gravity-shaped arc so ball lingers at apex and snaps onto tile"
```

---

## Task 2: Loading-screen Cancel button — component change

**Files:**
- Modify: `components/LoadingScreen.tsx`

Add an optional `onCancel` callback prop. When provided, render a `Cancel` text button under the existing "Loading rhymes…" status line. No callback → no button (preserves current behaviour for any caller that doesn't opt in).

- [ ] **Step 1: Add the `onCancel` prop and render the button**

Replace `components/LoadingScreen.tsx` with:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { WordGrid } from './WordGrid';

type Props = {
  /** BPM for the preview animation. Defaults to 90 when undefined. */
  bpm?: number;
  /** When provided, a "Cancel" button appears under the status text. */
  onCancel?: () => void;
};

export function LoadingScreen({ bpm = 90, onCancel }: Props) {
  const [ballX, setBallX] = useState(0);

  useEffect(() => {
    let raf = 0;
    let start: number | null = null;
    const beatsPerSecond = bpm / 60;
    const frame = (now: number) => {
      if (start == null) start = now;
      const elapsed = (now - start) / 1000;
      const beats = elapsed * beatsPerSecond;
      const x = (beats % 4) / 4;
      setBallX(x);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [bpm]);

  return (
    <main
      className="relative min-h-screen p-4 flex flex-col bg-[#060c14]"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 30% at 50% -5%, rgba(94,200,255,0.13) 0%, transparent 100%)',
      }}
    >
      <div className="relative z-10 mt-12 mx-auto w-full max-w-md lg:max-w-3xl">
        <WordGrid bars={[]} activeRow={0} ballX={ballX} />
        <div className="mt-8 text-center text-sm text-[rgba(94,200,255,0.7)]">
          Loading rhymes…
        </div>
        {onCancel && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Type-check the change**

Run: `npx tsc --noEmit`

Expected: no errors. (If unrelated pre-existing TS errors exist on the branch, note them but don't fix here.)

- [ ] **Step 3: Run the full test suite**

Run: `npm test`

Expected: full suite passes. No `LoadingScreen` tests exist; this step just confirms we haven't broken anything by import.

- [ ] **Step 4: Commit**

```bash
git add components/LoadingScreen.tsx
git commit -m "feat(loading): add optional onCancel prop with Cancel button"
```

---

## Task 3: Wire `onCancel` in both game containers

**Files:**
- Modify: `components/Game.tsx`
- Modify: `components/YtGame.tsx`

Both already destructure `quitToSetup` from `useGamePhases`. We just pass it to `<LoadingScreen />`.

- [ ] **Step 1: Wire it in `Game.tsx`**

In `components/Game.tsx`, find the loading branch (around line 39-43):

```typescript
      {phase === 'loading' && (
        <motion.div key="loading" {...fadePage}>
          <LoadingScreen bpm={activeBeat?.bpm} />
        </motion.div>
      )}
```

Change to:

```typescript
      {phase === 'loading' && (
        <motion.div key="loading" {...fadePage}>
          <LoadingScreen bpm={activeBeat?.bpm} onCancel={quitToSetup} />
        </motion.div>
      )}
```

- [ ] **Step 2: Wire it in `YtGame.tsx`**

In `components/YtGame.tsx`, find the loading branch (around line 31-35):

```typescript
      {phase === 'loading' && (
        <motion.div key="loading" {...fadePage}>
          <LoadingScreen bpm={activeBeat?.bpm} />
        </motion.div>
      )}
```

Change to:

```typescript
      {phase === 'loading' && (
        <motion.div key="loading" {...fadePage}>
          <LoadingScreen bpm={activeBeat?.bpm} onCancel={quitToSetup} />
        </motion.div>
      )}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`

Expected: full suite passes.

- [ ] **Step 5: Manual smoke test (both flows)**

Start the dev server: `npm run dev`

Then, in a browser:

1. **Main flow (`/`):** Log in, pick a beat, click PLAY, click `Cancel` while the loading screen is up.
   - Expected: returns to setup screen with the same beat/language/difficulty still selected. No error banner. No audio in the background.
2. **YT flow (`/yt`):** Same drill on the YouTube import page.
   - Expected: same behaviour.
3. **During gameplay (either flow):** Watch the ball.
   - Expected: ball clearly "hangs" between beats at the apex, then snaps down onto each tile. No longer feels like it's sliding along the tile tops.

If any of the three checks fails, stop and report what was wrong — do not commit.

- [ ] **Step 6: Commit**

```bash
git add components/Game.tsx components/YtGame.tsx
git commit -m "feat(loading): wire Cancel button in Game and YtGame"
```

---

## Self-review (already done by the planner)

- **Spec coverage:** Both spec sections (cancel button + ball physics) and both wire-up callers (`Game.tsx`, `YtGame.tsx`) have tasks. The "out of scope" items (AbortController, landing-position change, horizontal motion) correctly have no tasks.
- **No placeholders:** Every step contains the full code or exact command. No "TBD" / "handle edge cases" / "similar to above" patterns.
- **Type consistency:** Prop name `onCancel` matches across `LoadingScreen.tsx`, `Game.tsx`, `YtGame.tsx`. Function name `computeBounceY` and its single-argument signature stay identical.
- **Test discipline:** Task 1 follows red-then-green (test updated before implementation, verified failing, then implementation, verified passing).
