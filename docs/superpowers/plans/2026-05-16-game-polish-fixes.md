# Game Polish Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four user-reported issues on the gameplay path: themed Loading screen, ball that visibly lands on tiles, rhymes sized to fill the song, and an Ice & Chrome end screen.

**Architecture:** Backend-first: extend `/api/rhymes` to accept a dynamic group count, expose audio `duration` from `useBeat`, and have `useGamePhases` compute `targetBars` from duration. Then visual: move `BouncingBall` into `WordGrid` as an overlay anchored to the active row, build a new `LoadingScreen` that reuses the same primitives, and restyle `EndScreen` to match the Ice & Chrome theme.

**Tech Stack:** Next.js 14 (App Router) · React 18 · TypeScript · Tailwind · Framer Motion · Vitest (`npm test`) · `@testing-library/jest-dom` for component tests · `@anthropic-ai/sdk` for `/api/rhymes`.

**Reference spec:** [`docs/superpowers/specs/2026-05-16-game-polish-fixes-design.md`](../specs/2026-05-16-game-polish-fixes-design.md)

---

## Task 1: Add `count` override to `fetchRhymeGroups`

**Files:**
- Modify: `lib/rhymes.ts`
- Test: `lib/rhymes.test.ts`

The `/api/rhymes` route currently builds `count` from `scheme.groupCount`. We need `fetchRhymeGroups` to accept an explicit `count` that overrides the scheme's default, while keeping the existing behavior when omitted.

- [ ] **Step 1: Write the failing test**

Append to `lib/rhymes.test.ts` (inside the existing `describe('fetchRhymeGroups', …)` block):

```ts
it('uses explicit count over scheme.groupCount when provided', async () => {
  const create = vi.fn(async () => ({
    content: [
      { type: 'tool_use', name: 'rhyme_groups', input: { groups: [] } },
    ],
  }));
  const client = { messages: { create } } as any;
  await fetchRhymeGroups({ client, language: 'uk', schemeId: 'free', count: 23 });
  const promptArg = create.mock.calls[0][0].messages[0].content as string;
  // The Ukrainian prompt template embeds the count number; assert it's our override.
  expect(promptArg).toMatch(/23/);
});

it('falls back to scheme.groupCount when count is omitted', async () => {
  const create = vi.fn(async () => ({
    content: [
      { type: 'tool_use', name: 'rhyme_groups', input: { groups: [] } },
    ],
  }));
  const client = { messages: { create } } as any;
  // 'free' scheme has groupCount: 10
  await fetchRhymeGroups({ client, language: 'uk', schemeId: 'free' });
  const promptArg = create.mock.calls[0][0].messages[0].content as string;
  expect(promptArg).toMatch(/(^|\s|\D)10(\s|\D|$)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/rhymes.test.ts`
Expected: FAIL — `count` not a known property on `FetchOpts`.

- [ ] **Step 3: Implement the override**

In `lib/rhymes.ts`:

```ts
export type FetchOpts = {
  client?: Pick<Anthropic, 'messages'>;
  language?: LanguageId;
  exclude?: RhymeExclusion;
  difficultyId?: DifficultyId;
  schemeId?: RhymeSchemeId;
  /** Override scheme.groupCount when set — used to size rhymes to song duration. */
  count?: number;
};
```

And in `fetchRhymeGroups`, change the `count` derivation:

```ts
const difficulty = getDifficulty(opts.difficultyId);
const scheme = getRhymeScheme(opts.schemeId);
const count = opts.count ?? scheme.groupCount;
```

