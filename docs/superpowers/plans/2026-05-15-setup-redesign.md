# Setup Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Setup screen with a beat-source toggle (Local / YouTube), PLAY button at the bottom, and an Ice & Chrome visual theme (navy-black background, cyan→blue gradients, radial glow).

**Architecture:** All changes are confined to `Setup.tsx` and the three picker components. `tailwind.config.ts` gains two new color tokens. No new files; no changes to the playing screen, `/yt` page, or BrowseBeats modal. A pure `computeActiveBeat` function is extracted from `Setup.tsx` to make the beat-selection logic testable.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Vitest (node environment — no DOM, only pure-function tests).

**Specs:**
- `docs/superpowers/specs/2026-05-15-setup-ux-redesign.md`
- `docs/superpowers/specs/2026-05-15-setup-visual-reskin.md`

---

### Task 1: Add cyan color tokens to Tailwind config

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Add the two new tokens**

Open `tailwind.config.ts`. The current `colors.rhyme` block looks like:

```ts
rhyme: {
  yellow: '#ffd447',
  blue:   '#3aa3ff',
  orange: '#ff8a3c',
  red:    '#e44d4d',
},
```

Add two tokens — do **not** remove or change the existing four:

```ts
rhyme: {
  yellow:     '#ffd447',
  blue:       '#3aa3ff',
  orange:     '#ff8a3c',
  red:        '#e44d4d',
  'cyan-from': '#5ec8ff',
  'cyan-to':   '#2860e0',
},
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: add rhyme.cyan-from / rhyme.cyan-to color tokens"
```

---

### Task 2: Add style props to LanguagePicker

**Files:**
- Modify: `components/LanguagePicker.tsx`

The picker currently hardcodes `bg-rhyme-yellow` for the active button and `bg-white/5` for the container. We need to override these from `Setup.tsx` to apply the Ice & Chrome palette.

- [ ] **Step 1: Update the Props type and component**

Replace the entire file content:

```tsx
'use client';

import type { Language, LanguageId } from '@/lib/languages';

type Props = {
  languages: readonly Language[];
  selectedId: LanguageId;
  onChange: (id: LanguageId) => void;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
};

const DEFAULT_ACTIVE   = 'rounded-full bg-rhyme-yellow px-4 py-2 text-sm font-bold text-bg';
const DEFAULT_INACTIVE = 'rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/20';
const DEFAULT_CONTAINER = 'flex flex-wrap justify-center gap-2 rounded-2xl bg-white/5 px-3 py-3';

export function LanguagePicker({
  languages,
  selectedId,
  onChange,
  className,
  activeClassName,
  inactiveClassName,
}: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Rhyme language"
      className={className ?? DEFAULT_CONTAINER}
    >
      {languages.map((lang) => {
        const selected = lang.id === selectedId;
        return (
          <button
            key={lang.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(lang.id)}
            className={selected ? (activeClassName ?? DEFAULT_ACTIVE) : (inactiveClassName ?? DEFAULT_INACTIVE)}
          >
            {lang.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/LanguagePicker.tsx
git commit -m "feat: add className/activeClassName/inactiveClassName props to LanguagePicker"
```

---

### Task 3: Add style props to DifficultyPicker

**Files:**
- Modify: `components/DifficultyPicker.tsx`

Same pattern as Task 2. Current defaults use `border-rhyme-yellow bg-rhyme-yellow/20 text-rhyme-yellow` for active.

- [ ] **Step 1: Update the Props type and component**

Replace the entire file content:

```tsx
'use client';

import type { Difficulty, DifficultyId } from '@/lib/difficulties';

type Props = {
  difficulties: readonly Difficulty[];
  selectedId: DifficultyId;
  onChange: (id: DifficultyId) => void;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
};

const DEFAULT_ACTIVE   = 'rounded-full border border-rhyme-yellow bg-rhyme-yellow/20 px-4 py-2 text-sm font-bold text-rhyme-yellow';
const DEFAULT_INACTIVE = 'rounded-full bg-white/5 px-4 py-2 text-sm text-white/40 hover:bg-white/10';
const DEFAULT_CONTAINER = 'flex flex-wrap justify-center gap-2 rounded-2xl bg-white/5 px-3 py-3';

export function DifficultyPicker({
  difficulties,
  selectedId,
  onChange,
  className,
  activeClassName,
  inactiveClassName,
}: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Difficulty"
      className={className ?? DEFAULT_CONTAINER}
    >
      {difficulties.map((d) => {
        const selected = d.id === selectedId;
        return (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(d.id)}
            className={selected ? (activeClassName ?? DEFAULT_ACTIVE) : (inactiveClassName ?? DEFAULT_INACTIVE)}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/DifficultyPicker.tsx
git commit -m "feat: add className/activeClassName/inactiveClassName props to DifficultyPicker"
```

