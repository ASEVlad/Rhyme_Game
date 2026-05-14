# Playing Screen Visual Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the playing phase visuals to a Concert/Stage aesthetic — deep black background, full-screen rhyme-group color pulse, active row amber spotlight, restyled golden ball, cell flash, and opacity-based row hierarchy.

**Architecture:** All changes are purely visual — no game logic, hooks, or API touched. Changes flow through 4 files in order: config/css first (background), then Game.tsx (pulse overlay, header fade, ball placement), then BouncingBall.tsx (restyle), then WordGrid.tsx (opacity tiers, spotlight, cell flash, tile sizing). TypeScript compile (`npx tsc --noEmit`) acts as the automated test after each task; visual verification in the browser closes each task.

**Tech Stack:** Next.js 14, Tailwind CSS, TypeScript, Vitest (for the one pure-logic unit test in Task 2)

---

## File Map

| File | What changes |
|------|-------------|
| `tailwind.config.ts` | `bg` color token `#0e1330` → `#080808` |
| `app/globals.css` | body background `#0e1330` → `#080808` |
| `components/Game.tsx` | pulse overlay div, header fade, move ball into grid wrapper, drop `yDip` prop |
| `components/BouncingBall.tsx` | remove `yDip`, shrink to 14px, golden gradient, `h-5` container |
| `components/WordGrid.tsx` | row opacity tiers, spotlight wrapper on active row, cell flash with border, bigger tiles |

---

## Task 1: Background color

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: Update the Tailwind `bg` token**

In `tailwind.config.ts`, change line 9:

```ts
// before
bg: '#0e1330',

// after
bg: '#080808',
```

- [ ] **Step 2: Update the body background in globals.css**

In `app/globals.css`, change line 5:

```css
/* before */
html, body { background: #0e1330; color: white; min-height: 100%; }

/* after */
html, body { background: #080808; color: white; min-height: 100%; }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts app/globals.css
git commit -m "feat: set deep black background #080808"
```

---

## Task 2: Ball restyle — BouncingBall.tsx + Game.tsx together

**Files:**
- Modify: `components/BouncingBall.tsx`
- Modify: `components/Game.tsx`

These two files are changed together because removing the `yDip` prop from `BouncingBall` and dropping it from the call site in `Game.tsx` must happen atomically — otherwise TypeScript errors in between commits. This task also adds the pulse overlay, header fade, and moves the ball inside the `max-w-md` container.

- [ ] **Step 1: Replace BouncingBall.tsx entirely**

```tsx
'use client';

type Props = {
  /** 0..1 across the row width */
  x: number;
};

export function BouncingBall({ x }: Props) {
  return (
    <div className="relative h-5 w-full">
      <div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full"
        style={{
          left: `${x * 100}%`,
          background: 'radial-gradient(circle at 35% 35%, #fff9e6, #ffc929)',
          boxShadow: '0 0 14px rgba(255,200,50,0.9), 0 0 28px rgba(255,200,50,0.35)',
        }}
      />
    </div>
  );
}
```

Note: `h-3.5 w-3.5` = 14×14px in Tailwind. `h-5` container = 20px.

- [ ] **Step 2: Add the `RhymeColor` import and `PULSE_COLOR` map at the top of Game.tsx**

Add after the existing imports (around line 14):

```tsx
import type { RhymeColor } from '@/lib/colors';

const PULSE_COLOR: Record<RhymeColor, string> = {
  yellow: 'rgba(255,212,71,0.10)',
  blue:   'rgba(58,163,255,0.10)',
  orange: 'rgba(255,138,60,0.10)',
  red:    'rgba(228,77,77,0.10)',
};
```

- [ ] **Step 3: Replace the playing-phase return block in Game.tsx**

Find the `// playing` comment (around line 162) and replace the entire return with:

```tsx
// playing
const activeColor = bars[tick.currentBar]?.color;
const pulseBackground = activeColor
  ? `radial-gradient(ellipse at 50% 35%, ${PULSE_COLOR[activeColor]} 0%, transparent 70%)`
  : 'transparent';

return (
  <main className="relative min-h-screen p-4 flex flex-col">
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ background: pulseBackground, transition: 'background 400ms ease', zIndex: 0 }}
    />
    <div className="relative" style={{ zIndex: 1 }}>
      <div className="flex justify-between mb-2" style={{ opacity: 0.18 }}>
        <button
          onClick={() => { if (confirm('End session?')) quitToSetup(); }}
          aria-label="Quit"
          className="text-white/70 text-xl"
        >←</button>
        <div className="text-white/60 text-sm">
          {activeBeat?.title} · {activeBeat?.bpm.toFixed(1)} BPM
        </div>
      </div>
      <div className="mt-4 mx-auto w-full max-w-md">
        <BouncingBall x={tick.ballX} />
        <WordGrid bars={bars} activeRow={tick.currentBar} ballX={tick.ballX} />
      </div>
    </div>
  </main>
);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit both files together**

```bash
git add components/BouncingBall.tsx components/Game.tsx
git commit -m "feat: restyle ball, add pulse overlay, fade header, move ball into grid wrapper"
```

---

## Task 4: WordGrid.tsx — opacity tiers, spotlight, cell flash, tile sizing

**Files:**
- Modify: `components/WordGrid.tsx`

This task rewrites the render logic inside `WordGrid`. Changes:

1. **Row opacity:** active = 1.0, upcoming = 0.28, past = 0.07 with a 300ms CSS transition.
2. **Active row spotlight:** only the active row gets a `position: relative` wrapper with an absolutely-positioned amber glow div.
3. **Cell flash:** the single cell matching `activeCol` (beat cells only, not word cell) gets `bg-white/20 border border-white/40`. All other non-word cells get `bg-white/[0.06]`.
4. **Word cell active glow:** when the active row's word cell is shown (`index >= introRows`), it gets `ring-2 ring-white/80` plus a per-color shadow.
5. **Tile sizing:** all cells — word and beat — get `py-5 rounded-2xl`. Word cells also get `font-black`.

- [ ] **Step 1: Add the per-color active word shadow map**

At the top of `components/WordGrid.tsx`, below the existing `COLOR_BG` map, add:

```tsx
const COLOR_SHADOW: Record<RhymeColor, string> = {
  yellow: '0 0 16px rgba(255,212,71,0.5)',
  blue:   '0 0 16px rgba(58,163,255,0.6)',
  orange: '0 0 16px rgba(255,138,60,0.5)',
  red:    '0 0 16px rgba(228,77,77,0.5)',
};
```

- [ ] **Step 2: Replace the return block of `WordGrid`**

Replace everything from `return (` to the closing `);` with:

```tsx
  return (
    <div className="space-y-2 select-none">
      {visibleRows.map(({ index, bar }) => {
        const isActive = index === activeRow;
        const isPast   = index < activeRow;
        const opacity  = isActive ? 1 : isPast ? 0.07 : 0.28;

        const rowContent = (
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map(col => {
              const isWordCell  = col === 3;
              const cellActive  = isActive && col === activeCol;

              if (isWordCell && bar && index >= introRows) {
                const isActiveWord = isActive;
                return (
                  <div
                    key={col}
                    className={[
                      'rounded-2xl py-5 text-center text-xl font-black',
                      COLOR_BG[bar.color],
                      isActiveWord ? 'ring-2 ring-white/80' : '',
                    ].join(' ')}
                    style={isActiveWord ? { boxShadow: COLOR_SHADOW[bar.color] } : undefined}
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
                      ? 'bg-white/20 border border-white/40'
                      : 'bg-white/[0.06]',
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
              style={{ opacity, position: 'relative' }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: '-8px -10px',
                  borderRadius: '18px',
                  background: 'radial-gradient(ellipse at 50% 50%, rgba(255,200,50,0.12) 0%, transparent 70%)',
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
            style={{
              opacity,
              transition: isPast ? 'opacity 300ms ease' : undefined,
            }}
          >
            {rowContent}
          </div>
        );
      })}
    </div>
  );
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run existing tests to confirm no regressions**

```bash
npm test
```

Expected: all tests pass (existing tests cover `BrowseBeats` logic, not visual components).

- [ ] **Step 5: Commit**

```bash
git add components/WordGrid.tsx
git commit -m "feat: row opacity tiers, active spotlight, cell flash, bigger tiles"
```

---

## Task 5: Visual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open `http://localhost:3000`, log in, pick a beat, and start a round.

- [ ] **Step 2: Check each visual requirement**

| Requirement | What to look for |
|-------------|-----------------|
| Deep black background | Page background is near-black, not navy |
| Color pulse | Background shifts colour subtly as rows scroll (yellow/blue/orange/red tints) |
| Header faded | Back arrow and beat title are barely visible |
| Ball restyled | Small golden circle above active row, no bounce arc |
| Ball alignment | Ball tracks left→right and aligns with cell centers |
| Cell flash | One beat cell per bar lights up with white border |
| Active row spotlight | Warm amber glow behind the active row |
| Inactive rows dimmed | Rows above/below active are clearly dimmer |
| Past row fades | The row just above active fades to near-invisible |
| Word cell glow | Active word tile has white ring + colour shadow |
| Tile size | Cells are taller and more rounded than before |

- [ ] **Step 3: Final commit if any tweaks were made**

```bash
git add -p   # stage only intentional tweaks
git commit -m "fix: visual tweaks from manual review"
```
