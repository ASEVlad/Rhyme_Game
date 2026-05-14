# YouTube Page Design

## Goal

Replace the `/yt` placeholder with a self-contained game entry point focused on YouTube beats: URL input prominent, inline catalog of previously-downloaded beats, same language/difficulty/scheme pickers as the main game, and an animated loading state during beat download.

## Architecture

Introduce a `useGamePhases` hook that encapsulates the loading → playing → ended state machine currently embedded in `Game.tsx`. Both the main game and the YouTube game use this hook. The setup phase (what the user sees before pressing PLAY) is the only difference between the two.

```
hooks/useGamePhases.ts      — new: loading/playing/ended logic extracted from Game.tsx
components/Game.tsx         — modified: call useGamePhases, remove duplicated logic
app/yt/page.tsx             — modified: replace placeholder with <YtGame />
components/YtGame.tsx       — new: useGamePhases + YtSetup
components/YtSetup.tsx      — new: YouTube-first setup UI
components/YtLoadingState.tsx — new: animated waveform + stage checklist
```

Auth is handled by middleware — `/yt` is protected automatically. No auth logic in the page component.

## `useGamePhases` hook

Extracts everything in `Game.tsx` that is not the setup-phase JSX:

**Input:**
```ts
type GamePhasesOpts = {
  onQuit?: () => void;          // called when user quits from playing phase
};
```

**Returns:**
```ts
type GamePhasesReturn = {
  phase: 'setup' | 'loading' | 'playing' | 'ended';
  activeBeat: Beat | null;
  languageId: LanguageId;
  difficultyId: DifficultyId;
  schemeId: RhymeSchemeId;
  bars: Bar[];
  loadError: string | null;
  tick: ReturnType<typeof useGameLoop>;
  pulseColor: string;
  handlePlay: (beat: Beat, lang: LanguageId, difficulty: DifficultyId, scheme: RhymeSchemeId) => void;
  quitToSetup: () => void;
  playAgain: () => void;     // sets phase to 'loading'
  goToSetup: () => void;     // sets phase to 'setup'
};
```

Contains: all `useState` declarations, `usedWordsRef`/`usedEndingsRef`, `useBeat`, `useGameLoop`, the loading `useEffect`, `handlePlay`, `quitToSetup`, `logout`, and the `pulseColor` computation.

**Does not contain:** setup-phase JSX, loading-screen JSX, playing-screen JSX, or end-screen JSX — those stay in the component.

## `Game.tsx` after refactor

```tsx
export function Game() {
  const { phase, activeBeat, bars, loadError, tick, pulseColor,
          handlePlay, quitToSetup, playAgain, goToSetup } = useGamePhases();
  const router = useRouter();

  async function logout() { /* unchanged */ }

  if (phase === 'setup') { /* unchanged JSX */ }
  if (phase === 'loading') { /* unchanged JSX */ }
  if (phase === 'ended') { /* unchanged JSX */ }
  // playing screen — unchanged JSX
}
```

`logout` stays in `Game.tsx` (it uses `useRouter` and is main-game-specific; the YT page has its own logout).

## `YtGame.tsx`

```tsx
export function YtGame() {
  const { phase, activeBeat, bars, tick, pulseColor,
          handlePlay, quitToSetup, playAgain, goToSetup } = useGamePhases();
  const router = useRouter();

  async function logout() { /* same as Game.tsx */ }

  if (phase === 'setup') return <YtSetup ... onPlay={handlePlay} onLogout={logout} />;
  if (phase === 'loading') return <div className="flex min-h-screen items-center justify-center text-xl">Loading…</div>;
  if (phase === 'ended') return <EndScreen onPlayAgain={playAgain} onChangeBeat={goToSetup} />;

  // playing screen — identical to Game.tsx
}
```

## `YtSetup.tsx`

Layout (top → bottom):

1. **Header row**: `← Back` link to `/` (left), `Log out` button (right)
2. **"YouTube Mode"** heading
3. **URL input row**: text input + "Load" button — or, when a YT beat is loaded, the beat chip (title · BPM) with a ✕ clear button. While loading: replaced by `YtLoadingState`.
4. **Error message** (if `ytState.status === 'error'`)
5. **Inline catalog**: previously downloaded YT beats fetched from `/beats/yt-catalog.json`. Shows as a plain list (no modal). Up to 5 entries visible; a "Show all (N)" button expands the rest. Each row: title + BPM. Clicking a row selects it as active beat and clears the URL input. If the catalog is empty: "No beats yet — paste a URL above."
6. **Language picker** (same `LanguagePicker` component, reads/writes localStorage)
7. **Difficulty picker** (`DifficultyPicker`)
8. **Scheme picker** (`RhymeSchemePicker`)
9. **PLAY button** (disabled until a beat is selected)

State:
- `ytUrl: string`
- `ytState: YtState` (same union type as in `Setup.tsx`)
- `languageId`, `difficultyId`, `schemeId` — same defaults as main game, no persistence between sessions
- `ytBeats: Beat[]` — fetched from catalog on mount; re-fetched after a successful URL load
- `showAll: boolean` — controls catalog list expansion

The active beat: YT URL beat takes priority over catalog selection, same as `Setup.tsx`.

Props:
```ts
type Props = {
  onPlay: (beat: Beat, lang: LanguageId, difficulty: DifficultyId, scheme: RhymeSchemeId) => void;
  onLogout: () => void;
};
```

No `initialBeatId` / `initialYtBeat` props — the YT page always starts fresh.

## `YtLoadingState.tsx`

Replaces the URL input row while `ytState.status === 'loading'`. Two parts:

**Waveform** (top): 7 bars, `bg-rhyme-yellow`, animated with CSS keyframes. Each bar has an independent animation phase so they don't all move in sync.

**Stage checklist** (below waveform):
```
✓  URL validated          (shown complete immediately)
⟳  Downloading audio…    (spinner, 0 s → 12 s)
○  Detecting BPM          (active at 12 s)
○  Generating title       (active at 20 s)
```

Stages advance on a client-side timer (`setInterval`, not tied to actual API progress). Each stage: completed = green checkmark, active = small spinner + rhyme-yellow text, pending = dimmed circle + white/40 text.

When `ytState` changes away from `'loading'` (success or error), the component is unmounted — no need to handle early completion explicitly.

Props:
```ts
type Props = { className?: string };
```

## Files touched

| File | Change |
|------|--------|
| `hooks/useGamePhases.ts` | New: extracted game state machine |
| `components/Game.tsx` | Modified: use hook, remove duplicated logic |
| `app/yt/page.tsx` | Modified: replace placeholder with `<YtGame />` |
| `components/YtGame.tsx` | New: YT game entry point |
| `components/YtSetup.tsx` | New: YouTube-first setup UI |
| `components/YtLoadingState.tsx` | New: waveform + stage checklist |

No changes to: `Setup.tsx`, `BrowseBeats.tsx`, `LanguagePicker.tsx`, `DifficultyPicker.tsx`, `RhymeSchemePicker.tsx`, `/api/yt-beat`, or `/api/rhymes`.
