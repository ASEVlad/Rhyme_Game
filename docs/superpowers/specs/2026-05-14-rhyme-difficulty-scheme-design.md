# Rhyme Difficulty & Scheme Design

**Date:** 2026-05-14
**Status:** Draft

## Goal

Add two independent session controls to the Setup screen:

1. **Difficulty** — controls vocabulary complexity of generated rhyme words (Beginner / Intermediate / Advanced / Expert). Resets to Beginner on each page load.
2. **Rhyme Scheme** — controls how many words share a rhyme sound and whether they are sequential or interleaved (Free / Couplets / 4-bar / Alternating). Resets to Free on each page load.

Both controls are prompt-only (Approach A for difficulty, Approach B for scheme — see Architecture). The fallback groups (`lib/fallback-groups.ts`) are unchanged; when Claude is unavailable, difficulty and scheme are silently ignored.

---

## Data Model

### `lib/difficulties.ts` (new)

```ts
export type DifficultyId = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type Difficulty = {
  id: DifficultyId;
  label: string;
  promptHint: string; // English; injected into every language's prompt
};

export const DIFFICULTIES: readonly Difficulty[] = [
  { id: 'beginner',     label: 'Beginner',     promptHint: 'very common words a young child would know' },
  { id: 'intermediate', label: 'Intermediate', promptHint: 'common words a teenager would recognize' },
  { id: 'advanced',     label: 'Advanced',     promptHint: 'expressive, less common vocabulary' },
  { id: 'expert',       label: 'Expert',       promptHint: 'rare, abstract, or sophisticated vocabulary' },
];

export const DEFAULT_DIFFICULTY: DifficultyId = 'beginner';

const BY_ID = DIFFICULTIES.reduce((acc, d) => { acc[d.id] = d; return acc; }, {} as Record<DifficultyId, Difficulty>);
export function getDifficulty(id: string | null | undefined): Difficulty {
  if (id && id in BY_ID) return BY_ID[id as DifficultyId];
  return BY_ID[DEFAULT_DIFFICULTY];
}
```

### `lib/rhyme-schemes.ts` (new)

```ts
export type RhymeSchemeId = 'free' | 'couplets' | 'bar4' | 'alternating';

export type RhymeScheme = {
  id: RhymeSchemeId;
  label: string;
  wordsPerGroup: number | null; // null = Claude decides (3–4, current behaviour)
  groupCount: number;           // how many groups to request from Claude
  interleave: boolean;          // true = ABAB interleaving in flattenBars
};

export const RHYME_SCHEMES: readonly RhymeScheme[] = [
  { id: 'free',        label: 'Free',        wordsPerGroup: null, groupCount: 10, interleave: false },
  { id: 'couplets',    label: 'Couplets',    wordsPerGroup: 2,    groupCount: 16, interleave: false },
  { id: 'bar4',        label: '4-bar',       wordsPerGroup: 4,    groupCount: 8,  interleave: false },
  { id: 'alternating', label: 'Alternating', wordsPerGroup: 2,    groupCount: 16, interleave: true  },
];
// groupCount for alternating is 16 to guarantee an even number of groups for ABAB pairing.
// groupCount × wordsPerGroup ≈ 32 total bars across all non-free schemes.

export const DEFAULT_SCHEME: RhymeSchemeId = 'free';

const BY_ID = RHYME_SCHEMES.reduce((acc, s) => { acc[s.id] = s; return acc; }, {} as Record<RhymeSchemeId, RhymeScheme>);
export function getRhymeScheme(id: string | null | undefined): RhymeScheme {
  if (id && id in BY_ID) return BY_ID[id as RhymeSchemeId];
  return BY_ID[DEFAULT_SCHEME];
}
```

---

## Prompt Layer

### `lib/languages.ts` changes

Each language's `promptTemplate` signature extends to accept two new optional params:

```ts
promptTemplate: (
  count: number,
  theme: string,
  exclude?: RhymeExclusion,
  difficultyHint?: string,      // English string from Difficulty.promptHint
  wordsPerGroup?: number | null, // null or undefined = use "3–4 words per group"
) => string
```