(Leave everything else in the function unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/rhymes.test.ts`
Expected: PASS for both new tests and all existing tests in the file.

- [ ] **Step 5: Commit**

```bash
git add lib/rhymes.ts lib/rhymes.test.ts
git commit -m "feat(rhymes): allow caller to override scheme.groupCount"
```

---

## Task 2: Forward `count` through `/api/rhymes`

**Files:**
- Modify: `app/api/rhymes/route.ts`

The route reads `language`, `difficultyId`, `schemeId`, and `exclude` from the JSON body and passes them to `fetchRhymeGroups`. Add the same passthrough for `count` (positive integer; bound at 40 to stay within `max_tokens: 4096`).

- [ ] **Step 1: Modify the body parser**

In `app/api/rhymes/route.ts`, inside the `try { … } catch {}` block, after the existing `exclude` parsing, add:

```ts
let count: number | undefined;
if (typeof body?.count === 'number' && Number.isFinite(body.count)) {
  count = Math.max(1, Math.min(40, Math.floor(body.count)));
}
```

- [ ] **Step 2: Forward `count` to `fetchRhymeGroups`**

Update the `fetchRhymeGroups` call to:

```ts
const groups = await fetchRhymeGroups({
  client,
  language: lang.id,
  exclude,
  difficultyId: getDifficulty(rawDifficultyId).id,
  schemeId: getRhymeScheme(rawSchemeId).id,
  count,
});
```

- [ ] **Step 3: Add `count` to the local accumulator declaration**

The existing code declares `rawLanguage`, `rawDifficultyId`, `rawSchemeId` together. Declare `count` near them so the variable is in scope outside the `try`:

```ts
let count: number | undefined;
```

(Move the assignment inside the `try` body. The earlier step's snippet already shows the assignment.)

- [ ] **Step 4: Smoke-check the route compiles**

Run: `npx tsc --noEmit`
Expected: No new TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/rhymes/route.ts
git commit -m "feat(api): accept optional count in /api/rhymes body"
```

---

## Task 3: Pure helper — compute `{targetBars, count}` from duration

**Files:**
- Create: `lib/rhyme-fill.ts`
- Test: `lib/rhyme-fill.test.ts`

A small pure function so the math is testable and not entangled with hooks. Used later in `useGamePhases`.

- [ ] **Step 1: Write the failing test**

Create `lib/rhyme-fill.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeRhymeFillPlan } from './rhyme-fill';

describe('computeRhymeFillPlan', () => {
  it('computes targetBars from duration, bpm, startOffset', () => {
    // 180s at 90bpm with 0 offset: 180 * 90 / 240 = 67.5 → 67 bars
    const plan = computeRhymeFillPlan({ duration: 180, bpm: 90, startOffset: 0, wordsPerGroup: null });
    expect(plan.targetBars).toBe(67);
  });

  it('subtracts startOffset before computing bars', () => {
    // (180 - 4)s at 90bpm: 176 * 90 / 240 = 66 bars
    const plan = computeRhymeFillPlan({ duration: 180, bpm: 90, startOffset: 4, wordsPerGroup: null });
    expect(plan.targetBars).toBe(66);
  });

  it('uses wordsPerGroup=2 for free scheme (null) — conservative under-estimate', () => {
    // 67 targetBars / 2 minWords = 34 groups
    const plan = computeRhymeFillPlan({ duration: 180, bpm: 90, startOffset: 0, wordsPerGroup: null });
    expect(plan.count).toBe(34);
  });

  it('uses scheme.wordsPerGroup when set (couplets = 2)', () => {
    // 67 / 2 = 34
    const plan = computeRhymeFillPlan({ duration: 180, bpm: 90, startOffset: 0, wordsPerGroup: 2 });
    expect(plan.count).toBe(34);
  });

  it('uses scheme.wordsPerGroup when set (bar4 = 4)', () => {
    // 67 / 4 = 17 (ceil)
    const plan = computeRhymeFillPlan({ duration: 180, bpm: 90, startOffset: 0, wordsPerGroup: 4 });
    expect(plan.count).toBe(17);
  });

  it('clamps count to the 4..40 range', () => {
    // tiny song
    expect(computeRhymeFillPlan({ duration: 10, bpm: 90, startOffset: 0, wordsPerGroup: null }).count).toBe(4);
    // huge song
    expect(computeRhymeFillPlan({ duration: 2000, bpm: 120, startOffset: 0, wordsPerGroup: 2 }).count).toBe(40);
  });

  it('returns 0 targetBars (not negative) when startOffset >= duration', () => {
    const plan = computeRhymeFillPlan({ duration: 5, bpm: 90, startOffset: 10, wordsPerGroup: null });
    expect(plan.targetBars).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/rhyme-fill.test.ts`
Expected: FAIL — `Cannot find module './rhyme-fill'`.

- [ ] **Step 3: Create the implementation**

Create `lib/rhyme-fill.ts`:

```ts
export type FillPlanInput = {
  duration: number;          // seconds
  bpm: number;
  startOffset: number;       // seconds before beat 1
  wordsPerGroup: number | null; // scheme.wordsPerGroup; null = free (variable)
};

export type FillPlan = {
  targetBars: number;
  count: number; // groups to request from /api/rhymes
};

const MIN_GROUPS = 4;
const MAX_GROUPS = 40;
const FREE_MIN_WORDS_PER_GROUP = 2;

export function computeRhymeFillPlan(input: FillPlanInput): FillPlan {
  const playable = Math.max(0, input.duration - input.startOffset);
  const targetBars = Math.floor((playable * input.bpm) / 240);
  const minWords = input.wordsPerGroup ?? FREE_MIN_WORDS_PER_GROUP;
  const rawCount = Math.ceil(targetBars / minWords);
  const count = Math.max(MIN_GROUPS, Math.min(MAX_GROUPS, rawCount));
  return { targetBars, count };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/rhyme-fill.test.ts`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/rhyme-fill.ts lib/rhyme-fill.test.ts
git commit -m "feat(rhyme-fill): pure helper to size rhymes to song duration"
```

---

## Task 4: `useBeat` exposes `duration`, disables `loop`

**Files:**
- Modify: `hooks/useBeat.ts`

`useBeat` currently sets `a.loop = true` and exposes `{ audio, isReady, isPlaying, error, play, pause, stop }`. We need it to set `a.loop = false` and expose `duration` (read from `loadedmetadata`).

No unit test for the hook itself (the existing code has no `useBeat.test.ts` — hook is verified by `useGamePhases` consumer and manual play). We add a TS-level check by using the type in a downstream hook in Task 6.

- [ ] **Step 1: Update `BeatHandle` type**

In `hooks/useBeat.ts`, modify the exported type:

```ts
export type BeatHandle = {
  audio: HTMLAudioElement | null;
  isReady: boolean;
  isPlaying: boolean;
  error: string | null;
  duration: number | null;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
};
```

- [ ] **Step 2: Add `duration` state and `loadedmetadata` listener; set `loop = false`**

Replace the body of `useBeat` with:

```ts
export function useBeat(beat: Beat | undefined): BeatHandle {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isReady, setReady] = useState(false);
  const [isPlaying, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    setReady(false);
    setError(null);
    setPlaying(false);
    setDuration(null);
    if (!beat) {
      audioRef.current = null;
      return;
    }
    const a = new Audio(beat.src);
    a.loop = false;
    a.preload = 'auto';
    const onCanPlay = () => setReady(true);
    const onError = () => setError('Failed to load beat');
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onMeta = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) {
        setDuration(a.duration);
      }
    };
    a.addEventListener('canplaythrough', onCanPlay);
    a.addEventListener('error', onError);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('loadedmetadata', onMeta);
    audioRef.current = a;
    return () => {
      a.pause();
      a.removeEventListener('canplaythrough', onCanPlay);
      a.removeEventListener('error', onError);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('loadedmetadata', onMeta);
      audioRef.current = null;
    };
  }, [beat?.src]);

  return {
    audio: audioRef.current,
    isReady,
    isPlaying,
    error,
    duration,
    play: async () => {
      const a = audioRef.current;
      if (!a) return;
      a.currentTime = 0;
      await a.play();
    },
    pause: () => audioRef.current?.pause(),
    stop: () => {
      const a = audioRef.current;
      if (!a) return;
      a.pause();
      a.currentTime = 0;
    },
  };
}
```

- [ ] **Step 3: TypeScript compile check**

Run: `npx tsc --noEmit`
Expected: No new errors. (Consumers of `BeatHandle` that destructure unknown fields don't exist; `duration` is a fresh property.)

- [ ] **Step 4: Run the whole test suite**

Run: `npm test`
Expected: PASS — nothing depends on `loop = true`.

- [ ] **Step 5: Commit**

```bash
git add hooks/useBeat.ts
git commit -m "feat(useBeat): expose duration, disable loop"
```

---

## Task 5: `useGameLoop` ends on `audio.ended`

**Files:**
- Modify: `hooks/useGameLoop.ts`

Currently the game ends when `currentBar >= totalBars`. With `loop = false` and bars sized to duration, the audio's natural end is the authoritative trigger. Keep the bar check as a safety net.

- [ ] **Step 1: Add an `ended` listener**

In `hooks/useGameLoop.ts`, modify the `useEffect` to also subscribe to the audio `ended` event. Replace the existing effect with:

```ts
useEffect(() => {
  if (!active || !audio) return;
  const sessionTime = makeSessionTimer(audio, startOffset);
  let raf = 0;
  let ended = false;
  const beatsPerSecond = bpm / 60;

  const terminate = () => {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    onEndRef.current();
  };

  const onAudioEnded = () => terminate();
  audio.addEventListener('ended', onAudioEnded);

  const frame = () => {
    const t = sessionTime();
    const currentBeat = t * beatsPerSecond;
    const currentBar = Math.floor(currentBeat / 4);
    const beatInBar = currentBeat % 4;
    const ballX = beatInBar / 4;
    setTick({ ballX, currentBar, beatInBar });
    if (currentBar >= totalBars) {
      terminate();
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    audio.removeEventListener('ended', onAudioEnded);
  };
}, [active, audio, bpm, totalBars, startOffset]);
```

- [ ] **Step 2: Run the test suite to confirm no regressions**

Run: `npm test`
Expected: PASS — `useGameLoop` has no direct tests; downstream tests still pass.

- [ ] **Step 3: Commit**

```bash
git add hooks/useGameLoop.ts
git commit -m "feat(useGameLoop): terminate on audio.ended in addition to bar-exhaustion"
```

---

## Task 6: `useGamePhases` waits for duration, sizes rhymes to song

**Files:**
- Modify: `hooks/useGamePhases.ts`

This is the central wiring change. After the user hits PLAY:

1. Phase flips to `'loading'`.
2. We wait for `beatHandle.duration` to become available (it arrives on `loadedmetadata`, typically <500ms).
3. We compute `{ targetBars, count }` via `computeRhymeFillPlan`.
4. We POST `count` to `/api/rhymes`.
5. We build bars from the returned groups, truncate to `targetBars`, then `setBars` and `setPhase('playing')`.

The current loading effect uses `[phase]` deps with an eslint-disable. We add `beatHandle.duration` to the deps (and update the comment), accepting that `playAgain` will re-run the effect once — which is the existing behavior anyway (it re-fetches rhymes on replay).

- [ ] **Step 1: Add imports**

Near the top of `hooks/useGamePhases.ts`, add:

```ts
import { getRhymeScheme, type RhymeSchemeId, DEFAULT_SCHEME } from '@/lib/rhyme-schemes';
import { computeRhymeFillPlan } from '@/lib/rhyme-fill';
```

(`getRhymeScheme` and `DEFAULT_SCHEME` and `RhymeSchemeId` are already imported — keep the existing imports; just add `computeRhymeFillPlan`. Verify only one import line for `@/lib/rhyme-schemes`.)

- [ ] **Step 2: Rewrite the loading effect**

Replace the existing `useEffect` that runs on `phase === 'loading'` with:

```ts
useEffect(() => {
  if (phase !== 'loading' || !activeBeat) return;
  if (beatHandle.duration == null) return; // wait for loadedmetadata
  let cancelled = false;
  const scheme = getRhymeScheme(schemeId);
  const plan = computeRhymeFillPlan({
    duration: beatHandle.duration,
    bpm: activeBeat.bpm,
    startOffset: activeBeat.startOffset ?? 0,
    wordsPerGroup: scheme.wordsPerGroup,
  });

  (async () => {
    try {
      const res = await fetch('/api/rhymes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          language: languageId,
          difficultyId,
          schemeId,
          count: plan.count,
          exclude: {
            words: usedWordsRef.current,
            endings: usedEndingsRef.current,
          },
        }),
      });
      if (!res.ok) throw new Error('rhymes-failed');
      const json = await res.json();
      if (cancelled) return;

      const allGroups: RhymeGroup[] = json.groups ?? [];
      const picked = sampleGroups(allGroups, allGroups.length); // shuffle, keep all
      const flat = flattenBars(picked, scheme);
      const newBars = flat.slice(0, Math.max(0, plan.targetBars));

      const roundWords = picked.flatMap(g => g.words);
      const roundEndings = picked.map(g => g.ending);
      usedWordsRef.current = [
        ...usedWordsRef.current,
        ...roundWords,
      ].slice(-MAX_EXCLUDED_WORDS);
      usedEndingsRef.current = [
        ...usedEndingsRef.current,
        ...roundEndings,
      ].slice(-MAX_EXCLUDED_ENDINGS);

      setBars(newBars);
      try {
        await beatHandle.play();
      } catch {
        throw new Error('audio-failed');
      }
      if (cancelled) return;
      setPhase('playing');
    } catch (err) {
      if (!cancelled) {
        setLoadError(
          err instanceof Error && err.message === 'audio-failed'
            ? "Couldn't play beat"
            : "Couldn't load rhymes"
        );
        setPhase('setup');
      }
    }
  })();
  return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // Intentional: effect reads languageId/difficultyId/schemeId/beatHandle as
  // stable snapshots from the render that set phase='loading'. playAgain()
  // deliberately re-uses the last settings by only setting phase, not re-setting
  // the other state. Effect re-fires once per (phase, duration) tuple — duration
  // is stable across replays of the same beat, so playAgain triggers exactly one
  // rhyme refetch. Do not add other deps without re-auditing playAgain.
}, [phase, beatHandle.duration]);
```

Notes on the change vs. the previous effect:
- New early `return` when `duration == null`. Effect re-fires when duration arrives.
- `count: plan.count` added to POST body.
- `sampleGroups(allGroups, scheme.groupCount)` → `sampleGroups(allGroups, allGroups.length)` so we shuffle but keep all returned groups. Truncation now lives in the bar layer (`flat.slice(0, plan.targetBars)`).

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No new errors. (Note: `Setup.test.ts` may reference an unrelated `getRhymeScheme` import — leave alone.)

- [ ] **Step 4: Full test suite**

Run: `npm test`
Expected: PASS — no test depends on the old fixed-count behavior.

- [ ] **Step 5: Commit**

```bash
git add hooks/useGamePhases.ts
git commit -m "feat(useGamePhases): size rhymes to song duration via /api/rhymes count"
```

---

## Task 7: `WordGrid` becomes the ball's host (overlay at active row)

**Files:**
- Modify: `components/WordGrid.tsx`
- Verify: `components/WordGrid.test.ts`

`WordGrid` will render `BouncingBall` as a child positioned absolutely over the active row (DOM index `2` in the sliding window). The ball's lowest point should reach the top edge of the active row's tiles.

- [ ] **Step 1: Confirm existing `WordGrid` tests still describe expected behavior**

Run: `npm test -- components/WordGrid.test.ts`
Expected: PASS (baseline before changes).

- [ ] **Step 2: Update `WordGrid.tsx` to render the ball overlay**

Open `components/WordGrid.tsx`. At the top, add the import:

```ts
import { BouncingBall } from './BouncingBall';
```

Wrap the existing rows in a relatively-positioned container and render the ball over the active row. Replace the top-level `<div className="space-y-2 select-none">` and its contents with:

```tsx
return (
  <div className="relative space-y-2 select-none">
    {visibleRows.map(({ index, bar }) => {
      // … existing per-row logic (UNCHANGED) …
    })}
    <BouncingBall
      x={ballX}
      activeRowDomIndex={2}
    />
  </div>
);
```

(Keep the existing per-row JSX exactly as-is between the braces. The only structural changes are: adding `relative` to the outermost `div`'s class, and appending `<BouncingBall …/>` after the `.map`.)

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: FAIL — `BouncingBall` does not yet accept `activeRowDomIndex`. This is fixed in Task 8.

- [ ] **Step 4: (no commit yet — bundled with Task 8)**

Hold the commit until `BouncingBall` has the matching prop. Step 5 of Task 8 commits both files together.

---

## Task 8: `BouncingBall` positions itself over the active row

**Files:**
- Modify: `components/BouncingBall.tsx`
- Verify: `components/BouncingBall.test.ts`

The ball is now absolutely positioned inside `WordGrid`. It needs to know the DOM index of the active row so it can compute its vertical offset. We use a CSS calc against row height + gap.

Row height (`py-5 lg:py-8` plus content) varies with breakpoint. Rather than hard-code, we let the parent container use `position: relative` and we anchor the ball with `top` = (rowHeight + gap) × `activeRowDomIndex`. Since row heights differ across breakpoints, we use a CSS variable supplied by `WordGrid`'s rendered rows? Simpler: measure once with a ref.

Approach: the ball gets a `ref` to the active row's DOM element passed through context — but that's heavy. Lighter: render the ball *inside* the active row's wrapper, positioned absolutely with `top: -BOUNCE_PX` so it floats above. This is the cleanest option and avoids cross-row geometry.

Adjusting Task 7's design: render `BouncingBall` as a sibling/child *inside* the active row's wrapper div, not as a sibling of the map. We refactor accordingly.

- [ ] **Step 1: Update `BouncingBall.tsx` for the new positioning model**

Replace the entire content of `components/BouncingBall.tsx` with:

```tsx
'use client';

