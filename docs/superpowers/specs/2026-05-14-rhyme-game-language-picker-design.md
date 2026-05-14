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
  label: string;        // native name shown in the picker, e.g. "Українська"
  promptTemplate: (count: number) => string;
};

export const LANGUAGES: readonly Language[];               // ordered list for the picker
export const DEFAULT_LANGUAGE: LanguageId = 'uk';

// All id-based access goes through this. Never index LANGUAGES or
// FALLBACK_GROUPS_BY_LANGUAGE directly — getLanguage guarantees a
// valid Language for any input.
export function getLanguage(id: string | null | undefined): Language;
```

`LANGUAGES` is an ordered array (the picker iterates it). Lookups by id always go through `getLanguage`, which returns the matching entry or the `uk` entry for missing / unknown / malformed input. `label` is the native-name string shown in the picker (e.g. `Українська`, `English`, `Español`, `Deutsch`, `Polski`); no flag emojis are used. Adding a new language is a single entry plus a fallback-groups entry.

### Fallback groups per language

`lib/fallback-groups.ts` is refactored:

```ts
export type RhymeGroup = { ending: string; words: string[] };

export const FALLBACK_GROUPS_BY_LANGUAGE: Record<LanguageId, RhymeGroup[]>;
```

The existing Ukrainian list moves under the `uk` key unchanged. Each of `en`, `es`, `de`, `pl` gets 10 hand-authored groups of common, age-appropriate words, mirroring the editorial guidance in the existing prompt: simple nouns, verbs, adjectives; nothing rare, archaic, or vulgar; 3–4 words per group; minimum 2 to survive validation.

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

- Resolve `const lang = getLanguage(opts.language)` once at the top of the function. All downstream reads use `lang.id` and `lang.promptTemplate`. The maps are never indexed directly.
- The prompt is built from `lang.promptTemplate(count)` instead of a hardcoded Ukrainian string.
- The tool definition becomes a `buildTool(lang: Language)` helper called per request. The returned tool's `name` stays `rhyme_groups`; only the `description` is interpolated: `Return groups of common ${lang.label} words that rhyme.` The previous module-level `TOOL` constant is removed.
- On any failure path (no client, network error, malformed tool response), the function returns `FALLBACK_GROUPS_BY_LANGUAGE[lang.id]` — not the Ukrainian list.

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

Renders a row of pill buttons, each showing the `label` (native language name) only. Selected pill is highlighted with the existing app accent and carries `aria-pressed="true"`. Keyboard-accessible via standard button focus.

### `components/Setup.tsx`

- Adds `languageId` state alongside `beatId`. State is initialized to `DEFAULT_LANGUAGE` (a stable value safe for SSR). A `useEffect` runs after mount and reconciles the state from `loadLanguage()` (see Persistence below). Initialization is **not** done via a lazy `useState` initializer, to avoid an SSR / hydration mismatch.
- On `setLanguageId`: call `saveLanguage(id)`.
- `LanguagePicker` is rendered below `BeatPicker`.
- The `onPlay` callback signature becomes `(beatId: string, languageId: LanguageId) => void`.
- The existing Space / Enter keyboard handler is updated to call `onPlay(beatId, languageId)`.

### `components/Game.tsx`

- Adds `languageId` state, initialized to `DEFAULT_LANGUAGE`; updated from Setup via `handlePlay`.
- The fetch to `/api/rhymes` includes `{ language: languageId }` in a JSON body with `Content-Type: application/json`.
- "Play again" (`onPlayAgain` from `EndScreen`) keeps the same `languageId` — the player doesn't need to reselect.
- Returning to Setup keeps `languageId` so the picker reflects the last choice.

## Persistence

A new client-only module `lib/language-storage.ts` owns localStorage access. Keeping it separate from `lib/languages.ts` matters because `lib/languages.ts` is imported by `lib/rhymes.ts`, which runs in the Node.js API route — a shared types module shouldn't carry browser-only code.

```ts
// lib/language-storage.ts
export function loadLanguage(): LanguageId;   // localStorage → navigator.language prefix → DEFAULT_LANGUAGE
export function saveLanguage(id: LanguageId): void;  // best-effort; swallows storage errors
```

- localStorage key: `rhyme-language`.
- Value: a `LanguageId` string (`"uk"`, `"en"`, etc.).
- Resolution order on read: localStorage → `navigator.language` prefix match (split on `-`, lowercase) → `DEFAULT_LANGUAGE` (`uk`).
- Both functions wrap storage access in try/catch so SSR / private mode silently falls through.

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
  - Each fallback list has ≥ 10 groups (matches the authoring requirement; deliberate deletions force a test update).
  - Every group has ≥ 2 words and a non-empty ending.
  - `getLanguage` returns `uk` for `null`, `undefined`, `""`, and unknown ids.
- Manual smoke test: pick each of the five languages on Setup, start a session, confirm bars render in that language and the beat still plays.

## Migration / rollout

- Single PR. No feature flag. No data migration (localStorage just starts being read).
- README is not updated in this PR; a follow-up doc PR can translate it if desired.