---

### Task 4: Add style props to RhymeSchemePicker

**Files:**
- Modify: `components/RhymeSchemePicker.tsx`

Same pattern as Tasks 2–3.

- [ ] **Step 1: Update the Props type and component**

Replace the entire file content:

```tsx
'use client';

import type { RhymeScheme, RhymeSchemeId } from '@/lib/rhyme-schemes';

type Props = {
  schemes: readonly RhymeScheme[];
  selectedId: RhymeSchemeId;
  onChange: (id: RhymeSchemeId) => void;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
};

const DEFAULT_ACTIVE   = 'rounded-full border border-rhyme-yellow bg-rhyme-yellow/20 px-4 py-2 text-sm font-bold text-rhyme-yellow';
const DEFAULT_INACTIVE = 'rounded-full bg-white/5 px-4 py-2 text-sm text-white/40 hover:bg-white/10';
const DEFAULT_CONTAINER = 'flex flex-wrap justify-center gap-2 rounded-2xl bg-white/5 px-3 py-3';

export function RhymeSchemePicker({
  schemes,
  selectedId,
  onChange,
  className,
  activeClassName,
  inactiveClassName,
}: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Rhyme scheme"
      className={className ?? DEFAULT_CONTAINER}
    >
      {schemes.map((s) => {
        const selected = s.id === selectedId;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(s.id)}
            className={selected ? (activeClassName ?? DEFAULT_ACTIVE) : (inactiveClassName ?? DEFAULT_INACTIVE)}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/RhymeSchemePicker.tsx
git commit -m "feat: add className/activeClassName/inactiveClassName props to RhymeSchemePicker"
```

---

### Task 5: Extract and test `computeActiveBeat`

**Files:**
- Modify: `components/Setup.tsx` (export new function)
- Create: `components/Setup.test.ts`

The active beat logic in `Setup.tsx` needs to account for `beatSource`. Extract it as a pure exported function so it can be tested without a DOM.

- [ ] **Step 1: Write the failing tests**

Create `components/Setup.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeActiveBeat } from './Setup';
import type { Beat } from '@/lib/beats';

const beat = (id: string): Beat => ({
  id,
  src: `/beats/${id}.mp3`,
  title: id,
  bpm: 90,
  barsPerLoop: 8,
  category: 'other',
});

const localBeat  = beat('local-1');
const urlBeat    = beat('yt-url');
const catalogBeat = beat('yt-cat');

describe('computeActiveBeat', () => {
  it('returns selectedBundled when beatSource is local', () => {
    expect(
      computeActiveBeat('local', localBeat, { status: 'idle' }, null, [])
    ).toBe(localBeat);
  });

  it('returns null when beatSource is local and no bundled beat selected', () => {
    expect(
      computeActiveBeat('local', null, { status: 'loaded', beat: urlBeat }, null, [])
    ).toBeNull();
  });

  it('ignores youtube state when beatSource is local', () => {
    expect(
      computeActiveBeat('local', null, { status: 'loaded', beat: urlBeat }, null, [])
    ).toBeNull();
  });

  it('returns url beat when youtube tab has a loaded beat', () => {
    expect(
      computeActiveBeat('youtube', null, { status: 'loaded', beat: urlBeat }, null, [])
    ).toBe(urlBeat);
  });

  it('returns catalog beat when youtube tab has a selected catalog id', () => {
    expect(
      computeActiveBeat('youtube', null, { status: 'idle' }, catalogBeat.id, [catalogBeat])
    ).toBe(catalogBeat);
  });

  it('prefers url beat over catalog beat', () => {
    expect(
      computeActiveBeat('youtube', null, { status: 'loaded', beat: urlBeat }, catalogBeat.id, [catalogBeat])
    ).toBe(urlBeat);
  });

  it('returns null when youtube tab has no url beat and no catalog selection', () => {
    expect(
      computeActiveBeat('youtube', null, { status: 'idle' }, null, [])
    ).toBeNull();
  });

  it('returns null when selectedCatalogId does not match any ytBeat', () => {
    expect(
      computeActiveBeat('youtube', null, { status: 'idle' }, 'ghost-id', [catalogBeat])
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose components/Setup.test.ts
```