**For each of the 5 language templates:**

1. Remove the hardcoded vocabulary line (e.g. "Prefer simple nouns, verbs, and adjectives recognizable to a teenager or beginner.").
2. Replace it with a dynamic line:
   - If `difficultyHint` is provided: append `"Vocabulary level: {difficultyHint}."` (English, always — Claude handles mixed-language instructions).
   - If not provided: fall back to the existing intermediate-level wording.
3. Replace the hardcoded `"3–4 words per group"` with:
   - If `wordsPerGroup` is a number: `"Each group must have exactly {wordsPerGroup} words."`
   - If `null` or undefined: `"3–4 words per group."` (current behaviour).

### `lib/rhymes.ts` changes

**`FetchOpts`** — remove `count` (superseded by `scheme.groupCount`) and add two new optional fields:

```ts
export type FetchOpts = {
  // count removed — group count is now always derived from scheme.groupCount
  client?: Pick<Anthropic, 'messages'>;
  language?: LanguageId;
  exclude?: RhymeExclusion;
  difficultyId?: DifficultyId;   // new
  schemeId?: RhymeSchemeId;      // new
};
```

**`buildTool`** accepts `wordsPerGroup` to tighten the JSON schema constraint:

```ts
function buildTool(lang: Language, wordsPerGroup?: number | null) {
  // If wordsPerGroup is a number, set minItems = maxItems = wordsPerGroup.
  // Otherwise keep minItems: 2, maxItems: 5.
}
```

**`fetchRhymeGroups`** resolves difficulty and scheme from opts, then:

```ts
const difficulty = getDifficulty(opts.difficultyId);
const scheme = getRhymeScheme(opts.schemeId);
const count = scheme.groupCount; // replaces opts.count ?? 20
```

Passes `difficulty.promptHint` and `scheme.wordsPerGroup` into the `promptTemplate` call, and `scheme.wordsPerGroup` into `buildTool`.

---

## `lib/flatten-bars.ts` changes

`flattenBars` gains a `scheme` parameter:

```ts
export function flattenBars(groups: RhymeGroup[], scheme?: RhymeScheme): Bar[]
```

When `scheme?.interleave` is `false` or absent: existing sequential behaviour unchanged.

When `scheme.interleave` is `true` (alternating / ABAB):
- Process groups in pairs: `[g0, g1]`, `[g2, g3]`, …
- For each pair: emit `g0[0], g1[0], g0[1], g1[1]` (zip by word index).
- If Claude returns an odd group count, the last unpaired group is appended sequentially.
- Color assignment: words from g0 get `RHYME_COLORS[pairIndex * 2 % 4]`, words from g1 get `RHYME_COLORS[(pairIndex * 2 + 1) % 4]`.

---

## UI

### New components (mirrors `LanguagePicker` pattern)

**`components/DifficultyPicker.tsx`**

```ts
type Props = {
  difficulties: readonly Difficulty[];
  selectedId: DifficultyId;
  onChange: (id: DifficultyId) => void;
};
```

Renders a row of 4 chips. Active chip: `bg-rhyme-yellow/20 text-rhyme-yellow border border-rhyme-yellow`. Inactive: `bg-white/5 text-white/40`.

**`components/RhymeSchemePicker.tsx`**

```ts
type Props = {
  schemes: readonly RhymeScheme[];
  selectedId: RhymeSchemeId;
  onChange: (id: RhymeSchemeId) => void;
};
```

Same chip styling.

### `components/Setup.tsx` changes

Add two `useState` calls (no localStorage — both reset on load):

```tsx
const [difficultyId, setDifficultyId] = useState<DifficultyId>(DEFAULT_DIFFICULTY);
const [schemeId, setSchemeId] = useState<RhymeSchemeId>(DEFAULT_SCHEME);
```

Extend `onPlay` prop:

```ts
onPlay: (beat: Beat, languageId: LanguageId, difficultyId: DifficultyId, schemeId: RhymeSchemeId) => void
```

Layout order inside the `space-y-3` container (top → bottom):

1. BrowseBeats summary card
2. YT URL section + "Try YouTube mode →" link
3. `<LanguagePicker />`
4. `<DifficultyPicker />` ← new
5. `<RhymeSchemePicker />` ← new

### Upstream cascade from `onPlay` extension

`app/page.tsx` is `return <Game />;` — it doesn't need to change. `Game.tsx` renders `<Setup onPlay={handlePlay} />` internally and manages all phases. So the cascade is two files only:

| File | Change |
|------|--------|
| `components/Setup.tsx` | Calls `onPlay(activeBeat, languageId, difficultyId, schemeId)` |
| `components/Game.tsx` | `handlePlay` signature extends to `(beat, lang, difficultyId, schemeId)`; stores both in state; passes them to `/api/rhymes` |

### `app/api/rhymes/route.ts` changes

Request body extends from `{ language }` to `{ language, difficultyId, schemeId }`. The route resolves IDs to full objects via `getDifficulty` / `getRhymeScheme` before passing to `fetchRhymeGroups`. Invalid IDs silently fall back to defaults.

---

## Testing

### `lib/flatten-bars.test.ts` — new tests alongside existing

- Alternating scheme with 4 groups of 2 words → ABAB order: `g0[0], g1[0], g0[1], g1[1], g2[0], g3[0], g2[1], g3[1]`
- Non-alternating schemes (free, couplets, bar4) → sequential, same as today
- Odd group count with alternating → last group appended sequentially, no crash
- Color assignment: alternating words use per-pair color indexing

### `lib/rhymes.ts` — extract and test `buildPrompt`

Extract a pure helper `buildPrompt(lang, count, theme, difficultyHint?, wordsPerGroup?, exclude?)` from inside `fetchRhymeGroups`, export it for testing:

- Group count in output matches `count`
- Words-per-group instruction appears when `wordsPerGroup` is a number
- "3–4 words" appears when `wordsPerGroup` is null/undefined
- `difficultyHint` appears in output
- Hardcoded vocabulary line is absent

### Components

No unit tests. `DifficultyPicker` and `RhymeSchemePicker` are manually verified (same policy as `LanguagePicker`).

Estimated new tests: ~8 for `flatten-bars` + ~6 for `buildPrompt` = ~14.

---

## File Map

| File | Action |
|------|--------|
| `lib/difficulties.ts` | Create |
| `lib/rhyme-schemes.ts` | Create |
| `lib/difficulties.test.ts` | Create — `getDifficulty` fallback behaviour |
| `lib/rhyme-schemes.test.ts` | Create — `getRhymeScheme` fallback behaviour |
| `components/DifficultyPicker.tsx` | Create |
| `components/RhymeSchemePicker.tsx` | Create |
| `lib/languages.ts` | Modify — extend `promptTemplate` signature × 5 templates |
| `lib/rhymes.ts` | Modify — extend `FetchOpts`, extract `buildPrompt`, remove `count` field |
| `lib/flatten-bars.ts` | Modify — add `scheme` param, implement ABAB interleaving |
| `lib/flatten-bars.test.ts` | Modify — add alternating + edge-case tests |
| `lib/rhymes.test.ts` | Modify — add `buildPrompt` tests |
| `components/Setup.tsx` | Modify — add state + pickers + extend `onPlay` |
| `components/Game.tsx` | Modify — extend `handlePlay` signature, store difficulty + scheme in state, pass to `/api/rhymes` |
| `app/api/rhymes/route.ts` | Modify — accept + resolve `difficultyId` + `schemeId` |

---

## Non-Goals

- Persisting difficulty or scheme to localStorage (both reset each session)
- Themed rhyme categories (dropped)
- Mixed-difficulty sessions (single difficulty per session)
- Updating fallback groups per difficulty tier
- Component-level interaction tests (no jsdom)
