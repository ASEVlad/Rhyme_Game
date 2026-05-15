# Desktop Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add responsive desktop layouts to the Setup, YtSetup, and playing screens — mobile unchanged throughout.

**Architecture:** All changes are additive Tailwind responsive classes. `md` breakpoint (768px) triggers the two-column Setup layout; `lg` breakpoint (1024px) widens the playing grid. No new components, no logic changes.

**Tech Stack:** Next.js, React, Tailwind CSS, Vitest

---

## Files Modified

| File | Change |
|------|--------|
| `components/WordGrid.tsx` | `lg:py-8` on cells, `lg:text-3xl` on word cells |
| `components/Game.tsx` | `lg:max-w-3xl` on grid container |
| `components/YtGame.tsx` | `lg:max-w-3xl` on grid container |
| `components/Setup.tsx` | Two-column grid at `md`, inline beat list on desktop, PLAY inside right column |
| `components/YtSetup.tsx` | DOM consolidation then two-column grid at `md`, PLAY inside right column |

---

## Task 1: Playing Screen — Wider Grid and Taller Cells

**Files:**
- Modify: `components/WordGrid.tsx`
- Modify: `components/Game.tsx`
- Modify: `components/YtGame.tsx`

- [ ] **Step 1: Update WordGrid cell classes**

In `components/WordGrid.tsx`, there are two cell types rendered inside the `grid grid-cols-4` row. Add `lg:py-8` to plain cells and `lg:py-8 lg:text-3xl` to word cells.

Find the plain cell `<div>` (the one rendered when `isWordCell` is false or when `bar` is missing):
```tsx
// Before
className={[
  'rounded-2xl py-5',
  cellActive
    ? 'bg-[rgba(94,200,255,0.20)] border border-[rgba(94,200,255,0.40)]'
    : 'bg-[rgba(94,200,255,0.06)]',
].join(' ')}

// After
className={[
  'rounded-2xl py-5 lg:py-8',
  cellActive
    ? 'bg-[rgba(94,200,255,0.20)] border border-[rgba(94,200,255,0.40)]'
    : 'bg-[rgba(94,200,255,0.06)]',
].join(' ')}
```

Find the word cell `<div>` (rendered when `isWordCell && bar && index >= introRows`):
```tsx
// Before
className={[
  'rounded-2xl py-5 text-center text-xl font-black',
  COLOR_BG[bar.color],
  isActive ? 'ring-2 ring-white/80' : '',
].join(' ')}

// After
className={[
  'rounded-2xl py-5 lg:py-8 text-center text-xl lg:text-3xl font-black',
  COLOR_BG[bar.color],
  isActive ? 'ring-2 ring-white/80' : '',
].join(' ')}
```

- [ ] **Step 2: Update Game.tsx grid container width**

In `components/Game.tsx`, in the playing phase (`// playing` comment section), find:
```tsx
<div className="mt-4 mx-auto w-full max-w-md">
```
Change to:
```tsx
<div className="mt-4 mx-auto w-full max-w-md lg:max-w-3xl">
```

- [ ] **Step 3: Update YtGame.tsx grid container width**

In `components/YtGame.tsx`, same change as Step 2 — find and replace:
```tsx
// Before
<div className="mt-4 mx-auto w-full max-w-md">

// After
<div className="mt-4 mx-auto w-full max-w-md lg:max-w-3xl">
```

- [ ] **Step 4: Run tests**

```bash
cd /home/asevlad/program_files/github_asevlad/Rhyme_Game && npm test
```
Expected: all tests pass (no logic was changed).

- [ ] **Step 5: Verify visually**

Start dev server (`npm run dev`) and open the game at a 1200px+ wide viewport. Play a game and confirm:
- Word grid fills more horizontal space
- Cells are noticeably taller
- Word text is larger (3xl vs xl)
- Ball still bounces across the full width
- No layout overflow or clipping

- [ ] **Step 6: Commit**

```bash
git add components/WordGrid.tsx components/Game.tsx components/YtGame.tsx
git commit -m "feat: wider playing grid and taller cells on desktop (lg+)"
```

---

## Task 2: Setup.tsx — Desktop Two-Column Layout

