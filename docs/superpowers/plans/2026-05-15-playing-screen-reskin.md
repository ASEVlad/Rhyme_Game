# Playing Screen Reskin & Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Hybrid C visual reskin (navy bg, cyan chrome, rhyme colors intact), add ball bounce that lands on cell tops, slow down the prev-row fade, and fix the row-transition layout glitch via invisible buffer rows.

**Architecture:** Four files touched, no new files. Pure functions are extracted from `BouncingBall.tsx` and `WordGrid.tsx` so the bounce formula and opacity logic can be unit-tested before updating the components. `Game.tsx` and `YtGame.tsx` get identical background changes.

**Tech Stack:** Next.js 14, React 18, Tailwind CSS, Vitest

**Spec:** `docs/superpowers/specs/2026-05-15-playing-screen-reskin.md`

---

## File map

| File | What changes |
|------|-------------|
| `components/BouncingBall.tsx` | Export `computeBounceY`; `h-10` container; `top`-based position; cyan gradient + glow |
| `components/BouncingBall.test.ts` | New — unit tests for `computeBounceY` |
| `components/WordGrid.tsx` | Export `rowOpacity`; extend window with buffer rows; cyan cells + spotlight; 600ms transition |
| `components/WordGrid.test.ts` | New — unit tests for `rowOpacity` |
| `components/Game.tsx` | `<main>` bg `#060c14` + static cyan radial top glow |
| `components/YtGame.tsx` | Identical `<main>` change |

---

## Task 1: BouncingBall — bounce formula

**Files:**
- Modify: `components/BouncingBall.tsx`
- Create: `components/BouncingBall.test.ts`

- [ ] **Step 1.1 — Write the failing tests**

Create `components/BouncingBall.test.ts`:

```ts
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

  it('returns ~0.707 at quarter phase within a cell', () => {
    // x=0.0625 → cellPhase=0.25 → sin(π/4) ≈ 0.707
    expect(computeBounceY(0.0625)).toBeCloseTo(0.707, 2);
  });
});
```

- [ ] **Step 1.2 — Run to confirm failure**

```bash
cd /home/asevlad/program_files/github_asevlad/Rhyme_Game && npx vitest run components/BouncingBall.test.ts
```

Expected: FAIL — `computeBounceY is not a function` (not exported yet).

- [ ] **Step 1.3 — Export `computeBounceY` and update component**

Replace the entire contents of `components/BouncingBall.tsx` with:

```tsx
'use client';

export function computeBounceY(x: number): number {
  const cellPhase = (x * 4) % 1;
  return Math.sin(cellPhase * Math.PI);
}

const BOUNCE_PX = 26;

type Props = {
  /** 0..1 across the row width */
  x: number;
};

export function BouncingBall({ x }: Props) {
  const yBounce = computeBounceY(x);
  return (
    <div className="relative h-10 w-full">
      <div
        className="absolute h-3.5 w-3.5 rounded-full"
        style={{
          left: `${x * 100}%`,
          top: `${yBounce * BOUNCE_PX}px`,
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #5ec8ff, #2860e0)',
          boxShadow: '0 0 14px rgba(94,200,255,0.9), 0 0 28px rgba(94,200,255,0.35)',
        }}
      />
    </div>
  );
}
```

- [ ] **Step 1.4 — Run tests to confirm pass**

```bash
cd /home/asevlad/program_files/github_asevlad/Rhyme_Game && npx vitest run components/BouncingBall.test.ts
```

Expected: PASS — 3 tests passing.

- [ ] **Step 1.5 — Run full suite to check no regressions**

```bash
cd /home/asevlad/program_files/github_asevlad/Rhyme_Game && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 1.6 — Commit**

```bash
git add components/BouncingBall.tsx components/BouncingBall.test.ts
git commit -m "feat: ball bounces down to land on cell tops, cyan restyle"
```

---

## Task 2: WordGrid — buffer rows, opacity logic, cyan reskin

**Files:**
- Modify: `components/WordGrid.tsx`
- Create: `components/WordGrid.test.ts`

- [ ] **Step 2.1 — Write failing tests for `rowOpacity`**

Create `components/WordGrid.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rowOpacity } from './WordGrid';