Expected: FAIL — `computeActiveBeat` is not exported from `./Setup`.

- [ ] **Step 3: Export `computeActiveBeat` from Setup.tsx**

At the top of `components/Setup.tsx`, add the `YtState` type alias (it's currently inline) and export the function. Add this block **before** the `Setup` component function, after the existing imports and type definitions:

```ts
export type BeatSource = 'local' | 'youtube';

export function computeActiveBeat(
  beatSource: BeatSource,
  selectedBundled: Beat | null,
  ytState: YtState,
  selectedCatalogId: string | null,
  ytBeats: Beat[],
): Beat | null {
  if (beatSource === 'local') return selectedBundled;
  const urlBeat = ytState.status === 'loaded' ? ytState.beat : null;
  const catalogBeat = selectedCatalogId
    ? ytBeats.find(b => b.id === selectedCatalogId) ?? null
    : null;
  return urlBeat ?? catalogBeat;
}
```

Do not yet change the `activeBeat` computation inside the `Setup` function body — that happens in Task 6.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose components/Setup.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/Setup.tsx components/Setup.test.ts
git commit -m "feat: export computeActiveBeat from Setup.tsx, add tests"
```

---

### Task 6: Restructure Setup.tsx — toggle + YouTube tab + PLAY to bottom

**Files:**
- Modify: `components/Setup.tsx`

This task rewrites the `Setup` component's state and render structure. The visual styling (Ice & Chrome) is applied in Task 7 — here we only restructure the layout and logic.

- [ ] **Step 1: Add `beatSource` and `selectedCatalogId` state**

Inside the `Setup` function, after the existing `useState` declarations, add:

```ts
const [beatSource, setBeatSource] = useState<BeatSource>(
  initialYtBeat ? 'youtube' : 'local'
);
const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
```

- [ ] **Step 2: Replace the `activeBeat` computation**

Find and replace the existing `activeBeat` lines:

```ts
// OLD — remove these two lines:
const selectedBundled: Beat | null =
  beatId ? (pickBeat(beatId) ?? allBeats.find(b => b.id === beatId) ?? null) : null;

const activeBeat: Beat | null =
  ytState.status === 'loaded' ? ytState.beat : selectedBundled;
```

Replace with:

```ts
const selectedBundled: Beat | null =
  beatId ? (pickBeat(beatId) ?? allBeats.find(b => b.id === beatId) ?? null) : null;

const activeBeat: Beat | null = computeActiveBeat(
  beatSource, selectedBundled, ytState, selectedCatalogId, ytBeats,
);
```

- [ ] **Step 3: Rewrite the return JSX**

Replace the entire `return (...)` block of the `Setup` component with the following. Keep the `BrowseBeats` modal at the end unchanged.

```tsx
return (
  <main className="flex min-h-screen flex-col p-6">
    <div className="flex justify-end">
      <button onClick={onLogout} className="text-white/60 hover:text-white text-sm">Log out</button>
    </div>

    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-extrabold">The Rhyme Game</h1>

      <div className="w-full max-w-sm space-y-3">
        {/* Beat source toggle */}
        <div className="w-full rounded-xl bg-white/[0.06] p-1 flex gap-1">
          <button
            type="button"
            onClick={() => setBeatSource('local')}
            className={beatSource === 'local'
              ? 'flex-1 rounded-lg bg-rhyme-yellow text-bg font-bold py-2 text-sm'
              : 'flex-1 rounded-lg bg-transparent text-white/50 py-2 text-sm'}
          >
            Local beats
          </button>
          <button
            type="button"
            onClick={() => setBeatSource('youtube')}
            className={beatSource === 'youtube'
              ? 'flex-1 rounded-lg bg-rhyme-yellow text-bg font-bold py-2 text-sm'
              : 'flex-1 rounded-lg bg-transparent text-white/50 py-2 text-sm'}
          >
            YouTube
          </button>
        </div>

        {/* Beat area — switches based on beatSource */}
        {beatSource === 'local' ? (
          <button
            ref={browseButtonRef}
            type="button"
            onClick={() => setBrowseOpen(true)}
            className="w-full flex items-center justify-between rounded-2xl bg-white/[0.06] px-4 py-3 text-left"
          >
            <span className="font-bold truncate">{selectedBundled?.title ?? 'Pick a beat'}</span>
            <span className="flex items-center gap-2 text-white/60 text-sm">
              {selectedBundled ? `${Number.isInteger(selectedBundled.bpm) ? selectedBundled.bpm : selectedBundled.bpm.toFixed(1)} BPM` : ''}
              <span aria-hidden="true">›</span>
            </span>
          </button>
        ) : (
          <div className="space-y-2">
            {/* URL input / loading / loaded chip */}
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
                  placeholder="Paste YouTube URL…"
                  value={ytUrl}
                  disabled={ytState.status === 'loading'}
                  onChange={e => { setYtUrl(e.target.value); setYtState({ status: 'idle' }); }}
                  className="flex-1 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/40 outline-none disabled:opacity-40"
                />
                <button
                  onClick={loadYtBeat}
                  disabled={!canLoad}
                  aria-label="Load YouTube beat"
                  className="rounded-xl bg-white/20 px-3 py-2 text-sm font-bold disabled:opacity-40"
                >Load</button>
              </div>
            )}
            {ytState.status === 'error' && (
              <p className="text-xs text-red-400">{ytState.message}</p>
            )}

            {/* Inline catalog */}
            {ytBeats.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-[10px] text-white/40 uppercase tracking-wide">Recent</p>
                {(showAll ? ytBeats : ytBeats.slice(0, 5)).map(b => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedCatalogId(b.id);
                      setYtUrl('');
                      setYtState({ status: 'idle' });
                    }}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm text-left ${
                      selectedCatalogId === b.id && ytState.status !== 'loaded'
                        ? 'bg-white/20 text-white'
                        : 'bg-white/[0.06] text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <span className="truncate">{b.title}</span>
                    <span className="text-white/40 ml-2 shrink-0">{b.bpm.toFixed(1)} BPM</span>
                  </button>
                ))}
                {ytBeats.length > 5 && !showAll && (
                  <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="w-full text-center text-xs text-white/40 hover:text-white/70 py-1"
                  >Show all ({ytBeats.length}) →</button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-white/[0.08] my-1" />

        <LanguagePicker
          languages={LANGUAGES}
          selectedId={languageId}
          onChange={chooseLanguage}
        />
        <DifficultyPicker
          difficulties={DIFFICULTIES}
          selectedId={difficultyId}
          onChange={setDifficultyId}
        />
        <RhymeSchemePicker
          schemes={RHYME_SCHEMES}
          selectedId={schemeId}
          onChange={setSchemeId}
        />
      </div>

      {/* PLAY — bottom */}
      <button
        onClick={() => activeBeat && onPlay(activeBeat, languageId, difficultyId, schemeId)}
        disabled={!canPlay}
        className="rounded-2xl bg-rhyme-yellow px-12 py-5 text-3xl font-extrabold text-bg disabled:opacity-50"
      >
        PLAY
      </button>
    </div>

    {browseOpen && (
      <BrowseBeats
        beats={beatSource === 'local' ? allBeats : []}
        selectedId={beatId}
        onChange={(id) => { chooseBeat(id); }}
        onClose={() => { setBrowseOpen(false); browseButtonRef.current?.focus(); }}
      />
    )}
  </main>
);
```

Note: also add `showAll` state to the `Setup` function (it was only in `YtSetup` before):

```ts
const [showAll, setShowAll] = useState(false);
```

Add this next to the other `useState` declarations.

Also remove the `allBeats` variable and the `<Link href="/yt">` element — they are no longer needed in this form. The `allBeats` for BrowseBeats is now only needed in local mode (YouTube beats are shown inline). Update the existing `allBeats` line:

```ts
// OLD:
const allBeats = [...BEATS, ...ytBeats];

// NEW (keep for the BrowseBeats modal in local mode):
const allBeats = [...BEATS, ...ytBeats];
```

Leave `allBeats` as-is (it is still passed to BrowseBeats for local-beat search).

Also remove the `import Link from 'next/link'` import since `<Link href="/yt">` is removed.

Add `YtLoadingState` to the existing import block at the top of `Setup.tsx`:
```ts
import { YtLoadingState } from './YtLoadingState';
```

- [ ] **Step 4: Verify TypeScript compiles and tests still pass**

```bash
npx tsc --noEmit && npm test -- --reporter=verbose components/Setup.test.ts
```

Expected: no TS errors, 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/Setup.tsx
git commit -m "feat: beat source toggle, YouTube inline catalog, PLAY to bottom in Setup"
```

---

### Task 7: Apply Ice & Chrome visual reskin to Setup.tsx

**Files:**
- Modify: `components/Setup.tsx`

This task replaces all yellow/white-opacity colors in `Setup.tsx` with the cyan family. No logic changes — only className and style strings.

- [ ] **Step 1: Update `<main>` background**

Find:
```tsx
<main className="flex min-h-screen flex-col p-6">
```

Replace with:
```tsx
<main
  className="flex min-h-screen flex-col p-6 bg-[#060c14]"
  style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(94,200,255,0.22) 0%, transparent 100%)' }}
>
```

- [ ] **Step 2: Update the title**

Find:
```tsx
<h1 className="text-4xl font-extrabold">The Rhyme Game</h1>
```

Replace with:
```tsx
<h1
  className="text-4xl font-extrabold tracking-tight"
  style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
>
  The Rhyme Game
</h1>
```

- [ ] **Step 3: Update the beat source toggle container and active tab**

Find:
```tsx
<div className="w-full rounded-xl bg-white/[0.06] p-1 flex gap-1">
```
Replace with:
```tsx
<div className="w-full rounded-xl bg-[rgba(94,200,255,0.08)] border border-[rgba(94,200,255,0.18)] p-1 flex gap-1">
```

Find the active tab class (used in both `beatSource === 'local'` and `beatSource === 'youtube'` branches):
```tsx
'flex-1 rounded-lg bg-rhyme-yellow text-bg font-bold py-2 text-sm'
```
Replace both occurrences with:
```tsx
'flex-1 rounded-lg font-bold py-2 text-sm text-[#060c14]'
```
and add an inline `style` to each active tab button:
```tsx
style={beatSource === 'local' ? { background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', boxShadow: '0 0 12px rgba(94,200,255,0.35)' } : undefined}
```
and for the YouTube button:
```tsx
style={beatSource === 'youtube' ? { background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', boxShadow: '0 0 12px rgba(94,200,255,0.35)' } : undefined}
```

Inactive tab class `'flex-1 rounded-lg bg-transparent text-white/50 py-2 text-sm'` — keep as-is (already correct).

- [ ] **Step 4: Update the beat picker button (local mode)**

Find:
```tsx
className="w-full flex items-center justify-between rounded-2xl bg-white/[0.06] px-4 py-3 text-left"
```
Replace with:
```tsx
className="w-full flex items-center justify-between rounded-2xl bg-[rgba(94,200,255,0.06)] border border-[rgba(94,200,255,0.14)] px-4 py-3 text-left"
```

Find the chevron span:
```tsx
<span className="flex items-center gap-2 text-white/60 text-sm">
```
Replace with:
```tsx
<span className="flex items-center gap-2 text-[rgba(94,200,255,0.5)] text-sm">
```

- [ ] **Step 5: Update the YouTube URL input and Load button**

Find (YouTube tab, idle state):
```tsx
className="flex-1 rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/40 outline-none disabled:opacity-40"
```
Replace with:
```tsx
className="flex-1 rounded-xl bg-[rgba(94,200,255,0.06)] border border-[rgba(94,200,255,0.30)] px-3 py-2 text-sm placeholder:text-white/40 outline-none disabled:opacity-40"
```

Find the Load button:
```tsx
className="rounded-xl bg-white/20 px-3 py-2 text-sm font-bold disabled:opacity-40"
```
Replace with:
```tsx
className="rounded-xl px-3 py-2 text-sm font-bold text-[#060c14] disabled:opacity-40"
style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)' }}
```

- [ ] **Step 6: Update catalog row colors (YouTube tab)**

Find the selected catalog row class:
```tsx
'bg-white/20 text-white'
```
Replace with:
```tsx
'bg-[rgba(94,200,255,0.12)] border border-[rgba(94,200,255,0.25)] text-white'
```

Find the unselected catalog row class:
```tsx
'bg-white/[0.06] text-white/70 hover:bg-white/10'
```
Replace with:
```tsx
'bg-[rgba(94,200,255,0.04)] text-white/70 hover:bg-[rgba(94,200,255,0.08)]'
```

Find the "Recent" label:
```tsx
<p className="text-[10px] text-white/40 uppercase tracking-wide">Recent</p>
```
Replace with:
```tsx
<p className="text-[10px] text-[rgba(94,200,255,0.45)] uppercase tracking-wide">Recent</p>
```

- [ ] **Step 7: Update the divider**

Find:
```tsx
<div className="border-t border-white/[0.08] my-1" />
```
Replace with:
```tsx
<div className="border-t border-[rgba(94,200,255,0.10)] my-1" />
```

- [ ] **Step 8: Update the PLAY button**

Find:
```tsx
className="rounded-2xl bg-rhyme-yellow px-12 py-5 text-3xl font-extrabold text-bg disabled:opacity-50"
```
Replace with:
```tsx
className="rounded-2xl px-12 py-5 text-3xl font-extrabold text-[#060c14] disabled:opacity-50"
```
And add an inline style prop to the same button (next to `onClick` and `disabled`):
```tsx
style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', boxShadow: canPlay ? '0 0 32px rgba(94,200,255,0.45)' : 'none' }}
```

- [ ] **Step 9: Pass Ice & Chrome classes to the three pickers**

Find the `<LanguagePicker>` call and add props:
```tsx
<LanguagePicker
  languages={LANGUAGES}
  selectedId={languageId}
  onChange={chooseLanguage}
  className="flex flex-wrap justify-center gap-2 rounded-2xl bg-[rgba(94,200,255,0.04)] px-3 py-3"
  activeClassName="rounded-full bg-[rgba(94,200,255,0.20)] px-4 py-2 text-sm font-semibold text-white"
  inactiveClassName="rounded-full bg-transparent px-4 py-2 text-sm text-white/35 hover:text-white/60"
/>
```

Same for `<DifficultyPicker>`:
```tsx
<DifficultyPicker
  difficulties={DIFFICULTIES}
  selectedId={difficultyId}
  onChange={setDifficultyId}
  className="flex flex-wrap justify-center gap-2 rounded-2xl bg-[rgba(94,200,255,0.04)] px-3 py-3"
  activeClassName="rounded-full bg-[rgba(94,200,255,0.20)] px-4 py-2 text-sm font-semibold text-white"
  inactiveClassName="rounded-full bg-transparent px-4 py-2 text-sm text-white/35 hover:text-white/60"
/>
```

Same for `<RhymeSchemePicker>`:
```tsx
<RhymeSchemePicker
  schemes={RHYME_SCHEMES}
  selectedId={schemeId}
  onChange={setSchemeId}
  className="flex flex-wrap justify-center gap-2 rounded-2xl bg-[rgba(94,200,255,0.04)] px-3 py-3"
  activeClassName="rounded-full bg-[rgba(94,200,255,0.20)] px-4 py-2 text-sm font-semibold text-white"
  inactiveClassName="rounded-full bg-transparent px-4 py-2 text-sm text-white/35 hover:text-white/60"
/>
```

- [ ] **Step 10: Verify TypeScript compiles and tests pass**

```bash
npx tsc --noEmit && npm test
```

Expected: no TS errors, all tests PASS.

- [ ] **Step 11: Start dev server and visually verify**

```bash
npm run dev
```

Open `http://localhost:3000`. Log in. Verify:
- [ ] Background is deep navy `#060c14` with a faint cyan glow at the top
- [ ] Title "The Rhyme Game" has a cyan→blue gradient
- [ ] Toggle shows "Local beats" selected by default with gradient fill
- [ ] Beat picker has cyan-tinted background and border
- [ ] Clicking "YouTube" switches the toggle and shows the URL input
- [ ] YouTube URL input has a cyan border
- [ ] Load button is cyan gradient
- [ ] Language/Difficulty/Scheme pickers have cyan-tinted backgrounds
- [ ] PLAY button is cyan gradient with a glow when a beat is selected
- [ ] PLAY button is at the bottom, below all pickers

- [ ] **Step 12: Commit**

```bash
git add components/Setup.tsx
git commit -m "feat: apply Ice & Chrome visual theme to Setup screen"
```