**Files:**
- Modify: `components/Setup.tsx`

The current `Setup.tsx` renders everything in a vertical `max-w-sm` column. The strategy:
1. The outer `max-w-sm` wrapper becomes a responsive two-column grid at `md`
2. Left column: beat source toggle + beat picker (existing content, with desktop inline list added for local beats)
3. Right column: divider (hidden on desktop) + pickers + PLAY (moved from outside the container into this column)

- [ ] **Step 1: Wrap the inner content in a two-column grid**

In `components/Setup.tsx`, find the div that wraps all the controls:
```tsx
<div className="w-full max-w-sm space-y-3">
```

Replace with a grid wrapper that splits into two columns at `md`. Also add an explicit left-column wrapper around the beat toggle and beat area, and a right-column wrapper around the pickers and PLAY:

```tsx
<div className="w-full max-w-sm md:max-w-3xl space-y-3 md:space-y-0 md:grid md:grid-cols-[1.2fr_1fr] md:gap-8 md:items-start">

  {/* ── LEFT COLUMN: beat source + beat picker ── */}
  <div className="space-y-3">
    {/* Beat source toggle — KEEP EXACTLY AS-IS, just move inside this div */}
    <div className="w-full rounded-xl bg-[rgba(94,200,255,0.08)] border border-[rgba(94,200,255,0.18)] p-1 flex gap-1">
      {/* ... toggle buttons unchanged ... */}
    </div>

    {/* Beat area — KEEP EXACTLY AS-IS for now, will update in next steps */}
    {beatSource === 'local' ? (
      /* ... existing browse button ... */
    ) : (
      /* ... existing youtube UI ... */
    )}
  </div>

  {/* ── RIGHT COLUMN: options + PLAY ── */}
  <div className="flex flex-col gap-3">
    {/* Divider — visible on mobile only */}
    <div className="border-t border-[rgba(94,200,255,0.10)] my-1 md:hidden" />

    {/* Pickers — KEEP EXACTLY AS-IS, just move inside this div */}
    <LanguagePicker
      languages={LANGUAGES}
      selectedId={languageId}
      onChange={chooseLanguage}
      className="w-full flex flex-wrap justify-center gap-2 rounded-2xl bg-[rgba(94,200,255,0.04)] px-3 py-3"
      activeClassName="rounded-full bg-[rgba(94,200,255,0.20)] px-4 py-2 text-sm font-semibold text-white"
      inactiveClassName="rounded-full bg-transparent px-4 py-2 text-sm text-white/35 hover:text-white/60"
    />
    <DifficultyPicker
      difficulties={DIFFICULTIES}
      selectedId={difficultyId}
      onChange={setDifficultyId}
      className="w-full flex flex-wrap justify-center gap-2 rounded-2xl bg-[rgba(94,200,255,0.04)] px-3 py-3"
      activeClassName="rounded-full bg-[rgba(94,200,255,0.20)] px-4 py-2 text-sm font-semibold text-white"
      inactiveClassName="rounded-full bg-transparent px-4 py-2 text-sm text-white/35 hover:text-white/60"
    />
    <RhymeSchemePicker
      schemes={RHYME_SCHEMES}
      selectedId={schemeId}
      onChange={setSchemeId}
      className="w-full flex flex-wrap justify-center gap-2 rounded-2xl bg-[rgba(94,200,255,0.04)] px-3 py-3"
      activeClassName="rounded-full bg-[rgba(94,200,255,0.20)] px-4 py-2 text-sm font-semibold text-white"
      inactiveClassName="rounded-full bg-transparent px-4 py-2 text-sm text-white/35 hover:text-white/60"
    />

    {/* PLAY — moved from below the container into the right column */}
    <button
      type="button"
      onClick={() => activeBeat && onPlay(activeBeat, languageId, difficultyId, schemeId)}
      disabled={!canPlay}
      className="rounded-2xl px-12 py-5 text-3xl font-extrabold text-[#060c14] disabled:opacity-40 block mx-auto md:mx-0 md:w-full md:mt-auto"
      style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', boxShadow: canPlay ? '0 0 32px rgba(94,200,255,0.45)' : 'none' }}
    >
      PLAY
    </button>
  </div>

</div>
```