describe('rowOpacity', () => {
  const ws = 4; // windowSize

  it('returns 1 for the active row', () => {
    expect(rowOpacity(5, 5, ws)).toBe(1);
  });

  it('returns 0.07 for the single near-past row', () => {
    expect(rowOpacity(4, 5, ws)).toBe(0.07);
  });

  it('returns 0 for invisible buffer rows above', () => {
    expect(rowOpacity(3, 5, ws)).toBe(0);
    expect(rowOpacity(0, 5, ws)).toBe(0);
  });

  it('returns 0.28 for upcoming rows within the window', () => {
    expect(rowOpacity(6, 5, ws)).toBe(0.28);  // activeRow + 1
    expect(rowOpacity(9, 5, ws)).toBe(0.28);  // activeRow + windowSize
  });

  it('returns 0 for the invisible buffer row below the window', () => {
    expect(rowOpacity(10, 5, ws)).toBe(0); // activeRow + windowSize + 1
    expect(rowOpacity(11, 5, ws)).toBe(0);
  });

  it('works correctly at activeRow = 0 (start of game)', () => {
    expect(rowOpacity(0, 0, ws)).toBe(1);    // active
    expect(rowOpacity(-1, 0, ws)).toBe(0.07); // near past (will be null bar, just needs opacity)
    expect(rowOpacity(-2, 0, ws)).toBe(0);   // buffer
    expect(rowOpacity(1, 0, ws)).toBe(0.28); // upcoming
    expect(rowOpacity(5, 0, ws)).toBe(0);    // buffer below
  });
});
```

- [ ] **Step 2.2 — Run to confirm failure**

```bash
cd /home/asevlad/program_files/github_asevlad/Rhyme_Game && npx vitest run components/WordGrid.test.ts
```

Expected: FAIL — `rowOpacity is not a function`.

- [ ] **Step 2.3 — Export `rowOpacity` and rewrite `WordGrid.tsx`**

Replace the entire contents of `components/WordGrid.tsx` with:

```tsx
'use client';

import type { Bar } from '@/lib/flatten-bars';
import type { RhymeColor } from '@/lib/colors';

const COLOR_BG: Record<RhymeColor, string> = {
  yellow: 'bg-rhyme-yellow text-bg',
  blue:   'bg-rhyme-blue text-white',
  orange: 'bg-rhyme-orange text-white',
  red:    'bg-rhyme-red text-white',
};

const COLOR_SHADOW: Record<RhymeColor, string> = {
  yellow: '0 0 16px rgba(255,212,71,0.5)',
  blue:   '0 0 16px rgba(58,163,255,0.6)',
  orange: '0 0 16px rgba(255,138,60,0.5)',
  red:    '0 0 16px rgba(228,77,77,0.5)',
};

export function rowOpacity(index: number, activeRow: number, windowSize: number): number {
  if (index === activeRow) return 1;
  if (index === activeRow - 1) return 0.07;
  if (index < activeRow - 1 || index > activeRow + windowSize) return 0;
  return 0.28;
}

type Props = {
  bars: Bar[];
  /** index into bars[] currently being played */
  activeRow: number;
  /** ballX 0..1 — used to highlight the active cell */
  ballX: number;
  /** how many rows to show above and below the active one */
  windowSize?: number;
  /** hide rhyme words for the first N bars so the player can feel the beat first */
  introRows?: number;
};

