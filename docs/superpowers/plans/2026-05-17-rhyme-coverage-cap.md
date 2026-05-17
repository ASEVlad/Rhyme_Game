# Rhyme Coverage Cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap rhyme coverage at 90 seconds of playable beat time so long songs no longer block the loading screen waiting for ~17–28 LLM-generated groups; instead they get ~9 groups and the tail of the song plays with empty bars.

**Architecture:** One change in `lib/rhyme-fill.ts` — introduce `MAX_RHYME_SECONDS = 90` and clamp the duration used for `targetBars` via `Math.min(playable, MAX_RHYME_SECONDS)`. Downstream code already handles a shorter `bars` array (`WordGrid` renders `bars[i] ?? null`; `useGameLoop` ends on the audio `ended` event, not bars exhaustion).

**Tech Stack:** TypeScript, Vitest, Next.js App Router (for manual smoke).

**Spec:** [docs/superpowers/specs/2026-05-17-rhyme-coverage-cap-design.md](../specs/2026-05-17-rhyme-coverage-cap-design.md)

---

### Task 1: Cap rhyme coverage at 90 seconds in `computeRhymeFillPlan`

**Files:**
- Modify: `lib/rhyme-fill.ts`
- Modify: `lib/rhyme-fill.test.ts`

#### Step 1: Replace `lib/rhyme-fill.test.ts` with the updated test file

- [ ] Replace the entire contents of `lib/rhyme-fill.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { computeRhymeFillPlan } from './rhyme-fill';

describe('computeRhymeFillPlan', () => {
  it('computes targetBars from playable duration', () => {
    // 60s at 90bpm with 0 offset: 60 * 90 / 240 = 22.5 → 22 bars
    const plan = computeRhymeFillPlan({ duration: 60, bpm: 90, startOffset: 0, wordsPerGroup: null });
    expect(plan.targetBars).toBe(22);
  });

  it('subtracts startOffset before computing bars', () => {
    // (60 - 4)s at 90bpm: 56 * 90 / 240 = 21 bars
    const plan = computeRhymeFillPlan({ duration: 60, bpm: 90, startOffset: 4, wordsPerGroup: null });
    expect(plan.targetBars).toBe(21);
  });

  it('uses wordsPerGroup=2 for free scheme (null) — conservative under-estimate', () => {
    // 22 targetBars / 2 minWords = 11 groups
    const plan = computeRhymeFillPlan({ duration: 60, bpm: 90, startOffset: 0, wordsPerGroup: null });
    expect(plan.count).toBe(11);
  });

  it('uses scheme.wordsPerGroup when set (couplets = 2)', () => {
    const plan = computeRhymeFillPlan({ duration: 60, bpm: 90, startOffset: 0, wordsPerGroup: 2 });
    expect(plan.count).toBe(11);
  });

  it('uses scheme.wordsPerGroup when set (bar4 = 4)', () => {
    // ceil(22 / 4) = 6
    const plan = computeRhymeFillPlan({ duration: 60, bpm: 90, startOffset: 0, wordsPerGroup: 4 });
    expect(plan.count).toBe(6);
  });

  it('clamps count to the 4..40 range', () => {
    // tiny song → MIN_GROUPS floor
    expect(
      computeRhymeFillPlan({ duration: 10, bpm: 90, startOffset: 0, wordsPerGroup: null }).count
    ).toBe(4);
    // extreme bpm to push above 40 even with the 90s cap → MAX_GROUPS ceiling
    expect(
      computeRhymeFillPlan({ duration: 90, bpm: 240, startOffset: 0, wordsPerGroup: 1 }).count
    ).toBe(40);
  });

  it('returns 0 targetBars (not negative) when startOffset >= duration', () => {
    const plan = computeRhymeFillPlan({ duration: 5, bpm: 90, startOffset: 10, wordsPerGroup: null });
    expect(plan.targetBars).toBe(0);
  });

  it('caps targetBars at MAX_RHYME_SECONDS (90s) for long songs', () => {
    // 240s playable would give 90 bars uncapped; with 90s cap: floor(90*90/240) = 33
    const plan = computeRhymeFillPlan({ duration: 240, bpm: 90, startOffset: 0, wordsPerGroup: 4 });
    expect(plan.targetBars).toBe(33);
    // ceil(33 / 4) = 9 groups
    expect(plan.count).toBe(9);
  });

  it('applies cap after startOffset subtraction', () => {
    // 300s duration - 4s offset = 296s playable, capped to 90 → floor(90*90/240) = 33 bars
    const plan = computeRhymeFillPlan({ duration: 300, bpm: 90, startOffset: 4, wordsPerGroup: 4 });
    expect(plan.targetBars).toBe(33);
  });

  it('does not affect songs shorter than the cap', () => {
    // 60s playable < 90s cap → behavior identical to pre-cap math
    // ceil(floor(60*90/240) / 4) = ceil(22/4) = 6
    const plan = computeRhymeFillPlan({ duration: 60, bpm: 90, startOffset: 0, wordsPerGroup: 4 });
    expect(plan.count).toBe(6);
  });
});
```