Note: `w-full` is added to each picker's `className` prop to ensure full-width rendering inside the flex column. The old standalone divider element and the standalone PLAY button (which were siblings of the container) are now **removed** — the divider is inside the right column (md:hidden) and PLAY is at the bottom of the right column.

- [ ] **Step 2: Add desktop inline beat list for local beats**

Still in `components/Setup.tsx`, inside the left column, replace the existing single browse button with two sibling elements — one for mobile (existing button, hidden on desktop) and one for desktop (inline scrollable list):

```tsx
{beatSource === 'local' ? (
  <>
    {/* Mobile: opens full BrowseBeats modal */}
    <button
      ref={browseButtonRef}
      type="button"
      onClick={() => setBrowseOpen(true)}
      className="md:hidden w-full flex items-center justify-between rounded-2xl bg-[rgba(94,200,255,0.06)] border border-[rgba(94,200,255,0.14)] px-4 py-3 text-left"
    >
      <span className="font-bold truncate">{selectedBundled?.title ?? 'Pick a beat'}</span>
      <span className="flex items-center gap-2 text-[rgba(94,200,255,0.5)] text-sm">
        {selectedBundled ? `${Number.isInteger(selectedBundled.bpm) ? selectedBundled.bpm : selectedBundled.bpm.toFixed(1)} BPM` : ''}
        <span aria-hidden="true">›</span>
      </span>
    </button>

    {/* Desktop: inline scrollable list + Browse all button */}
    <div className="hidden md:block rounded-2xl bg-[rgba(94,200,255,0.04)] border border-[rgba(94,200,255,0.10)] overflow-hidden">
      <div className="max-h-72 overflow-y-auto">
        {allBeats.map(b => (
          <button
            key={b.id}
            type="button"
            onClick={() => chooseBeat(b.id)}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-[rgba(94,200,255,0.06)] transition-colors ${
              b.id === beatId && beatSource === 'local'
                ? 'bg-[rgba(94,200,255,0.12)] text-white'
                : 'text-white/70'
            }`}
          >
            <span className="truncate">{b.title}</span>
            <span className="text-white/40 ml-2 shrink-0 text-xs">
              {Number.isInteger(b.bpm) ? b.bpm : b.bpm.toFixed(1)} BPM
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setBrowseOpen(true)}
        className="w-full px-4 py-2.5 text-xs text-[rgba(94,200,255,0.5)] hover:text-[rgba(94,200,255,0.8)] border-t border-[rgba(94,200,255,0.10)] text-left transition-colors"
      >
        Browse all / search…
      </button>
    </div>
  </>
) : (
  /* YouTube UI — next step */
)}
```

Note: `browseButtonRef` stays on the mobile button only. On desktop, after the modal closes, focus lands on the mobile button (CSS-hidden) — this is a minor keyboard-focus issue acceptable for now.

- [ ] **Step 3: Update YouTube catalog render in Setup.tsx**

Inside the `beatSource === 'youtube'` branch, find the catalog section. Currently it uses `(showAll ? ytBeats : ytBeats.slice(0, 5)).map(...)`. Replace the entire catalog block (the `{ytBeats.length > 0 && (...)}` section) with:

```tsx
{ytBeats.length > 0 && (
  <div className="space-y-1 pt-1">
    <p className="text-[10px] text-[rgba(94,200,255,0.45)] uppercase tracking-wider">Recent</p>
    {ytBeats.map((b, i) => (
      <button
        key={b.id}
        type="button"
        onClick={() => {
          setSelectedCatalogId(b.id);
          setYtUrl('');
          setYtState({ status: 'idle' });
        }}
        className={[
          'w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm text-left',
          selectedCatalogId === b.id && ytState.status !== 'loaded'
            ? 'bg-[rgba(94,200,255,0.12)] border border-[rgba(94,200,255,0.25)] text-white'
            : 'bg-[rgba(94,200,255,0.04)] text-white/70 hover:bg-[rgba(94,200,255,0.08)]',
          !showAll && i >= 5 ? 'hidden md:flex' : 'flex',
        ].join(' ')}
      >
        <span className="truncate">{b.title}</span>
        <span className="text-white/40 ml-2 shrink-0">{b.bpm.toFixed(1)} BPM</span>
      </button>
    ))}
    {ytBeats.length > 5 && !showAll && (
      <button
        type="button"
        onClick={() => setShowAll(true)}
        className="md:hidden w-full text-center text-xs text-white/40 hover:text-white/70 py-1"
      >Show all ({ytBeats.length}) →</button>
    )}
  </div>
)}
```

- [ ] **Step 4: Run tests**

```bash
cd /home/asevlad/program_files/github_asevlad/Rhyme_Game && npm test
```
Expected: all tests pass. The `computeActiveBeat` export is unchanged; nothing in the tests touches the JSX structure.

- [ ] **Step 5: Verify Setup screen visually**

With `npm run dev`:

**Mobile (narrow the viewport below 768px):**
- Single column layout unchanged
- Browse beats button visible, opens modal
- YouTube tab shows 5 beats + "Show all" button
- PLAY button centered below pickers

**Desktop (viewport ≥ 768px):**
- Two columns: left has toggle + beat list, right has pickers + PLAY
- Local tab: inline scrollable beat list renders; clicking a row selects it; "Browse all / search…" opens the modal
- YouTube tab: all catalog beats visible without "Show all" button
- PLAY button spans full right column width, anchored to the bottom

- [ ] **Step 6: Commit**

```bash
git add components/Setup.tsx
git commit -m "feat: two-column desktop layout for Setup screen (md+)"
```

---

## Task 3: YtSetup.tsx — DOM Restructure + Two-Column Layout

**Files:**
- Modify: `components/YtSetup.tsx`

`YtSetup.tsx` currently has three **separate sibling divs** inside a `flex flex-1 flex-col items-center justify-center gap-6` wrapper:
- `<div className="w-full max-w-sm space-y-1">` — URL input + status
- `<div className="w-full max-w-sm">` — catalog
- `<div className="w-full max-w-sm space-y-3">` — pickers

These must be consolidated into left/right column wrappers inside a single grid wrapper before the two-column layout can be applied.

- [ ] **Step 1: Consolidate the DOM and apply the two-column grid**

Replace the three separate sibling divs (URL input div, catalog div, pickers div) and the standalone PLAY button with a single grid wrapper containing left and right column divs. The `h1` and error message stay above the grid.

The new structure (replace everything from the first `<div className="w-full max-w-sm space-y-1">` through the `</button>` PLAY button):

```tsx
<div className="w-full max-w-sm md:max-w-3xl md:grid md:grid-cols-[1.2fr_1fr] md:gap-8 md:items-start">

  {/* ── LEFT COLUMN: URL input + catalog ── */}
  <div className="space-y-1">
    {/* URL input / loading state / loaded chip — EXACT COPY from old space-y-1 div */}
    {ytState.status === 'loading' ? (
      <YtLoadingState className="py-2" />
    ) : ytState.status === 'loaded' ? (
      <div className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-sm">
        <span className="truncate">
          {ytState.beat.title} · {ytState.beat.bpm.toFixed(1)} BPM
          {ytState.bpmFallback && ' (BPM ~90, auto-detect failed)'}
        </span>
        <button
          onClick={() => { setYtUrl(''); setYtState({ status: 'idle' }); }}
          className="ml-2 shrink-0 text-white/60 hover:text-white"
          aria-label="Clear YouTube beat"
        >✕</button>
      </div>
    ) : (
      <div className="flex gap-2">
        <input
          type="url"
          placeholder="YouTube URL"
          value={ytUrl}
          onChange={e => { setYtUrl(e.target.value); setYtState({ status: 'idle' }); }}
          className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm placeholder:text-white/40 outline-none"
        />
        <button
          onClick={loadYtBeat}
          disabled={!canLoad}
          aria-label="Load YouTube beat"
          className="rounded-xl bg-white/20 px-3 py-2 text-sm disabled:opacity-40"
        >Load</button>
      </div>
    )}
    {ytState.status === 'error' && (
      <p className="text-xs text-red-400">{ytState.message}</p>
    )}

    {/* Catalog — full-list render with CSS show/hide for mobile truncation */}
    <div className="pt-2">
      {ytBeats.length === 0 ? (
        <p className="text-center text-sm text-white/40">
          No beats yet — paste a URL above.
        </p>
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-white/40 uppercase tracking-wide mb-2">
            Or pick from catalog
          </p>
          {ytBeats.map((b, i) => (
            <button
              key={b.id}
              onClick={() => selectFromCatalog(b.id)}
              className={[
                'w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm text-left',
                selectedCatalogId === b.id && ytState.status !== 'loaded'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/[0.06] text-white/70 hover:bg-white/10',
                !showAll && i >= 5 ? 'hidden md:flex' : 'flex',
              ].join(' ')}
            >
              <span className="truncate">{b.title}</span>
              <span className="text-white/40 ml-2 shrink-0">{b.bpm.toFixed(1)} BPM</span>
            </button>
          ))}
          {ytBeats.length > 5 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="md:hidden w-full text-center text-xs text-white/40 hover:text-white/70 py-1"
            >
              Show all ({ytBeats.length}) →
            </button>
          )}
        </div>
      )}
    </div>
  </div>

  {/* ── RIGHT COLUMN: pickers + PLAY ── */}
  <div className="flex flex-col gap-3 mt-6 md:mt-0">
    <LanguagePicker languages={LANGUAGES} selectedId={languageId} onChange={chooseLanguage} />
    <DifficultyPicker difficulties={DIFFICULTIES} selectedId={difficultyId} onChange={setDifficultyId} />
    <RhymeSchemePicker schemes={RHYME_SCHEMES} selectedId={schemeId} onChange={setSchemeId} />
    <button
      onClick={() => activeBeat && onPlay(activeBeat, languageId, difficultyId, schemeId)}
      disabled={!canPlay}
      className="rounded-2xl bg-rhyme-yellow px-12 py-5 text-3xl font-extrabold text-bg disabled:opacity-50 block mx-auto md:mx-0 md:w-full md:mt-auto"
    >
      PLAY
    </button>
  </div>

