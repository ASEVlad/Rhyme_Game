# Playing Screen Reskin & Polish — Design Spec

**Date:** 2026-05-15
**Status:** Approved

## Summary

Four targeted changes to the playing screen: (1) Hybrid C visual reskin — navy background matching setup, cyan structural chrome, rhyme colors intact; (2) ball now bounces down to land on cell tops on each beat; (3) previous row fades out more slowly; (4) row-transition glitch fixed via invisible buffer rows.

## Scope

Changes touch `BouncingBall.tsx`, `WordGrid.tsx`, `Game.tsx`, and `YtGame.tsx` only. No hook changes, no logic changes, no new components. `YtGame.tsx` is included because its playing phase is identical to `Game.tsx`.

## 1 — Hybrid C Reskin

### Background

`Game.tsx` and `YtGame.tsx` — the playing `<main>`:

```tsx
<main
  className="relative min-h-screen p-4 flex flex-col bg-[#060c14]"
  style={{
    backgroundImage: 'radial-gradient(ellipse 80% 30% at 50% -5%, rgba(94,200,255,0.13) 0%, transparent 100%)',
  }}
>
```

The static cyan top glow is on `<main>` via inline `backgroundImage`. The dynamic pulse overlay div changes from a flat `backgroundColor` fill to a focused radial gradient so the pulse reads as a soft spotlight rather than a full-screen tint against the new navy background:

```tsx
<div
  className="absolute inset-0 pointer-events-none z-0"
  style={{ background: `radial-gradient(ellipse at 50% 35%, ${pulseColor} 0%, transparent 70%)`, transition: 'background 400ms ease' }}
/>
```

The `pulseColor` value remains rhyme-group-driven and unchanged.

### Beat cells

In `WordGrid.tsx`, replace all occurrences of `white/[0.06]` with `[rgba(94,200,255,0.06)]`:

```tsx
// inactive cell
'bg-[rgba(94,200,255,0.06)]'

// active cell flash
'bg-[rgba(94,200,255,0.20)] border border-[rgba(94,200,255,0.40)]'
```

### Active row spotlight

Replace the amber radial in `WordGrid.tsx`:

```tsx
// before
background: 'radial-gradient(ellipse at 50% 50%, rgba(255,200,50,0.12) 0%, transparent 70%)'

// after
background: 'radial-gradient(ellipse at 50% 50%, rgba(94,200,255,0.10) 0%, transparent 70%)'
```

### Ball color

In `BouncingBall.tsx`, replace golden gradient + glow with cyan:

```tsx
background: 'linear-gradient(135deg, #5ec8ff, #2860e0)',
boxShadow: '0 0 14px rgba(94,200,255,0.9), 0 0 28px rgba(94,200,255,0.35)',
```

### What does NOT change

- Rhyme word tiles (`yellow`, `blue`, `orange`, `red`) — semantic colors, untouched
- `pulseColor` overlay in `Game.tsx` / `YtGame.tsx` — still driven by active rhyme group
- `tailwind.config.ts` `rhyme.*` color tokens
- `globals.css` body background (stays `#080808`)
- `EndScreen.tsx`, `Setup.tsx`, `YtSetup.tsx` — out of scope

## 2 — Ball Bounce

### Container

Change from `h-5` to `h-10` (40px) to give the ball room to travel:

```tsx
<div className="relative h-10 w-full">
```

### Position

Ball drops DOWN on each beat (lands on cell tops), rises UP between beats.

Container is `h-10` (40px), ball is 14px. `top` positions the ball's **top edge** directly — no `translateY` — so the ball stays fully inside the container at all positions:

```tsx
const cellPhase = (x * 4) % 1;
const yBounce = Math.sin(cellPhase * Math.PI); // 0 at boundaries, 1 at beat center
const BOUNCE_PX = 26; // 0 → top edge at 0px (ball center 7px); 1 → top edge at 26px (ball center 33px, bottom flush with container)
```

```tsx
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
```

Result:
- `cellPhase = 0` (between beats): `top = 0` — ball at top of strip, fully visible
- `cellPhase = 0.5` (on beat): `top = 26px` — ball bottom edge flush with container bottom, kissing the cell tops
- `cellPhase = 1` (between beats): `top = 0` — ball back at top

No changes to `useGameLoop` or any other hook. The bounce is computed entirely from the existing `x` prop.

## 3 — Slow Previous-Row Fade

In `WordGrid.tsx`, increase the opacity transition duration for all rows from `300ms` to `600ms`:

```tsx
style={{ opacity, transition: 'opacity 600ms ease' }}
```

Apply to both the active-row wrapper and the plain row wrapper (both currently have the transition).

## 4 — Glitch Fix

### Problem

When `activeRow` increments, `start = activeRow - 1` causes the oldest visible row to be removed from the DOM, shifting all rows up and creating a visual jump.

### Fix

Expand the rendered window with invisible buffer rows above and below:

```tsx
const start = activeRow - 2;  // was activeRow - 1
const end   = activeRow + windowSize + 1;  // was activeRow + windowSize
```

Opacity rules:

| Row | Opacity |
|-----|---------|
| `index < activeRow - 1` | `0` (invisible buffer, holds layout space) |
| `index === activeRow - 1` | `0.07` (near past, slow fade) |
| `index === activeRow` | `1` (active) |
| `index > activeRow && index <= activeRow + windowSize` | `0.28` (upcoming) |
| `index > activeRow + windowSize` | `0` (invisible buffer below) |

When `activeRow` increments:
- The top buffer row (opacity 0) leaves the DOM — no visual change, no layout shift
- The near-past row transitions 1 → 0.07 (600ms fade)
- The bottom buffer row (opacity 0) absorbs the new row appearing — no jump

## Component Change Summary

| File | Change |
|------|--------|
| `components/Game.tsx` | `<main>` bg `#060c14` + static cyan top glow |
| `components/YtGame.tsx` | Same playing-phase changes as `Game.tsx` |
| `components/BouncingBall.tsx` | `h-10` container, bounce formula, cyan color |
| `components/WordGrid.tsx` | Cyan cells + spotlight, 600ms fade, buffer rows |

## Implementation Order

1. `BouncingBall.tsx` — container height + bounce formula + cyan color
2. `WordGrid.tsx` — cyan cells, cyan spotlight, 600ms transition, buffer rows
3. `Game.tsx` — background + static glow
4. `YtGame.tsx` — same background + static glow
