# Desktop Layout — Design Spec

**Date:** 2026-05-15
**Status:** Approved

## Summary

Add responsive desktop layouts for the Setup screen and playing screen. Mobile layout is completely unchanged. The `md` breakpoint (768px) switches Setup to a two-column split; the `lg` breakpoint (1024px) widens the playing grid.

## Scope

| File | Change |
|------|--------|
| `components/Setup.tsx` | Two-column layout at `md`, inline beat list on desktop |
| `components/YtSetup.tsx` | Two-column layout at `md` |
| `components/Game.tsx` | Wider grid container at `lg` |
| `components/YtGame.tsx` | Wider grid container at `lg` |
| `components/WordGrid.tsx` | Taller cells + larger word text at `lg` |

`BrowseBeats.tsx`, `BouncingBall.tsx`, `EndScreen.tsx`, login page — untouched.

---

## 1 — Setup.tsx Desktop Layout

### Container

Replace the current `max-w-sm` wrapper with a responsive grid:

```tsx
<div className="w-full max-w-sm md:max-w-3xl space-y-3 md:space-y-0 md:grid md:grid-cols-[1.2fr_1fr] md:gap-8 md:items-start">
```

`max-w-3xl` (~768px) gives comfortable breathing room up to ~1400px wide viewports.

### Left column — beat source

The beat source toggle and beat area sit in the left grid column on desktop. No structural change — they're already the first elements in the container.

**Local beats — inline list on `md+`:**

On mobile: the existing `<button ref={browseButtonRef} …>` that opens BrowseBeats stays.

On desktop, hide the mobile button and render an inline scrollable beat list instead:

```tsx
{/* Mobile: picker button */}
<button className="md:hidden …">…</button>

{/* Desktop: inline list */}
<div className="hidden md:block rounded-2xl bg-[rgba(94,200,255,0.04)] border border-[rgba(94,200,255,0.10)] overflow-hidden">
  <div className="max-h-64 overflow-y-auto">
    {allBeats.map(b => (
      <button
        key={b.id}
        type="button"
        onClick={() => chooseBeat(b.id)}
        className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-[rgba(94,200,255,0.06)] ${
          b.id === beatId && beatSource === 'local'
            ? 'bg-[rgba(94,200,255,0.12)] text-white'
            : 'text-white/70'
        }`}
      >
        <span className="truncate">{b.title}</span>
        <span className="text-white/40 ml-2 shrink-0 text-xs">{b.bpm.toFixed(1)} BPM</span>
      </button>
    ))}
  </div>
  {/* Browse all button opens the full modal with search/filter/preview */}
  <button
    ref={browseButtonRef}
    type="button"
    onClick={() => setBrowseOpen(true)}
    className="w-full px-4 py-2 text-xs text-[rgba(94,200,255,0.5)] hover:text-[rgba(94,200,255,0.8)] border-t border-[rgba(94,200,255,0.10)] text-left"
  >
    Browse all / search…
  </button>
</div>
```

The `browseButtonRef` moves to the "Browse all" button so focus returns to it correctly after modal close.

**YouTube tab on desktop:**

No structural change to the URL input. For the catalog list, render all beats but use CSS to hide items beyond index 5 on mobile until "Show all" is tapped:

```tsx
{ytBeats.map((b, i) => (
  <button
    key={b.id}
    className={`w-full … ${!showAll && i >= 5 ? 'hidden md:flex' : 'flex'}`}
    …
  >…</button>
))}
{ytBeats.length > 5 && !showAll && (
  <button className="md:hidden …" onClick={() => setShowAll(true)}>
    Show all ({ytBeats.length}) →
  </button>
)}
```

On `md+` the `hidden md:flex` items are always visible; the "Show all" button is hidden via `md:hidden`. No JS media query needed.

### Right column — options + PLAY

The divider (`border-t border-[rgba(94,200,255,0.10)]`) only makes sense on mobile to separate the beat area from the pickers. Hide it on desktop:

```tsx
<div className="border-t border-[rgba(94,200,255,0.10)] my-1 md:hidden" />
```

The three pickers and PLAY button sit in the right column unchanged.

PLAY button: add `md:mt-auto` so it anchors to the bottom of the right column:

```tsx
<button … className="rounded-2xl px-12 py-5 text-3xl font-extrabold text-[#060c14] disabled:opacity-40 md:mt-auto md:w-full">
```

`md:w-full` makes the PLAY button span the full right column width on desktop — feels more intentional than a small centered button in a column.

### Title centering

Title stays centered. On desktop it spans above both columns naturally because it's outside the two-column grid wrapper:

```tsx
<h1 …>The Rhyme Game</h1>         {/* outside grid, always centered */}
<div className="… md:grid …">    {/* two-column grid */}
  …
</div>
```

---

## 2 — YtSetup.tsx Desktop Layout

Same two-column pattern:

```tsx
<div className="w-full max-w-sm md:max-w-3xl space-y-3 md:space-y-0 md:grid md:grid-cols-[1.2fr_1fr] md:gap-8 md:items-start">
```

**Left column:** URL input + load button + YouTube catalog list. On desktop, always show all catalog beats (no 5-item limit). Same CSS approach as `Setup.tsx`: items beyond index 4 get `hidden md:flex`, the "Show all" button gets `md:hidden`.

**Right column:** Language, Difficulty, RhymeScheme pickers + PLAY button (same `md:mt-auto md:w-full` treatment).

---

## 3 — Playing Screen Grid Width

### Game.tsx and YtGame.tsx

In the playing `<main>`, the grid container:

```tsx
{/* before */}
<div className="mt-4 mx-auto w-full max-w-md">

{/* after */}
<div className="mt-4 mx-auto w-full max-w-md lg:max-w-3xl">
```

### WordGrid.tsx

Cells taller and word text larger on desktop:

```tsx
{/* plain cells */}
className="rounded-2xl py-5 lg:py-8"

{/* word cell */}
className="rounded-2xl py-5 lg:py-8 text-center text-xl lg:text-3xl font-black …"
```

`lg:max-w-3xl` (768px) with `lg:py-8` cells gives a wide, immersive grid that still fits comfortably at 1024px+ viewports without overflowing.

---

## What does NOT change

- Mobile layout in all files — all changes are additive responsive classes
- `BrowseBeats.tsx` — full-screen modal, untouched (still used on mobile + desktop "Browse all")
- `BouncingBall.tsx` — container width is set by the parent; it adapts automatically
- `EndScreen.tsx`, login page, `app/layout.tsx` — untouched
- All color tokens, `globals.css`, Tailwind config — untouched
- Game logic, hooks — untouched

---

## Implementation Order

1. `WordGrid.tsx` — add `lg:py-8` and `lg:text-3xl` responsive classes
2. `Game.tsx` + `YtGame.tsx` — change `max-w-md` to `max-w-md lg:max-w-3xl`
3. `Setup.tsx` — two-column grid wrapper + desktop inline beat list + `md:hidden` divider + `md:mt-auto md:w-full` PLAY
4. `YtSetup.tsx` — two-column grid wrapper + hide "Show all" button on `md+` + `md:mt-auto md:w-full` PLAY