export function WordGrid({ bars, activeRow, ballX, windowSize = 4, introRows = 2 }: Props) {
  const start = activeRow - 2;
  const end = activeRow + windowSize + 1;
  const visibleRows: Array<{ index: number; bar: Bar | null }> = [];
  for (let i = start; i <= end; i++) {
    visibleRows.push({ index: i, bar: bars[i] ?? null });
  }
  const activeCol = Math.min(3, Math.floor(ballX * 4));

  return (
    <div className="space-y-2 select-none">
      {visibleRows.map(({ index, bar }) => {
        const isActive = index === activeRow;
        const opacity  = rowOpacity(index, activeRow, windowSize);

        const rowContent = (
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map(col => {
              const isWordCell  = col === 3;
              const cellActive  = isActive && col === activeCol;

              if (isWordCell && bar && index >= introRows) {
                return (
                  <div
                    key={col}
                    className={[
                      'rounded-2xl py-5 text-center text-xl font-black',
                      COLOR_BG[bar.color],
                      isActive ? 'ring-2 ring-white/80' : '',
                    ].join(' ')}
                    style={isActive ? { boxShadow: COLOR_SHADOW[bar.color] } : undefined}
                  >
                    {bar.word}
                  </div>
                );
              }

              return (
                <div
                  key={col}
                  className={[
                    'rounded-2xl py-5',
                    cellActive
                      ? 'bg-[rgba(94,200,255,0.20)] border border-[rgba(94,200,255,0.40)]'
                      : 'bg-[rgba(94,200,255,0.06)]',
                  ].join(' ')}
                />
              );
            })}
          </div>
        );

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
            </div>
          );
        }

        return (
          <div
            key={index}
            style={{ opacity, transition: 'opacity 600ms ease' }}
          >
            {rowContent}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2.4 — Run WordGrid tests to confirm pass**

```bash
cd /home/asevlad/program_files/github_asevlad/Rhyme_Game && npx vitest run components/WordGrid.test.ts
```

Expected: PASS — 6 tests passing.

- [ ] **Step 2.5 — Run full suite**

```bash
cd /home/asevlad/program_files/github_asevlad/Rhyme_Game && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 2.6 — Commit**

```bash
git add components/WordGrid.tsx components/WordGrid.test.ts
git commit -m "feat: cyan beat cells, slow fade, buffer rows fix glitch"
```

---

## Task 3: Game.tsx — background reskin

**Files:**
- Modify: `components/Game.tsx`

No logic change — this is a pure visual className/style update.

- [ ] **Step 3.1 — Update the playing-phase `<main>` in `Game.tsx`**

In `components/Game.tsx`, find the playing-phase return (line ~59) and replace:

```tsx
// before
<main className="relative min-h-screen p-4 flex flex-col">
```

with:

```tsx
// after
<main
  className="relative min-h-screen p-4 flex flex-col bg-[#060c14]"
  style={{ backgroundImage: 'radial-gradient(ellipse 80% 30% at 50% -5%, rgba(94,200,255,0.13) 0%, transparent 100%)' }}
>
```

- [ ] **Step 3.2 — Run full suite**

```bash
cd /home/asevlad/program_files/github_asevlad/Rhyme_Game && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3.3 — Commit**

```bash
git add components/Game.tsx
git commit -m "feat: playing screen navy bg + cyan top glow"
```

---

## Task 4: YtGame.tsx — same background reskin

**Files:**
- Modify: `components/YtGame.tsx`

- [ ] **Step 4.1 — Update the playing-phase `<main>` in `YtGame.tsx`**

In `components/YtGame.tsx`, find the playing-phase return (line ~42) and replace:

```tsx
// before
<main className="relative min-h-screen p-4 flex flex-col">
```

with:

```tsx
// after
<main
  className="relative min-h-screen p-4 flex flex-col bg-[#060c14]"
  style={{ backgroundImage: 'radial-gradient(ellipse 80% 30% at 50% -5%, rgba(94,200,255,0.13) 0%, transparent 100%)' }}
>
```

- [ ] **Step 4.2 — Run full suite**

```bash
cd /home/asevlad/program_files/github_asevlad/Rhyme_Game && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4.3 — Commit**

```bash
git add components/YtGame.tsx
git commit -m "feat: yt playing screen navy bg + cyan top glow"
```