</div>
```

The three old sibling `<div className="w-full max-w-sm …">` divs and the standalone PLAY button are removed and replaced by this single structure.

Note: `mt-6 md:mt-0` on the right column preserves the existing `gap-6` visual spacing on mobile (the old `gap-6` on the flex container provided this; on desktop it's removed via `md:mt-0` since the grid gap handles spacing).

- [ ] **Step 2: Run tests**

```bash
cd /home/asevlad/program_files/github_asevlad/Rhyme_Game && npm test
```
Expected: all tests pass. The `buildYtBeat` export is unchanged.

- [ ] **Step 3: Verify YtSetup screen visually**

Navigate to `/yt` with `npm run dev`:

**Mobile (< 768px):**
- Single column, vertical layout
- URL input at top, catalog below, pickers below, PLAY centered at bottom
- "Show all" appears for catalogs with > 5 beats
- Layout matches existing mobile design

**Desktop (≥ 768px):**
- Two columns: left has URL input + full catalog, right has pickers + PLAY
- No "Show all" button
- PLAY spans full right column width

- [ ] **Step 4: Commit**

```bash
git add components/YtSetup.tsx
git commit -m "feat: two-column desktop layout for YtSetup screen (md+)"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Setup two-column at `md` — Task 2, Steps 1–3
- ✅ Local beat inline list on desktop — Task 2, Step 2
- ✅ YouTube catalog full-list CSS show/hide — Task 2, Step 3 and Task 3, Step 1
- ✅ Divider hidden on desktop — Task 2, Step 1 (inside right column wrapper)
- ✅ PLAY full-width + bottom-anchored on desktop — Task 2 Step 1, Task 3 Step 1
- ✅ YtSetup DOM consolidation — Task 3, Step 1
- ✅ YtSetup two-column at `md` — Task 3, Step 1
- ✅ Playing grid wider at `lg` — Task 1, Steps 2–3
- ✅ Cells taller + text larger at `lg` — Task 1, Step 1