#### Step 2: Run the tests to verify they fail

- [ ] Run:

```
npx vitest run lib/rhyme-fill.test.ts
```

Expected: multiple FAIL. The "caps targetBars at MAX_RHYME_SECONDS" test fails (expects 33, gets 90). The "clamps count to the 4..40 range" upper-bound assertion fails. Other tests pass because their inputs are already under 90s.

#### Step 3: Implement the cap in `lib/rhyme-fill.ts`

- [ ] Replace the entire contents of `lib/rhyme-fill.ts` with:

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
const MAX_RHYME_SECONDS = 90;

export function computeRhymeFillPlan(input: FillPlanInput): FillPlan {
  const playable = Math.max(0, input.duration - input.startOffset);
  const covered = Math.min(playable, MAX_RHYME_SECONDS);
  const targetBars = Math.floor((covered * input.bpm) / 240);
  const minWords = input.wordsPerGroup ?? FREE_MIN_WORDS_PER_GROUP;
  const rawCount = Math.ceil(targetBars / minWords);
  const count = Math.max(MIN_GROUPS, Math.min(MAX_GROUPS, rawCount));
  return { targetBars, count };
}
```

#### Step 4: Run the tests to verify they pass

- [ ] Run:

```
npx vitest run lib/rhyme-fill.test.ts
```

Expected: all tests PASS.

#### Step 5: Run the full test suite to confirm no regressions

- [ ] Run:

```
npx vitest run
```

Expected: all tests PASS. No other suite depends on the old uncapped numbers.

#### Step 6: Manual smoke test in the dev server

- [ ] Start the dev server:

```
npm run dev
```

- [ ] In a browser:
  - Pick a local beat that is longer than 90 seconds (most beats in the default catalog qualify) and click Play. Confirm the loading screen disappears noticeably faster than before.
  - Once playing, watch for the rhyme bars to run out at ~90 seconds into playable time. From that point until the song ends, the WordGrid should keep ticking (bouncing ball continues) with no words visible, and the beat should play through to the end. The end screen should still appear when the audio finishes.
  - Pick a beat shorter than 90 seconds (if available — otherwise skip this case) and confirm it still gets full coverage.
- [ ] If the YouTube flow is enabled in your local config, repeat with a 3+ minute YT URL to confirm the same behavior (both flows go through `useGamePhases`).

If any of the above fails, stop and investigate before committing.

#### Step 7: Commit

- [ ] Run:

```bash
git add lib/rhyme-fill.ts lib/rhyme-fill.test.ts
git commit -m "$(cat <<'EOF'
feat(rhymes): cap rhyme coverage at 90 seconds

Long songs no longer block the loading screen requesting groups for
their full duration. The beat plays to the end; bars past the rhyme
section render empty.

Spec: docs/superpowers/specs/2026-05-17-rhyme-coverage-cap-design.md
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- ✅ Cap at 90 seconds → Task 1 Step 3 (`MAX_RHYME_SECONDS = 90`, `Math.min(playable, MAX_RHYME_SECONDS)`)
- ✅ Short songs unaffected → Task 1 Step 1 ("does not affect songs shorter than the cap" test)
- ✅ Long songs capped → Task 1 Step 1 ("caps targetBars at MAX_RHYME_SECONDS" test)
- ✅ Cap applies after startOffset → Task 1 Step 1 ("applies cap after startOffset subtraction" test)
- ✅ Existing min/max group clamping preserved → Task 1 Step 1 ("clamps count to the 4..40 range" test, with extreme bpm to still reach the upper bound)
- ✅ Empty-tail visual behavior → No code change needed (verified by reading `WordGrid` and `useGameLoop` during brainstorming); covered by manual smoke in Step 6.
- ✅ Both Game and YtGame flows → Single change point in `useGamePhases`'s only call to `computeRhymeFillPlan`; covered by Step 6 manual smoke.

**Placeholder scan:** No TBDs, no TODOs, no "implement later", no "similar to". Every step has exact code or exact commands.

**Type consistency:** `FillPlanInput`, `FillPlan`, `MIN_GROUPS`, `MAX_GROUPS`, `FREE_MIN_WORDS_PER_GROUP` all retained with identical names. New constant `MAX_RHYME_SECONDS` introduced and used in exactly one place.

**Behavior preserved for under-cap inputs:** When `playable ≤ MAX_RHYME_SECONDS`, `Math.min(playable, 90) === playable`, so the function returns identical output to the pre-cap version. Verified by the "does not affect songs shorter than the cap" test.
