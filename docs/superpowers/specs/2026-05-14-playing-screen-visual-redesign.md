# Playing Screen Visual Redesign

**Date:** 2026-05-14
**Status:** Approved

## Summary

Full visual overhaul of the playing phase only. Direction: Concert/Stage — deep black background, warm amber spotlight on the active row, full-screen color pulse tied to the active rhyme group, restyled beat indicator (small golden ball + cell flash), and opacity-based row hierarchy. No changes to game logic, hooks, or API.

## Goals

- Replace the flat navy look with a dark, immersive stage aesthetic.
- Make the active row feel like a spotlight moment without adding UI clutter.
- Replace the large bouncing ball with a tighter, more precise beat indicator.
- Communicate rhythm through the grid itself (cell flash), not just an external element.

## Non-goals

- No changes to Setup, EndScreen, or loading phase visuals.
- No changes to game logic, `useGameLoop`, `useBeat`, or any hook internals.
- No new UI elements (no progress bar, bar counter, or score).
- No mobile-specific layout changes.

## Design Decisions

### 1. Background color

Change from `#0e1330` (navy) to `#080808` (deep black). Updated in both `tailwind.config.ts` (`bg` token) and `globals.css` (`html, body { background: #080808 }`).

### 2. Full-screen color pulse

A single `div` with `position: absolute; inset: 0; pointer-events: none; z-index: 0` sits behind all game content inside the playing `<main>`. The `<main>` must have `position: relative` and all content inside it needs `position: relative; z-index: 1` to sit above the overlay. Its `background` is a radial gradient centered at `50% 35%`, color-matched to the active rhyme group at ~10% opacity:

| RhymeColor | Pulse color |
|------------|-------------|
| yellow | `rgba(255, 212, 71, 0.10)` |
| blue   | `rgba(58, 163, 255, 0.10)` |
| orange | `rgba(255, 138, 60, 0.10)` |
| red    | `rgba(228, 77, 77, 0.10)`  |

CSS: `transition: background 400ms ease` on the div. The color is derived from `bars[tick.currentBar]?.color` in `Game.tsx`. When `currentBar` is out of range (before intro ends or after last bar), defaults to `transparent`.

### 3. Header during play

The header row (back arrow + beat title) gets `opacity: 0.18` applied inline via a wrapper div once the `playing` phase is active. Still tappable (no `pointer-events: none`).

### 4. Beat indicator — restyled ball

`BouncingBall.tsx` is simplified:

- **Size:** 14×14px circle (down from 28px)
- **Color:** `radial-gradient(circle at 35% 35%, #fff9e6, #ffc929)`
- **Glow:** `box-shadow: 0 0 14px rgba(255,200,50,0.9), 0 0 28px rgba(255,200,50,0.35)`
- **No vertical animation:** Remove `yDip` prop entirely. The ball moves only horizontally.
- **Container height:** Replace the `h-16` wrapper with `h-5` (20px). No bottom offset — ball is vertically centered in the strip.
- **Horizontal position:** `left` is still `${x * 100}%` with `-translate-x-1/2`. The `x` prop continues to come from `tick.ballX` (0..1).

**`Game.tsx` change:** Stop passing `yDip` to `BouncingBall`. The `tick.ballYDip` value continues to be computed by `useGameLoop` (no hook change needed) but is no longer consumed.

**Container alignment:** The ball strip must live inside the same `max-w-md mx-auto` wrapper as the grid, not as a full-width sibling. Move the `<BouncingBall>` render into the `<div className="mt-4 mx-auto w-full max-w-md">` container, directly above `<WordGrid>`. The ball's `x` value (0..1) then maps across the same width as the grid, keeping it aligned with cell centers:

| Beat | ballX approx | Cell center |
|------|-------------|-------------|
| 0    | 0.125       | 12.5%       |
| 1    | 0.375       | 37.5%       |
| 2    | 0.625       | 62.5%       |
| 3    | 0.875       | 87.5%       |

### 5. Cell flash

In `WordGrid`, only the single cell matching `activeCol` (i.e. `isActive && col === activeCol`) gets the flash — not all beat cells in the active row. That cell gets:

```
bg-white/20 border border-white/40
```

replacing the current `bg-white/20` (adding the border is the meaningful change). The word cell (col 3) on the active row, when `index >= introRows` (i.e. the word is actually shown), keeps its `COLOR_BG` color but adds a stronger glow via `ring-2 ring-white/80` plus a color-matched shadow. During `introRows` (bars 0–1) col 3 renders as a plain beat cell and the word glow does not apply — this is expected.

| RhymeColor | Shadow |
|------------|--------|
| yellow | `shadow-[0_0_16px_rgba(255,212,71,0.5)]` |
| blue   | `shadow-[0_0_16px_rgba(58,163,255,0.6)]` |
| orange | `shadow-[0_0_16px_rgba(255,138,60,0.5)]` |
| red    | `shadow-[0_0_16px_rgba(228,77,77,0.5)]`  |

### 6. Active row spotlight

Only the active row (`index === activeRow`) gets a wrapper `div` with `position: relative`. Inside it, a sibling `div` before the cells grid has `position: absolute; inset: -8px -10px; border-radius: 18px; background: radial-gradient(ellipse at 50% 50%, rgba(255,200,50,0.12) 0%, transparent 70%); pointer-events: none`. Inactive rows render their grid directly with no extra wrapper.

### 7. Row opacity hierarchy

All rows are rendered with explicit opacity via a wrapper:

| Row type | Opacity |
|----------|---------|
| Active row | `1` (full) |
| Upcoming rows (`index > activeRow`) | `0.28` |
| Past rows (`index < activeRow`) | `0.07` with `transition: opacity 300ms ease` |

The fade from active (1.0) → upcoming (0.28) → past (0.07) happens automatically as `activeRow` increments. Only one past row is ever visible in the window (`activeRow - 1`), since `start = activeRow - 1` in `WordGrid`.

### 8. Word tile sizing

Word cells (col 3) get larger:

- Height: `py-4` → `py-5` (or explicit `h-[52px]`)
- Font: `text-xl font-bold` → `text-xl font-black` (same size, heavier weight)
- Border radius: `rounded-xl` → `rounded-2xl`

Applied to all cells (beat cells too) for visual consistency.

## Component Change Summary

| File | Change |
|------|--------|
| `tailwind.config.ts` | `bg` token: `#0e1330` → `#080808` |
| `app/globals.css` | `background: #080808` |
| `components/BouncingBall.tsx` | Remove `yDip` prop, smaller size, golden restyle, `h-5` container |
| `components/WordGrid.tsx` | Row opacity tiers, cell flash, active row spotlight, bigger tiles |
| `components/Game.tsx` | Move ball inside `max-w-md` wrapper, stop passing `yDip`, add pulse overlay div, fade header |

## Implementation Order

1. `tailwind.config.ts` + `globals.css` — background color (verifiable immediately)
2. `Game.tsx` — pulse overlay + header fade + ball container move
3. `BouncingBall.tsx` — restyle
4. `WordGrid.tsx` — opacity tiers + cell flash + spotlight + tile sizing