export function computeBounceY(x: number): number {
  const cellPhase = (x * 4) % 1;
  return Math.sin(cellPhase * Math.PI);
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
 * The ball is positioned so its lowest point coincides with the row's top edge
 * on each beat and arcs up to `APEX_PX` above between beats.
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

Key differences from before:
- No outer relative wrapper (parent owns positioning context).
- `top` is computed so `yBounce = 1` → ball just kisses the row top (top = `-BALL_HALF`); `yBounce = 0` → ball is at `-APEX_PX` above.
- Removes the `activeRowDomIndex` prop introduced in Task 7's draft — we'll fix the WordGrid call site in Step 3.
- Adds the optional squash on landing.

- [ ] **Step 2: Update `BouncingBall.test.ts` if needed**

Open `components/BouncingBall.test.ts`. The existing tests assert `computeBounceY` returns; this is unchanged. No edits needed. Run to confirm:

```
npm test -- components/BouncingBall.test.ts
```

Expected: PASS — `computeBounceY` math is preserved.

- [ ] **Step 3: Fix `WordGrid` to render the ball inside the active row**

Reopen `components/WordGrid.tsx`. Remove the `activeRowDomIndex` prop usage from Task 7 (it doesn't exist on `BouncingBall`). Render the ball *inside* the active row's wrapper div instead.

Find the `if (isActive) { return ( <div … position: relative …> … {rowContent} </div> )` branch and add the `<BouncingBall>` inside that wrapper, after `{rowContent}`:

```tsx
if (isActive) {
  return (
    <div
      key={index}
      style={{ opacity, position: 'relative', transition: 'opacity 600ms ease' }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '-8px -10px',
          borderRadius: '18px',
          background: 'radial-gradient(ellipse at 50% 50%, rgba(94,200,255,0.10) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      {rowContent}
      <BouncingBall x={ballX} />
    </div>
  );
}
```

Also revert the outermost `div`'s class back to `space-y-2 select-none` (removing `relative` — it was unnecessary now that the ball lives inside the active row's container).

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: PASS across all suites. `WordGrid.test.ts` covers `rowOpacity` only, not visual position; unaffected.

- [ ] **Step 5: Commit the WordGrid + BouncingBall pair**

```bash
git add components/WordGrid.tsx components/BouncingBall.tsx
git commit -m "feat(ball): hop on tiles inside active row with landing squash"
```

---

## Task 9: Remove the standalone `<BouncingBall>` from `Game`

**Files:**
- Modify: `components/Game.tsx`

The ball is now rendered inside `WordGrid`. Remove the duplicate render and its import.

- [ ] **Step 1: Remove the duplicate render and import**

In `components/Game.tsx`:

Remove the import line:

```ts
import { BouncingBall } from './BouncingBall';
```

In the `phase === 'playing'` branch, remove the line:

```tsx
<BouncingBall x={tick.ballX} />
```

Keep everything else (including the `<WordGrid …/>` line directly below it). The result for that block is:

```tsx
<div className="mt-4 mx-auto w-full max-w-md lg:max-w-3xl">
  <WordGrid bars={bars} activeRow={tick.currentBar} ballX={tick.ballX} />
</div>
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors. (`BouncingBall` is now used only by `WordGrid` and the upcoming `LoadingScreen`.)

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/Game.tsx
git commit -m "refactor(game): drop standalone BouncingBall — now rendered inside WordGrid"
```

---

## Task 10: Build `LoadingScreen`

**Files:**
- Create: `components/LoadingScreen.tsx`

Reuses `WordGrid` (rendered with empty bars) and the ball animation. The ball is driven by a local raf clock at the chosen BPM.

- [ ] **Step 1: Create the component**

Create `components/LoadingScreen.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { WordGrid } from './WordGrid';

type Props = {
  /** BPM for the preview animation. Defaults to 90 when undefined. */
  bpm?: number;
};

export function LoadingScreen({ bpm = 90 }: Props) {
  const [ballX, setBallX] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const beatsPerSecond = bpm / 60;
    const frame = (now: number) => {
      if (startRef.current == null) startRef.current = now;
      const elapsed = (now - startRef.current) / 1000;
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
      </div>
    </main>
  );
}
```

Notes:
- `bars={[]}`, `activeRow={0}` — `WordGrid` will render the window `[-2 .. 5]`, all rows showing as blank cells (no `bar`), with row index `0` marked active so `BouncingBall` renders inside it.
- The wrapper style mirrors `Game.tsx`'s playing branch exactly so the loading→playing transition is seamless.

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/LoadingScreen.tsx
git commit -m "feat(loading): themed loading screen with bouncing ball preview"
```

---

## Task 11: Wire `LoadingScreen` into `Game.tsx`

**Files:**
- Modify: `components/Game.tsx`

Replace the `Loading…` text block with `<LoadingScreen bpm={activeBeat?.bpm} />`.

- [ ] **Step 1: Add the import and swap the loading branch**

In `components/Game.tsx`, add at the imports:

```ts
import { LoadingScreen } from './LoadingScreen';
```

Replace the existing `phase === 'loading'` branch:

```tsx
{phase === 'loading' && (
  <motion.div key="loading" {...fadePage}>
    <div className="flex min-h-screen items-center justify-center text-xl">
      Loading…
    </div>
  </motion.div>
)}
```

with:

```tsx
{phase === 'loading' && (
  <motion.div key="loading" {...fadePage}>
    <LoadingScreen bpm={activeBeat?.bpm} />
  </motion.div>
)}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/Game.tsx
git commit -m "feat(game): use themed LoadingScreen instead of plain text"
```

---

## Task 12: Restyle `EndScreen` to Ice & Chrome

**Files:**
- Modify: `components/EndScreen.tsx`

Match the navy + cyan-glow theme used in Setup and Game's playing branch. Primary button mirrors Setup's PLAY (navy text on cyan gradient).

- [ ] **Step 1: Replace `EndScreen` body**

Replace the contents of `components/EndScreen.tsx` with:

```tsx
'use client';

import { motion } from 'framer-motion';

type Props = {
  onPlayAgain: () => void;
  onChangeBeat: () => void;
};

export function EndScreen({ onPlayAgain, onChangeBeat }: Props) {
  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-6 bg-[#060c14]"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 30% at 50% -5%, rgba(94,200,255,0.13) 0%, transparent 100%)',
      }}
    >
      <h2
        className="text-5xl font-extrabold text-white"
        style={{ textShadow: '0 0 16px rgba(94,200,255,0.45)' }}
      >
        Nice work!
      </h2>
      <motion.button
        whileTap={{ scale: 0.96 }}
        transition={{ duration: 0.1 }}
        onClick={onPlayAgain}
        className="rounded-2xl px-10 py-4 text-2xl font-extrabold text-[#060c14]"
        style={{
          background: 'linear-gradient(135deg,#5ec8ff,#2860e0)',
          boxShadow: '0 0 32px rgba(94,200,255,0.45)',
        }}
      >
        Play again
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.96 }}
        transition={{ duration: 0.1 }}
        onClick={onChangeBeat}
        className="rounded-2xl border px-10 py-4 text-xl"
        style={{
          borderColor: 'rgba(94,200,255,0.4)',
          color: 'rgba(94,200,255,0.9)',
        }}
      >
        Change beat
      </motion.button>
    </main>
  );
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: PASS — `EndScreen` has no dedicated test file.

