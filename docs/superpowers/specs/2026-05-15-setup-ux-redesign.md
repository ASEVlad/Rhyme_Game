# Setup Screen UX Redesign — Design Spec

**Date:** 2026-05-15
**Status:** Approved

## Summary

Replace the always-visible YouTube URL input + buried "Try YouTube mode →" link on the Setup screen with an inline beat-source toggle ("Local beats" | "YouTube"). The YouTube URL input and catalog only appear when the YouTube tab is active. The PLAY button moves to the bottom of the screen (after settings). The `/yt` page is preserved for direct URL access but is no longer linked from Setup.

## Problem

The Setup screen has two overlapping YouTube entry points:
1. An always-visible YouTube URL input with a "Load" button, inline below the beat picker
2. A small "Try YouTube mode →" underline link pointing to `/yt`

Neither is clearly the right place. Users who want YouTube beats see a URL input (basic) and a link to a dedicated page (better) with no guidance on which to use. Users who don't want YouTube beats still see the URL input every time.

Additionally, the PLAY button sits above all settings — the user is prompted to act before they've configured anything.

## Design

### Beat source toggle

Replace the YouTube URL input and "Try YouTube mode →" link with a segmented control at the top of the options area:

```
┌─────────────────────────────────────┐
│  [ Local beats ]  [   YouTube   ]   │
└─────────────────────────────────────┘
```

- Default active tab: **Local beats** (current behavior, no change)
- The active tab is highlighted with `bg-rhyme-yellow text-bg`; inactive tab is `text-white/50`
- The toggle is styled as a pill container (`bg-white/[0.06] rounded-xl p-1`) with rounded inner buttons

### Local beats tab (default)

Shows the current beat picker button (opens BrowseBeats modal). No other changes.

```
[ Local beats ] [ YouTube ]

  [ Boom Bap · 88.0 BPM          › ]   ← opens BrowseBeats modal
```

### YouTube tab

When the user selects the YouTube tab, the beat picker button is replaced by:

1. **URL input row** — `flex gap-2`:
   - `<input type="url" placeholder="Paste YouTube URL…">` — styled with a faint yellow border (`border border-rhyme-yellow/30`) to signal active state
   - **Load** button — `bg-rhyme-yellow text-bg font-bold` (was `bg-white/20`); disabled when URL is invalid or loading
2. **Loading / loaded states** — same as current YtSetup: `YtLoadingState` during fetch, a chip with title + BPM + clear button on success
3. **Error message** — same as current: `text-xs text-red-400` below the input row
4. **Catalog section** — if `ytBeats.length > 0`, shows:
   - Label: `"Recent"` (`text-[10px] uppercase tracking-wide text-white/40`)
   - List of catalog beats, same row style as current YtSetup catalog (title + BPM, selectable)
   - "Show all (N) →" if more than 5 entries

The YouTube tab owns the same state machine as the current `Setup.tsx` YouTube section (`YtState`: idle / loading / loaded / error) plus `selectedCatalogId`.

### PLAY button position

Move the PLAY button from above the options to below all pickers (language, difficulty, rhyme scheme). This matches the natural flow: configure first, then act.

```
[ toggle ]
[ beat picker or YouTube area ]
─────────────────────────────
[ Language ]
[ Difficulty ]
[ Rhyme Scheme ]

        [ PLAY ]
```

The divider (`<hr>` or a `div` with `border-t border-white/[0.08]`) visually separates beat selection from game settings.

### What is removed

- The always-visible `<input type="url" placeholder="YouTube URL">` + "Load" button below the beat picker
- The `<Link href="/yt">Try YouTube mode →</Link>` text link
- The inline `ytState` / `ytBeats` state remains in `Setup.tsx` but its UI is now gated on `beatSource === 'youtube'` rather than always-rendered

### What stays unchanged

- `/yt` page and `YtSetup` component — untouched, still accessible via direct URL
- BrowseBeats modal — untouched
- Language, Difficulty, RhymeScheme pickers — untouched
- Log out button — untouched
- All `onPlay` / `onLogout` / `initialBeatId` / `initialYtBeat` props — same signatures

## Component changes

### `Setup.tsx`

- Add `beatSource` state: `'local' | 'youtube'`, default `'local'`; initialised to `'youtube'` when `initialYtBeat` is provided (so returning from a YouTube game lands on the YouTube tab)
- The YouTube-related state (`ytUrl`, `ytState`, `ytBeats`, `selectedCatalogId`) already exists in `Setup.tsx`; it moves from being always-rendered to only rendered when `beatSource === 'youtube'`
- Remove the `<Link href="/yt">` element
- Add the segmented toggle UI above the beat picker
- Move the `<button onClick={onPlay}>PLAY</button>` to below the pickers
- Add a subtle divider between the beat/YouTube area and the pickers

The `loadYtBeat` function, `fetchCatalog` call, and `ytBeats` state are already in `Setup.tsx` — no new logic needed, only restructuring the render.

`activeBeat` computation:
- `beatSource === 'local'` → `activeBeat = selectedBundled` (YouTube state is ignored even if a beat is loaded)
- `beatSource === 'youtube'` → `activeBeat = urlBeat ?? catalogBeat` (same as current logic)

## State behaviour

| Action | Result |
|---|---|
| Switch to YouTube tab | `beatSource = 'youtube'`; beat picker hidden; URL input shown; `activeBeat` becomes `urlBeat ?? catalogBeat` |
| Switch back to Local tab | `beatSource = 'local'`; URL input hidden; YouTube state is NOT reset (user can switch back without losing their loaded beat) |
| Load a YouTube beat then switch to Local | The YouTube beat is deactivated; the selected local beat (or none) becomes active |
| Load a YouTube beat, switch to Local, switch back to YouTube | The loaded beat is still there (state preserved) |

> Switching tabs does not reset YouTube state. This avoids the frustration of having to re-paste a URL after accidentally clicking Local.

## Visual spec

| Element | Class |
|---|---|
| Toggle container | `w-full rounded-xl bg-white/[0.06] p-1 flex gap-1` |
| Active tab | `flex-1 rounded-lg bg-rhyme-yellow text-bg font-bold py-2 text-sm` |
| Inactive tab | `flex-1 rounded-lg bg-transparent text-white/50 py-2 text-sm` |
| YouTube URL input (YouTube tab active) | `flex-1 rounded-xl bg-white/10 border border-rhyme-yellow/30 px-3 py-2 text-sm placeholder:text-white/40 outline-none` |
| Load button (YouTube tab) | `rounded-xl bg-rhyme-yellow text-bg font-bold px-3 py-2 text-sm disabled:opacity-40` |
| Divider | `border-t border-white/[0.08] my-1` |

## Out of scope

- Redesigning the BrowseBeats modal
- Redesigning the playing screen or end screen
- Any changes to `/yt` (YtSetup, YtGame, YtLoadingState)
- Changing picker visual design
- Adding beat preview to the Setup screen inline (outside BrowseBeats)
