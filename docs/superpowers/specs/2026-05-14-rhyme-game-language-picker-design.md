# Rhyme Game — Language Picker

Add a language selection option to The Rhyme Game so players can choose which language the rhyming bars are generated in. The app's UI shell is translated once to English; the chosen language only affects rhyme content.

## Goals

- Support five languages: Ukrainian (`uk`), English (`en`), Spanish (`es`), German (`de`), Polish (`pl`).
- Player picks language on the Setup screen, alongside the existing beat picker.
- The choice is remembered across sessions; first-time visitors default based on browser language.
- Rhyme generation (Anthropic API and offline fallback) produces words in the chosen language.
- App UI stays in English globally regardless of language choice.

## Non-goals

- No general i18n framework. No translation of UI strings beyond the one-time Ukrainian → English pass.
- No user-supplied custom languages or runtime language input.
- No per-language beat catalog. Beats are language-independent.
- No diacritic/accent normalization beyond what already exists in the codebase.
- README and other docs remain in Ukrainian; a separate doc PR can translate them later.

## Architecture overview

Three pieces of work, each isolated:

1. **Languages module** — single source of truth for supported languages, prompts, and offline fallback rhyme groups.
2. **Rhymes API + library** — parameterized by language; chooses the right prompt and the right fallback.
3. **UI** — one-time English translation pass; new `LanguagePicker` component on Setup; language passed through `Game` into the API call; persistence via localStorage.

The Anthropic prompt and the offline fallback path are both selected per-language, so the game still starts even when the API is unreachable.

## Data model

New file: `lib/languages.ts`.

```ts
export type LanguageId = 'uk' | 'en' | 'es' | 'de' | 'pl';

export type Language = {
  id: LanguageId;
  label: string;        // native name, e.g. "Українська"
  flag: string;         // emoji shown in the picker
  promptTemplate: (count: number) => string;
};

export const LANGUAGES: readonly Language[];
export const DEFAULT_LANGUAGE: LanguageId = 'uk';

export function getLanguage(id: string | null | undefined): Language;
// Returns the matching Language, or LANGUAGES[uk] if id is missing/unknown.
```

`label` and `flag` are the only display fields used in the picker. Adding a new language is a single entry plus a fallback-groups entry.

### Fallback groups per language

`lib/fallback-groups.ts` is refactored:

```ts
export type RhymeGroup = { ending: string; words: string[] };

export const FALLBACK_GROUPS_BY_LANGUAGE: Record<LanguageId, RhymeGroup[]>;
```

The existing Ukrainian list moves under the `uk` key unchanged. Each of `en`, `es`, `de`, `pl` gets ≥ 10 hand-authored groups of common, age-appropriate words, mirroring the editorial guidance in the existing prompt: simple nouns, verbs, adjectives; nothing rare, archaic, or vulgar; 3–4 words per group; minimum 2 to survive validation.

Backwards compatibility: callers that previously imported `FALLBACK_GROUPS` are updated to import `FALLBACK_GROUPS_BY_LANGUAGE[lang]` instead. No re-export shim — the old symbol is removed.

## Rhymes API and library

### `lib/rhymes.ts`

`fetchRhymeGroups` gains a `language` option:

```ts
export type FetchOpts = {
  count?: number;
  client?: Pick<Anthropic, 'messages'>;
  language?: LanguageId;
};
```

Behavior changes:

- The prompt is built from `LANGUAGES[language].promptTemplate(count)` instead of a hardcoded Ukrainian string.
- The tool description becomes `Return groups of common <language label> words that rhyme.` (the language label is interpolated so Claude has clear context).
- On any failure path (no client, network error, malformed tool response), the function returns `FALLBACK_GROUPS_BY_LANGUAGE[language]` — not the Ukrainian list.
- An unknown / missing `language` resolves through `getLanguage(...)` to `uk`.

Each language's `promptTemplate` follows the same editorial structure as today's Ukrainian prompt:

1. Generate N groups of common <language> words that rhyme.
2. Each group shares an ending (from the stressed vowel onward).
3. 3–4 words per group; avoid rare, archaic, or vulgar entries.
4. Prefer common nouns, verbs, and adjectives recognizable to a teenager or beginner.
5. Emit results through the `rhyme_groups` tool.

The exact phrasing for each language is authored in the target language (the Ukrainian prompt stays in Ukrainian; the English prompt is in English; etc.).

### `app/api/rhymes/route.ts`

The route accepts a JSON body:

```json
{ "language": "uk" | "en" | "es" | "de" | "pl" }
```

Validation:

- Read `language` from the body; pass through `getLanguage(...)` so unknown / missing values fall back to `uk` without erroring.
- The server never trusts the client's language string blindly — `getLanguage` does the whitelist check.

The response shape (`{ groups, bars }`) is unchanged. Bars produced by `flattenBars` are language-agnostic.

## UI

### One-time English translation pass

Replace Ukrainian strings with English equivalents in:

- `components/Setup.tsx` — title `Римова Гра` → `The Rhyme Game`; button `ГРАТИ` → `PLAY`; `Вийти` → `Log out`.
- `components/Game.tsx` — `Завантаження...` → `Loading…`; `Завершити сесію?` → `End session?`; `Завершити` / `Продовжити` → `End` / `Continue`; aria `Вийти` → `Quit`; error messages `Не вдалося…` → `Couldn't load rhymes` / `Couldn't play beat`.
- `components/EndScreen.tsx` — all visible labels and buttons.
- `app/login/` — translate the login screen.
- `app/layout.tsx` — `<html lang="uk">` → `<html lang="en">`; document `<title>` to `The Rhyme Game`.

No i18n library is introduced. Strings remain inline.

### `components/LanguagePicker.tsx`

New component, modeled directly on `components/BeatPicker.tsx`:

```ts
type Props = {
  languages: readonly Language[];
  selectedId: LanguageId;
  onChange: (id: LanguageId) => void;
};
```

Renders a row of pill buttons, each showing `flag` and `label`. Selected pill is highlighted with the existing app accent. Keyboard-accessible via standard button focus.

### `components/Setup.tsx`

- Adds `languageId` state alongside `beatId`.
- On mount: read `rhyme-language` from `localStorage`. If absent or invalid, sniff `navigator.language` (split on `-`, take the prefix). If still not a supported id, use `DEFAULT_LANGUAGE`. Wrap in try/catch so SSR / private mode silently falls through.
- On `setLanguageId`: write `rhyme-language` to `localStorage` (best-effort).
- `LanguagePicker` is rendered below `BeatPicker`.
- The `onPlay` callback signature becomes `(beatId: string, languageId: LanguageId) => void`.

### `components/Game.tsx`

- Adds `languageId` state, initialized to `DEFAULT_LANGUAGE`; updated from Setup via `handlePlay`.
- The fetch to `/api/rhymes` includes `{ language: languageId }` in a JSON body with `Content-Type: application/json`.
- "Play again" (`onPlayAgain` from `EndScreen`) keeps the same `languageId` — the player doesn't need to reselect.
- Returning to Setup keeps `languageId` so the picker reflects the last choice.

## Persistence

- localStorage key: `rhyme-language`.
- Value: a `LanguageId` string (`"uk"`, `"en"`, etc.).
- Reads and writes go through a small helper in `lib/languages.ts` that swallows storage errors.
- First-visit default order: localStorage → `navigator.language` prefix match → `DEFAULT_LANGUAGE` (`uk`).

## Edge cases

- **localStorage unavailable** (SSR pre-hydration, private mode): the helper returns `null`; Setup falls through to `navigator.language` then to `DEFAULT_LANGUAGE`.
- **Unknown language from client**: server validates via `getLanguage` and uses `uk`.
- **Missing fallback for a language**: `LANGUAGES` and `FALLBACK_GROUPS_BY_LANGUAGE` are checked at boot by a unit test (see below); a missing entry is a build-time failure.
- **`navigator.language` formats** like `en-US`, `de-AT`: split on `-`, take prefix, lowercase. `pt-BR` → `pt` → no match → `uk`.
- **Beat audio is language-independent**: no change to `hooks/useBeat.ts` or `lib/beats.ts`.

## Tests

- `lib/rhymes.test.ts` — extended with:
  - Language passes through to the prompt content sent to the (mocked) client.
  - Fallback returns the correct language's groups when no client is supplied.
  - Unknown / missing language resolves to `uk` in both prompt and fallback paths.
- `lib/languages.test.ts` (new):
  - Every entry in `LANGUAGES` has a matching key in `FALLBACK_GROUPS_BY_LANGUAGE`.
  - Each fallback list has ≥ 8 groups (slight safety margin under the authored ≥ 10).
  - Every group has ≥ 2 words and a non-empty ending.
  - `getLanguage` returns `uk` for `null`, `undefined`, `""`, and unknown ids.
- Manual smoke test: pick each of the five languages on Setup, start a session, confirm bars render in that language and the beat still plays.

## Migration / rollout

- Single PR. No feature flag. No data migration (localStorage just starts being read).
- README is not updated in this PR; a follow-up doc PR can translate it if desired.