- [ ] **Step 4: Commit**

```bash
git add components/EndScreen.tsx
git commit -m "feat(endscreen): restyle to Ice & Chrome theme"
```

---

## Task 13: Manual verification (no commit)

This is a verification-only task — no code changes. Run the dev server and exercise the four fixes end-to-end.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open the printed URL (usually `http://localhost:3000`).

- [ ] **Step 2: Verify the Loading screen**

Pick a beat, language, scheme. Hit PLAY. Confirm:
- Background is navy with the top cyan glow (matches gameplay).
- An empty `WordGrid` skeleton is visible.
- The ball is hopping across the active row at the chosen BPM.
- "Loading rhymes…" text is visible below the grid in low-opacity cyan.
- Transition from loading → playing is seamless (no layout jump).

- [ ] **Step 3: Verify the ball lands on tiles**

While playing:
- The ball visibly arcs and "lands" on each cell's top edge once per beat.
- On the 4th beat, the ball lands on the colored word tile in the rightmost column.
- A subtle squash is visible at the bottom of each hop (small flatten/widen).
- Test both phone-portrait (resize browser to ~400px wide) and desktop widths.

- [ ] **Step 4: Verify rhymes fill the song**

- Pick a long beat (e.g. one of the `barsPerLoop: 64` boom-bap tracks).
- Confirm rhymes are visible across most of the song (no early dead zone of just instrumental).
- Confirm the game ends right as the audio ends — not earlier, not on a loop restart.
- Pick a short beat (`Bounce` has `barsPerLoop: 16`) and confirm it ends correctly without trying to play past the file's natural end.

