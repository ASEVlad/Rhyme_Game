# Rhyme Coverage Cap — Design

**Date:** 2026-05-17
**Status:** Approved (pending implementation plan)

## Goal

Reduce loading-screen wait time before a session by bounding the rhyme generator's output. Today, [`computeRhymeFillPlan`](../../../lib/rhyme-fill.ts) sizes the rhyme pool to cover the entire song; for a 3-minute beat at 90 BPM that's ~17 groups, and the LLM call dominates loading latency. After this change, rhyme coverage is capped at **90 seconds** regardless of song length. The beat still plays to the end; bars past the rhyme section render empty.

## Non-goals

- No streaming or background fetch of additional rhymes for the tail.
- No new UI element on the loading screen.
- No visual treatment for the empty tail (no fade, dim, or end card).
- No configurable cap exposed in settings — single constant, change later if data demands it.

## Architecture

Single localized change in [lib/rhyme-fill.ts](../../../lib/rhyme-fill.ts):

- Introduce `MAX_RHYME_SECONDS = 90`.
- In `computeRhymeFillPlan`, clamp the duration used for `targetBars` with `Math.min(playable, MAX_RHYME_SECONDS)`.

Everything downstream is already shaped to handle a shorter `bars` array:

- [hooks/useGamePhases.ts:75-105](../../../hooks/useGamePhases.ts) passes `plan.count` to `/api/rhymes` and slices to `plan.targetBars`. Both shrink automatically.
- [app/api/rhymes/route.ts](../../../app/api/rhymes/route.ts) already accepts `count` from the request body.
- [components/WordGrid.tsx:43-45](../../../components/WordGrid.tsx) renders `bars[i] ?? null` — empty cells past array end are a built-in case.
- [hooks/useGameLoop.ts:38-39](../../../hooks/useGameLoop.ts) ends the game on the audio `ended` event, not on bars exhaustion. The beat plays to the song's end even after rhymes run out.

This single-file change automatically covers both the local-beats Game flow and the YouTube YtGame flow because both go through `useGamePhases`.

## Behavior matrix

| Playable duration | Today | After change |
|---|---|---|
| ≤ 90s | Full coverage | Unchanged — full coverage |
| 3 min (180s playable) | ~17 groups, full coverage | ~9 groups; first 90s covered, rest empty |
| 5 min (300s playable) | ~28 groups, full coverage | ~9 groups; first 90s covered, rest empty |

"Playable" = `duration - startOffset`, matching the existing definition in `computeRhymeFillPlan`.

## Expected impact

LLM output tokens dominate loading-screen latency. On a typical 3-minute beat, requested groups drop from ~17 to ~9 — roughly halving generation time. Short songs (≤ 90s playable) are unaffected.

## Test plan

Add two cases to [lib/rhyme-fill.test.ts](../../../lib/rhyme-fill.test.ts):

1. **Long song is capped.** `duration: 240, startOffset: 0, bpm: 90, wordsPerGroup: 4`. Expected `targetBars` equals what 90 seconds at 90 BPM produces (`floor(90 * 90 / 240) = 33`), not what 240 seconds would produce (`90`).
2. **Short song is unaffected.** `duration: 60, startOffset: 0, bpm: 90, wordsPerGroup: 4`. `targetBars` equals today's value (`floor(60 * 90 / 240) = 22`).

Existing tests for min/max group bounds remain intact and must still pass.

## What we are NOT doing (and why)

- **No streaming/background top-up of rhymes for the tail.** Adds significant complexity (cancellation, race conditions across phase transitions) for a problem the cap already solves.
- **No visible cue when rhymes end.** The product decision was "just empty" — the beat continuing without bars is intentional and easy to read.
- **No localStorage knob.** YAGNI. The cap is one constant; revise based on real loading-time measurements after this lands.

## Files touched

- Modify: [lib/rhyme-fill.ts](../../../lib/rhyme-fill.ts)
- Modify: [lib/rhyme-fill.test.ts](../../../lib/rhyme-fill.test.ts)
