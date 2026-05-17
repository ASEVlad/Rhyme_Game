# Play-screen Cancel button

Replaces the dim `←` quit-button at the top of the `playing` phase with a visible Cancel button fixed at the bottom-center, matching the existing LoadingScreen Cancel pattern. Removes the native `confirm('End session?')` dialog.

## Motivation

Two problems with today's quit affordance on `/play` and `/yt`:

1. **Discoverability.** The current `←` button lives in a row with opacity `0.18` — visible only to someone who knows where to look. New users can't find a way out of an active session without reaching for browser back, which then triggers the native browser confirm + leaves the session-state hook in a weird place.
2. **On-brand-ness.** The current quit path calls `confirm('End session?')`. The native browser dialog clashes with the Ice & Chrome aesthetic that runs through the rest of the app.

Meanwhile, the LoadingScreen already has a clean, visible **Cancel** text button styled to the app's identity, wired to the same `quitToSetup` action via an `onCancel` prop. The fix is to extend that same pattern to the `playing` phase.

## Goals

- During the `playing` phase of both `/play` (`components/Game.tsx`) and `/yt` (`components/YtGame.tsx`), a **Cancel** button is visible in a fixed position at viewport bottom-center.
- Clicking Cancel calls `quitToSetup()` immediately — no native `confirm()`, no in-app modal.
- The button is keyboard-accessible (focusable, visible focus ring) and labelled "Cancel" for screen readers.
- The button visual exactly matches the LoadingScreen Cancel (transparent background, small white-60 text, hover-to-white, cyan focus ring).
- The beat title + BPM line in the playing-phase header is preserved (now centered, since there's no `←` to balance against).

## Non-goals

- No change to LoadingScreen's existing Cancel (it's already correct).
- No change to EndScreen (its `Play again` / `Change beat` buttons cover the exit path).
- No change to Setup (it has its own logout in the corner).
- No new unit tests. The change is markup-only; `quitToSetup` is exercised by the existing LoadingScreen `onCancel` wiring on the same screens.
- No analytics, no confirmation toast, no animation polish beyond what fixed-position naturally gives.

## Architecture

Pure markup change in two existing components — no new files, no new hooks, no new props on existing components.

The `playing`-phase block currently has this shape (Game.tsx lines 54-81; YtGame.tsx ~43-71):

```tsx
<main className="relative min-h-screen p-4 flex flex-col bg-[#060c14]" ...>
  <div className="absolute inset-0 pointer-events-none z-0" .../>      {/* pulse */}
  <div className="relative z-10">
    <div className="flex justify-between mb-2" style={{ opacity: 0.18 }}>
      <button onClick={() => { if (confirm('End session?')) quitToSetup(); }}
              aria-label="Quit" className="text-white/70 text-xl">←</button>
      <div className="text-white/60 text-sm">{title} · {bpm} BPM</div>
    </div>
    <div className="mt-4 mx-auto w-full max-w-md lg:max-w-3xl">
      <WordGrid ... />
    </div>
  </div>
</main>
```

After the change:

```tsx
<main className="relative min-h-screen p-4 flex flex-col bg-[#060c14]" ...>
  <div className="absolute inset-0 pointer-events-none z-0" .../>      {/* pulse */}
  <div className="relative z-10">
    <div className="text-center text-white/60 text-sm mb-2"
         style={{ opacity: 0.18 }}>
      {title} · {bpm} BPM
    </div>
    <div className="mt-4 mx-auto w-full max-w-md lg:max-w-3xl">
      <WordGrid ... />
    </div>
  </div>
  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20">
    <button
      type="button"
      onClick={quitToSetup}
      className="rounded-sm text-sm text-white/60 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(94,200,255,0.7)]"
    >
      Cancel
    </button>
  </div>
</main>
```

### Stacking

The play screen has three layers today:

- `z-0` — full-screen pulse overlay (`pointer-events-none`).
- `z-10` — main content (`<div className="relative z-10">` wrapping the header row + WordGrid).
- *(no z assigned)* — `<main>` itself (the gradient background).

The new Cancel button needs `z-20` so it sits above both the pulse overlay and the content layer. It's `position: fixed` so it doesn't participate in the `relative z-10` stacking context.

### Why `fixed` and not in-flow

`min-h-screen` on `<main>` with the WordGrid container sized to `max-w-3xl` means on tall mobile viewports the WordGrid stretches deep into the screen. An in-flow button below it would land off the fold on phones. `position: fixed` at `bottom-4` guarantees it's reachable on every viewport.

## Behavior

- Cancel → `quitToSetup()`. The hook already transitions the `phase` state machine back to `setup` and the existing `<AnimatePresence>` cross-fade animates the swap.
- No keyboard shortcut binding (Escape, etc.) — out of scope; the visible button is enough.
- Fixed position takes ~30 px of bottom viewport real estate (text-sm line-height + bottom-4 margin). The WordGrid sits top-aligned starting at `mt-4` after the beat-info line and extends downward by its row count. On the supported viewport sizes (desktop ≥ 1024×768; mobile 390×844 portrait reference) there's substantial empty space between the grid's bottom edge and the Cancel button. Manual verification on both desktop and mobile during testing is the source of truth.

## Both screens

`components/Game.tsx` and `components/YtGame.tsx` have structurally identical `playing`-phase blocks. The same diff applies to both. They both destructure `quitToSetup` from `useGamePhases()` already (lines 15 and 16 respectively).

## Testing

- **Manual on `/play`**: pick a beat, start, confirm:
  - Cancel button visible at bottom-center on desktop (1440×900) and mobile (390×844).
  - Cancel button does not overlap the WordGrid on either size.
  - Clicking Cancel returns to the Setup screen with the cross-fade.
  - Tabbing through the page reaches the Cancel button; the cyan focus ring appears.
  - Beat-info line (`{title} · {bpm} BPM`) renders centered above the WordGrid.
- **Manual on `/yt`**: same checks against the YouTube-sourced flow.
- **No new unit tests.** Markup-only. The existing LoadingScreen `onCancel` test already covers the same `quitToSetup` invocation path.

## Out of scope / follow-ups

- Keyboard shortcut (Escape) for Cancel.
- Polish animation on the Cancel button itself (fade-in on phase enter).
- Refactoring the header row into a shared `<PlayingHeader>` component (Game.tsx and YtGame.tsx duplicate it). Worth doing only if a third caller appears.