- [ ] **Step 5: Verify `playAgain` regenerates rhymes**

- After the game ends, hit "Play again". A fresh loading screen appears, new rhymes load, and the game restarts. Confirm the words on subsequent rounds differ from the previous round (exclusion still works).

- [ ] **Step 6: Verify the end screen styling**

- After the song ends, the "Nice work!" screen shows:
  - Navy background with the same cyan top glow.
  - "Nice work!" headline in white with a subtle cyan glow.
  - "Play again" button on the cyan gradient with navy text (matches Setup's PLAY).
  - "Change beat" as a cyan-outlined ghost button below.

- [ ] **Step 7: YouTube beat smoke test**

- Switch the setup toggle to YouTube, paste a known-working YouTube URL (if you have one configured), and verify all four behaviors above also work for YT beats.

---

## Task 14: Final verification & branch handoff

- [ ] **Step 1: Run the full test suite one more time**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 3: Summarize the diff and stop**

Run: `git log --oneline master..HEAD`
Expected: ~10–12 commits, each scoped to a single task.

Hand back to the user for review/merge.

---

## Self-review (post-write)

**Spec coverage:**
- §1 Loading screen → Task 10 (LoadingScreen) + Task 11 (wired into Game). ✓
- §2 Ball hops on tiles → Task 7 (WordGrid hosts ball) + Task 8 (BouncingBall geometry) + Task 9 (remove duplicate). ✓
- §3 Rhymes fill the song → Task 1 (`fetchRhymeGroups` count override) + Task 2 (API forward) + Task 3 (`computeRhymeFillPlan`) + Task 4 (`useBeat.duration` + loop=false) + Task 5 (`useGameLoop.ended`) + Task 6 (`useGamePhases` wiring). ✓
- §4 End screen restyle → Task 12. ✓
- Manual verification (visual + playAgain) → Task 13. ✓
- Build sanity → Task 14. ✓

**Placeholder scan:** No "TBD", "TODO", or "fill in" markers. Every code step has runnable code. Every test step has assertions.

**Type consistency:**
- `FetchOpts.count?: number` (Task 1) → API route forwards `count?: number` (Task 2) → `computeRhymeFillPlan` returns `{ targetBars: number, count: number }` (Task 3) → `useGamePhases` posts `count: plan.count` (Task 6). ✓
- `BeatHandle.duration: number | null` (Task 4) → `useGamePhases` reads `beatHandle.duration` (Task 6). ✓
- `BouncingBall` props: `{ x: number }` only (Task 8, after revision in step 1). The intermediate `activeRowDomIndex` prop from Task 7's draft is explicitly removed in Task 8 step 3. ✓
- `LoadingScreen` props: `{ bpm?: number }` (Task 10). `Game.tsx` calls `<LoadingScreen bpm={activeBeat?.bpm} />` (Task 11). ✓
