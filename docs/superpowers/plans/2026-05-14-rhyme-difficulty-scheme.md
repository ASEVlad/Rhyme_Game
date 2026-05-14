# Rhyme Difficulty & Scheme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Difficulty (Beginner/Intermediate/Advanced/Expert) and Rhyme Scheme (Free/Couplets/4-bar/Alternating) controls to the Setup screen, wiring them through the prompt layer and flattenBars.

**Architecture:** Difficulty is a prompt-only English hint injected into every language template. Rhyme Scheme controls both the group count requested from Claude and word ordering in flattenBars (sequential vs ABAB). Both reset to defaults on page load; fallback groups are silently unchanged when Claude is unavailable.

**Tech Stack:** TypeScript, React 18, Next.js 14 App Router, Tailwind CSS, Vitest (node env — no jsdom)

---

### Task 1: Data layer — `lib/difficulties.ts` and `lib/rhyme-schemes.ts`

**Files:**
- Create: `lib/difficulties.ts`
- Create: `lib/rhyme-schemes.ts`
- Create: `lib/difficulties.test.ts`
- Create: `lib/rhyme-schemes.test.ts`

- [ ] **Step 1: Write failing tests for `getDifficulty`**

Create `lib/difficulties.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getDifficulty, DEFAULT_DIFFICULTY, DIFFICULTIES } from './difficulties';

describe('getDifficulty', () => {
  it('returns correct difficulty for each valid id', () => {
    for (const d of DIFFICULTIES) {
      expect(getDifficulty(d.id).id).toBe(d.id);
    }
  });

  it('returns default for null', () => {
    expect(getDifficulty(null).id).toBe(DEFAULT_DIFFICULTY);
  });

  it('returns default for undefined', () => {
    expect(getDifficulty(undefined).id).toBe(DEFAULT_DIFFICULTY);
  });

  it('returns default for unknown string', () => {
    expect(getDifficulty('legendary').id).toBe(DEFAULT_DIFFICULTY);
  });

  it('default is beginner', () => {
    expect(DEFAULT_DIFFICULTY).toBe('beginner');
  });
});
```

- [ ] **Step 2: Run — expect failure**

```
npm test -- lib/difficulties
```
Expected: FAIL with "Cannot find module './difficulties'"

- [ ] **Step 3: Create `lib/difficulties.ts`**

```ts
export type DifficultyId = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type Difficulty = {
  id: DifficultyId;
  label: string;
  promptHint: string;
};

export const DIFFICULTIES: readonly Difficulty[] = [
  { id: 'beginner',     label: 'Beginner',     promptHint: 'very common words a young child would know' },
  { id: 'intermediate', label: 'Intermediate', promptHint: 'common words a teenager would recognize' },
  { id: 'advanced',     label: 'Advanced',     promptHint: 'expressive, less common vocabulary' },
  { id: 'expert',       label: 'Expert',       promptHint: 'rare, abstract, or sophisticated vocabulary' },
];

export const DEFAULT_DIFFICULTY: DifficultyId = 'beginner';

const BY_ID = DIFFICULTIES.reduce(
  (acc, d) => { acc[d.id] = d; return acc; },
  {} as Record<DifficultyId, Difficulty>
);

export function getDifficulty(id: string | null | undefined): Difficulty {
  if (id && id in BY_ID) return BY_ID[id as DifficultyId];
  return BY_ID[DEFAULT_DIFFICULTY];
}
```

- [ ] **Step 4: Run — expect pass**

```
npm test -- lib/difficulties
```
Expected: PASS (5 tests)

- [ ] **Step 5: Write failing tests for `getRhymeScheme`**

Create `lib/rhyme-schemes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getRhymeScheme, DEFAULT_SCHEME, RHYME_SCHEMES } from './rhyme-schemes';

describe('getRhymeScheme', () => {
  it('returns correct scheme for each valid id', () => {
    for (const s of RHYME_SCHEMES) {
      expect(getRhymeScheme(s.id).id).toBe(s.id);
    }
  });

  it('returns default for null', () => {
    expect(getRhymeScheme(null).id).toBe(DEFAULT_SCHEME);
  });

  it('returns default for undefined', () => {
    expect(getRhymeScheme(undefined).id).toBe(DEFAULT_SCHEME);
  });

  it('returns default for unknown string', () => {
    expect(getRhymeScheme('haiku').id).toBe(DEFAULT_SCHEME);
  });

  it('default is free', () => {
    expect(DEFAULT_SCHEME).toBe('free');
  });

  it('free scheme has null wordsPerGroup', () => {
    expect(getRhymeScheme('free').wordsPerGroup).toBeNull();
  });

  it('alternating scheme has interleave: true', () => {
    expect(getRhymeScheme('alternating').interleave).toBe(true);
  });

  it('non-alternating schemes have interleave: false', () => {
    expect(getRhymeScheme('free').interleave).toBe(false);
    expect(getRhymeScheme('couplets').interleave).toBe(false);
    expect(getRhymeScheme('bar4').interleave).toBe(false);
  });

  it('non-free schemes produce 32 total bars (groupCount × wordsPerGroup)', () => {
    for (const s of RHYME_SCHEMES) {
      if (s.wordsPerGroup != null) {
        expect(s.groupCount * s.wordsPerGroup).toBe(32);
      }
    }
  });
});
```

- [ ] **Step 6: Run — expect failure**

```
npm test -- lib/rhyme-schemes
```
Expected: FAIL with "Cannot find module './rhyme-schemes'"

- [ ] **Step 7: Create `lib/rhyme-schemes.ts`**

```ts
export type RhymeSchemeId = 'free' | 'couplets' | 'bar4' | 'alternating';

export type RhymeScheme = {
  id: RhymeSchemeId;
  label: string;
  wordsPerGroup: number | null;
  groupCount: number;
  interleave: boolean;
};

export const RHYME_SCHEMES: readonly RhymeScheme[] = [
  { id: 'free',        label: 'Free',        wordsPerGroup: null, groupCount: 10, interleave: false },
  { id: 'couplets',    label: 'Couplets',    wordsPerGroup: 2,    groupCount: 16, interleave: false },
  { id: 'bar4',        label: '4-bar',       wordsPerGroup: 4,    groupCount: 8,  interleave: false },
  { id: 'alternating', label: 'Alternating', wordsPerGroup: 2,    groupCount: 16, interleave: true  },
];

export const DEFAULT_SCHEME: RhymeSchemeId = 'free';

const BY_ID = RHYME_SCHEMES.reduce(
  (acc, s) => { acc[s.id] = s; return acc; },
  {} as Record<RhymeSchemeId, RhymeScheme>
);

export function getRhymeScheme(id: string | null | undefined): RhymeScheme {
  if (id && id in BY_ID) return BY_ID[id as RhymeSchemeId];
  return BY_ID[DEFAULT_SCHEME];
}
```

- [ ] **Step 8: Run — expect pass**

```
npm test -- lib/rhyme-schemes
```
Expected: PASS (9 tests)

- [ ] **Step 9: Commit**

```bash
git add lib/difficulties.ts lib/difficulties.test.ts lib/rhyme-schemes.ts lib/rhyme-schemes.test.ts
git commit -m "feat: add difficulties and rhyme-schemes data modules"
```

---

### Task 2: Extend `lib/languages.ts` prompt templates × 5

**Files:**
- Modify: `lib/languages.ts`

New params are optional — all existing callers remain valid. Behavior is tested in Task 3 via `buildPrompt`.

- [ ] **Step 1: Update the `Language` type signature**

Replace line 9 of `lib/languages.ts`:
```ts
  promptTemplate: (count: number, theme: string, exclude?: RhymeExclusion) => string;
```
With:
```ts
  promptTemplate: (
    count: number,
    theme: string,
    exclude?: RhymeExclusion,
    difficultyHint?: string,
    wordsPerGroup?: number | null,
  ) => string;
```

- [ ] **Step 2: Replace the Ukrainian (`uk`) template body (lines 24–36)**

```ts
promptTemplate: (count, theme, exclude, difficultyHint, wordsPerGroup) => {
  const groupSizeLine = wordsPerGroup != null
    ? `Each group must have exactly ${wordsPerGroup} words. Уникай рідкісних, архаїчних або вульгарних слів.`
    : 'У кожній групі — 3–4 слова. Уникай рідкісних, архаїчних або вульгарних слів.';
  const vocabLine = difficultyHint
    ? `Vocabulary level: ${difficultyHint}.`
    : 'Перевага — простим іменникам, дієсловам та прикметникам, які впізнає підліток або початківець.';
  const parts = [
    `Тема: "${theme}".`,
    `Згенеруй ${count} груп поширених українських слів, пов'язаних із темою "${theme}", які римуються між собою.`,
    'Кожна група повинна мати спільне закінчення (від наголошеного голосного до кінця слова).',
    groupSizeLine,
    vocabLine,
  ];
  if (exclude?.words.length) parts.push(`Не використовуй ці слова: ${exclude.words.join(', ')}.`);
  if (exclude?.endings.length) parts.push(`Не використовуй ці закінчення: ${exclude.endings.join(', ')}.`);
  parts.push('Виведи результат через інструмент rhyme_groups.');
  return joinLines(parts);
},
```

- [ ] **Step 3: Replace the English (`en`) template body (lines 45–57)**

```ts
promptTemplate: (count, theme, exclude, difficultyHint, wordsPerGroup) => {
  const groupSizeLine = wordsPerGroup != null
    ? `Each group must have exactly ${wordsPerGroup} words. Avoid rare, archaic, or vulgar words.`
    : '3–4 words per group. Avoid rare, archaic, or vulgar words.';
  const vocabLine = difficultyHint
    ? `Vocabulary level: ${difficultyHint}.`
    : 'Prefer simple nouns, verbs, and adjectives recognizable to a teenager or beginner.';
  const parts = [
    `Theme: "${theme}".`,
    `Generate ${count} groups of common English words related to "${theme}" that rhyme.`,
    'Each group must share an ending (from the stressed vowel to the end of the word).',
    groupSizeLine,
    vocabLine,
  ];
  if (exclude?.words.length) parts.push(`Do not use these words: ${exclude.words.join(', ')}.`);
  if (exclude?.endings.length) parts.push(`Do not use these endings: ${exclude.endings.join(', ')}.`);
  parts.push('Return the result via the rhyme_groups tool.');
  return joinLines(parts);
},
```

- [ ] **Step 4: Replace the Spanish (`es`) template body (lines 67–79)**

```ts
promptTemplate: (count, theme, exclude, difficultyHint, wordsPerGroup) => {
  const groupSizeLine = wordsPerGroup != null
    ? `Each group must have exactly ${wordsPerGroup} words. Evita palabras raras, arcaicas o vulgares.`
    : '3–4 palabras por grupo. Evita palabras raras, arcaicas o vulgares.';
  const vocabLine = difficultyHint
    ? `Vocabulary level: ${difficultyHint}.`
    : 'Prefiere sustantivos, verbos y adjetivos simples reconocibles para un adolescente o principiante.';
  const parts = [
    `Tema: "${theme}".`,
    `Genera ${count} grupos de palabras españolas comunes relacionadas con "${theme}" que rimen entre sí.`,
    'Cada grupo debe compartir una terminación (desde la vocal tónica hasta el final de la palabra).',
    groupSizeLine,
    vocabLine,
  ];
  if (exclude?.words.length) parts.push(`No uses estas palabras: ${exclude.words.join(', ')}.`);
  if (exclude?.endings.length) parts.push(`No uses estas terminaciones: ${exclude.endings.join(', ')}.`);
  parts.push('Devuelve el resultado a través de la herramienta rhyme_groups.');
  return joinLines(parts);
},
```

- [ ] **Step 5: Replace the German (`de`) template body (lines 88–100)**

```ts
promptTemplate: (count, theme, exclude, difficultyHint, wordsPerGroup) => {
  const groupSizeLine = wordsPerGroup != null
    ? `Each group must have exactly ${wordsPerGroup} words. Vermeide seltene, archaische oder vulgäre Wörter.`
    : '3–4 Wörter pro Gruppe. Vermeide seltene, archaische oder vulgäre Wörter.';
  const vocabLine = difficultyHint
    ? `Vocabulary level: ${difficultyHint}.`
    : 'Bevorzuge einfache Substantive, Verben und Adjektive, die ein Jugendlicher oder Anfänger erkennt.';
  const parts = [
    `Thema: "${theme}".`,
    `Generiere ${count} Gruppen häufiger deutscher Wörter zum Thema "${theme}", die sich reimen.`,
    'Jede Gruppe muss eine gemeinsame Endung haben (vom betonten Vokal bis zum Wortende).',
    groupSizeLine,
    vocabLine,
  ];
  if (exclude?.words.length) parts.push(`Verwende diese Wörter nicht: ${exclude.words.join(', ')}.`);
  if (exclude?.endings.length) parts.push(`Verwende diese Endungen nicht: ${exclude.endings.join(', ')}.`);
  parts.push('Gib das Ergebnis über das Tool rhyme_groups zurück.');
  return joinLines(parts);
},
```

- [ ] **Step 6: Replace the Polish (`pl`) template body (lines 108–120)**

```ts
promptTemplate: (count, theme, exclude, difficultyHint, wordsPerGroup) => {
  const groupSizeLine = wordsPerGroup != null
    ? `Each group must have exactly ${wordsPerGroup} words. Unikaj rzadkich, archaicznych lub wulgarnych słów.`
    : '3–4 słowa w grupie. Unikaj rzadkich, archaicznych lub wulgarnych słów.';
  const vocabLine = difficultyHint
    ? `Vocabulary level: ${difficultyHint}.`
    : 'Preferuj proste rzeczowniki, czasowniki i przymiotniki rozpoznawalne dla nastolatka lub początkującego.';
  const parts = [
    `Temat: "${theme}".`,
    `Wygeneruj ${count} grup popularnych polskich słów związanych z tematem "${theme}", które się rymują.`,
    'Każda grupa musi mieć wspólne zakończenie (od akcentowanej samogłoski do końca słowa).',
    groupSizeLine,
    vocabLine,
  ];
  if (exclude?.words.length) parts.push(`Nie używaj tych słów: ${exclude.words.join(', ')}.`);
  if (exclude?.endings.length) parts.push(`Nie używaj tych zakończeń: ${exclude.endings.join(', ')}.`);
  parts.push('Zwróć wynik za pomocą narzędzia rhyme_groups.');
  return joinLines(parts);
},
```

- [ ] **Step 7: Run full test suite to confirm no regressions**

```
npm test
```
Expected: All existing tests pass (new params are optional).

- [ ] **Step 8: Commit**

```bash
git add lib/languages.ts
git commit -m "feat: extend promptTemplate with difficultyHint and wordsPerGroup params"
```

---

### Task 3: Refactor `lib/rhymes.ts` — remove `count`, add scheme/difficulty, extract `buildPrompt`

**Files:**
- Modify: `lib/rhymes.ts`
- Modify: `lib/rhymes.test.ts`

- [ ] **Step 1: Write failing `buildPrompt` tests in `lib/rhymes.test.ts`**

**a)** Update the first import line (line 2) to add `buildPrompt`:
```ts
import { fetchRhymeGroups, sampleGroups, buildPrompt } from './rhymes';
```

**b)** Add this `describe` block at the very end of the file:
```ts
describe('buildPrompt', () => {
  const lang = getLanguage('en');

  it('includes the group count in the output', () => {
    const p = buildPrompt(lang, 8, 'nature');
    expect(p).toContain('8');
  });

  it('uses "3–4 words" when wordsPerGroup is null', () => {
    const p = buildPrompt(lang, 4, 'nature', undefined, null);
    expect(p).toContain('3–4');
  });

  it('uses "3–4 words" when wordsPerGroup is undefined', () => {
    const p = buildPrompt(lang, 4, 'nature');
    expect(p).toContain('3–4');
  });

  it('uses exact count when wordsPerGroup is a number', () => {
    const p = buildPrompt(lang, 4, 'nature', undefined, 2);
    expect(p).toContain('exactly 2');
  });

  it('includes difficultyHint in the output', () => {
    const p = buildPrompt(lang, 4, 'nature', 'rare, abstract, or sophisticated vocabulary');
    expect(p).toContain('rare, abstract, or sophisticated vocabulary');
  });

  it('omits the hardcoded teenager line when difficultyHint is provided', () => {
    const p = buildPrompt(lang, 4, 'nature', 'expert vocabulary');
    expect(p).not.toContain('teenager');
  });

  it('includes English hint even for a non-English language', () => {
    const p = buildPrompt(getLanguage('uk'), 4, 'природа', 'expressive, less common vocabulary');
    expect(p).toContain('expressive, less common vocabulary');
  });
});
```

- [ ] **Step 2: Run — expect new tests fail**

```
npm test -- lib/rhymes
```
Expected: existing tests pass; new `buildPrompt` tests FAIL with "buildPrompt is not exported"

- [ ] **Step 3: Replace `lib/rhymes.ts`**

```ts
import type Anthropic from '@anthropic-ai/sdk';
import { FALLBACK_GROUPS_BY_LANGUAGE, type RhymeGroup } from './fallback-groups';
import { getLanguage, type Language, type LanguageId, type RhymeExclusion } from './languages';
import { getDifficulty, type DifficultyId } from './difficulties';
import { getRhymeScheme, type RhymeSchemeId } from './rhyme-schemes';

const TOOL_NAME = 'rhyme_groups';

function buildTool(lang: Language, wordsPerGroup?: number | null) {
  const wordsSchema = wordsPerGroup != null
    ? { type: 'array', items: { type: 'string' }, minItems: wordsPerGroup, maxItems: wordsPerGroup }
    : { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 };
  return {
    name: TOOL_NAME,
    description: `Return groups of common ${lang.label} words that rhyme.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        groups: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ending: { type: 'string', description: 'Shared ending (e.g. "-іт")' },
              words: wordsSchema,
            },
            required: ['ending', 'words'],
          },
        },
      },
      required: ['groups'],
    },
  };
}

export function buildPrompt(
  lang: Language,
  count: number,
  theme: string,
  difficultyHint?: string,
  wordsPerGroup?: number | null,
  exclude?: RhymeExclusion,
): string {
  return lang.promptTemplate(count, theme, exclude, difficultyHint, wordsPerGroup);
}

export type FetchOpts = {
  client?: Pick<Anthropic, 'messages'>;
  language?: LanguageId;
  exclude?: RhymeExclusion;
  difficultyId?: DifficultyId;
  schemeId?: RhymeSchemeId;
};

function parseGroups(content: unknown): RhymeGroup[] | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block && typeof block === 'object' && (block as any).type === 'tool_use' && (block as any).name === TOOL_NAME) {
      const groups = (block as any).input?.groups;
      if (!Array.isArray(groups)) return null;
      const cleaned: RhymeGroup[] = [];
      for (const g of groups) {
        if (!g || typeof g.ending !== 'string') continue;
        if (!Array.isArray(g.words)) continue;
        const words = g.words.filter((w: unknown) => typeof w === 'string' && w.length > 0);
        if (words.length >= 2) cleaned.push({ ending: g.ending, words });
      }
      return cleaned.length ? cleaned : null;
    }
  }
  return null;
}

export function sampleGroups(groups: RhymeGroup[], n: number): RhymeGroup[] {
  const copy = [...groups];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export async function fetchRhymeGroups(opts: FetchOpts = {}): Promise<RhymeGroup[]> {
  const difficulty = getDifficulty(opts.difficultyId);
  const scheme = getRhymeScheme(opts.schemeId);
  const lang = getLanguage(opts.language);
  const fallback = FALLBACK_GROUPS_BY_LANGUAGE[lang.id];
  const client = opts.client;
  if (!client) return fallback;
  const theme = lang.themes[Math.floor(Math.random() * lang.themes.length)];
  try {
    const tool = buildTool(lang, scheme.wordsPerGroup);
    const prompt = buildPrompt(lang, scheme.groupCount, theme, difficulty.promptHint, scheme.wordsPerGroup, opts.exclude);
    const response: any = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      temperature: 1,
      tools: [tool],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{ role: 'user', content: prompt }],
    });
    const parsed = parseGroups(response?.content);
    return parsed ?? fallback;
  } catch (err) {
    console.error('[rhymes] fetch failed, using fallback', err);
    return fallback;
  }
}
```

- [ ] **Step 4: Remove `count:` from all `fetchRhymeGroups` calls in `lib/rhymes.test.ts`**

Remove `count: N,` from every existing call (TypeScript will error if left in since the field no longer exists). Full list:

| Old | New |
|-----|-----|
| `fetchRhymeGroups({ count: 2, client, language: 'uk' })` | `fetchRhymeGroups({ client, language: 'uk' })` |
| `fetchRhymeGroups({ count: 3, client, language: 'en' })` | `fetchRhymeGroups({ client, language: 'en' })` |
| `fetchRhymeGroups({ count: 2, client, language: 'uk', exclude: ... })` | `fetchRhymeGroups({ client, language: 'uk', exclude: ... })` |
| `fetchRhymeGroups({ count: 2, client, language: 'en', exclude: ... })` | `fetchRhymeGroups({ client, language: 'en', exclude: ... })` |
| `fetchRhymeGroups({ count: 1, client, language: 'es' })` | `fetchRhymeGroups({ client, language: 'es' })` |
| `fetchRhymeGroups({ count: 2, client: mockClient('throws'), language: 'de' })` | `fetchRhymeGroups({ client: mockClient('throws'), language: 'de' })` |
| `fetchRhymeGroups({ count: 2, client: mockClient('malformed'), language: 'pl' })` | `fetchRhymeGroups({ client: mockClient('malformed'), language: 'pl' })` |
| `fetchRhymeGroups({ count: 2, client: mockClient('empty'), language: 'en' })` | `fetchRhymeGroups({ client: mockClient('empty'), language: 'en' })` |
| `fetchRhymeGroups({ count: 2, language: 'es' })` | `fetchRhymeGroups({ language: 'es' })` |
| `fetchRhymeGroups({ count: 2 })` | `fetchRhymeGroups()` |
| `fetchRhymeGroups({ count: 2, language: 'ru' as any })` | `fetchRhymeGroups({ language: 'ru' as any })` |

Also update the prompt-content assertion in the "uses the requested language's prompt template" test — the free scheme sends `groupCount: 10`, not 3:

```ts
it("uses the requested language's prompt template", async () => {
  const client = mockClient('good');
  await fetchRhymeGroups({ client, language: 'en' });
  const call = client.messages.create.mock.calls[0][0];
  const userMessage = call.messages[0].content;
  expect(userMessage).toContain('English');
  expect(userMessage).toContain('10'); // free scheme groupCount
});
```

- [ ] **Step 5: Run — expect all pass**

```
npm test -- lib/rhymes
```
Expected: All tests pass (existing + 7 new `buildPrompt` tests).

- [ ] **Step 6: Commit**

```bash
git add lib/rhymes.ts lib/rhymes.test.ts
git commit -m "feat: remove count from FetchOpts, derive from scheme; extract buildPrompt"
```

---

### Task 4: ABAB interleaving — `lib/flatten-bars.ts` and `lib/flatten-bars.test.ts`

**Files:**
- Modify: `lib/flatten-bars.ts`
- Modify: `lib/flatten-bars.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `lib/flatten-bars.test.ts`:

**a)** Add import at the top of the file (alongside the existing imports):
```ts
import { getRhymeScheme } from './rhyme-schemes';
```

**b)** Add these two `describe` blocks after the existing one:

```ts
describe('flattenBars — alternating scheme', () => {
  it('interleaves groups in ABAB order', () => {
    const groups = [
      { ending: '-a', words: ['a0', 'a1'] },
      { ending: '-b', words: ['b0', 'b1'] },
      { ending: '-c', words: ['c0', 'c1'] },
      { ending: '-d', words: ['d0', 'd1'] },
    ];
    const bars = flattenBars(groups, getRhymeScheme('alternating'));
    expect(bars.map(b => b.word)).toEqual(['a0', 'b0', 'a1', 'b1', 'c0', 'd0', 'c1', 'd1']);
  });

  it('assigns per-pair colors: pair0 = yellow/blue, pair1 = orange/red', () => {
    const groups = [
      { ending: '-a', words: ['a0', 'a1'] },
      { ending: '-b', words: ['b0', 'b1'] },
      { ending: '-c', words: ['c0', 'c1'] },
      { ending: '-d', words: ['d0', 'd1'] },
    ];
    const bars = flattenBars(groups, getRhymeScheme('alternating'));
    expect(bars.map(b => b.color)).toEqual([
      'yellow', 'blue', 'yellow', 'blue',
      'orange', 'red',  'orange', 'red',
    ]);
  });

  it('sets groupIndex to the original group position', () => {
    const groups = [
      { ending: '-a', words: ['a0', 'a1'] },
      { ending: '-b', words: ['b0', 'b1'] },
    ];
    const bars = flattenBars(groups, getRhymeScheme('alternating'));
    expect(bars.map(b => b.groupIndex)).toEqual([0, 1, 0, 1]);
  });

  it('appends the last unpaired group sequentially when group count is odd', () => {
    const groups = [
      { ending: '-a', words: ['a0', 'a1'] },
      { ending: '-b', words: ['b0', 'b1'] },
      { ending: '-c', words: ['c0', 'c1'] },
    ];
    const bars = flattenBars(groups, getRhymeScheme('alternating'));
    expect(bars.map(b => b.word)).toEqual(['a0', 'b0', 'a1', 'b1', 'c0', 'c1']);
  });

  it('returns empty array for empty input', () => {
    expect(flattenBars([], getRhymeScheme('alternating'))).toEqual([]);
  });
});

describe('flattenBars — non-alternating schemes stay sequential', () => {
  it('couplets scheme produces sequential bars', () => {
    const groups = [
      { ending: '-a', words: ['a0', 'a1'] },
      { ending: '-b', words: ['b0', 'b1'] },
    ];
    const bars = flattenBars(groups, getRhymeScheme('couplets'));
    expect(bars.map(b => b.word)).toEqual(['a0', 'a1', 'b0', 'b1']);
  });

  it('no scheme argument produces sequential bars (backward compat)', () => {
    const groups = [
      { ending: '-x', words: ['x0', 'x1'] },
      { ending: '-y', words: ['y0', 'y1'] },
    ];
    expect(flattenBars(groups).map(b => b.word)).toEqual(['x0', 'x1', 'y0', 'y1']);
  });
});
```

- [ ] **Step 2: Run — expect new tests fail**

```
npm test -- lib/flatten-bars
```
Expected: new tests FAIL; existing 4 tests pass

- [ ] **Step 3: Replace `lib/flatten-bars.ts`**

```ts
import type { RhymeGroup } from './fallback-groups';
import { RHYME_COLORS, type RhymeColor } from './colors';
import type { RhymeScheme } from './rhyme-schemes';

export type Bar = {
  word: string;
  color: RhymeColor;
  groupIndex: number;
};

export function flattenBars(groups: RhymeGroup[], scheme?: RhymeScheme): Bar[] {
  if (!scheme?.interleave) {
    const bars: Bar[] = [];
    groups.forEach((g, i) => {
      const color = RHYME_COLORS[i % RHYME_COLORS.length];
      g.words.forEach(word => bars.push({ word, color, groupIndex: i }));
    });
    return bars;
  }

  const bars: Bar[] = [];
  let pairIndex = 0;
  for (let i = 0; i + 1 < groups.length; i += 2) {
    const g0 = groups[i];
    const g1 = groups[i + 1];
    const color0 = RHYME_COLORS[(pairIndex * 2) % RHYME_COLORS.length];
    const color1 = RHYME_COLORS[(pairIndex * 2 + 1) % RHYME_COLORS.length];
    const maxLen = Math.max(g0.words.length, g1.words.length);
    for (let w = 0; w < maxLen; w++) {
      if (w < g0.words.length) bars.push({ word: g0.words[w], color: color0, groupIndex: i });
      if (w < g1.words.length) bars.push({ word: g1.words[w], color: color1, groupIndex: i + 1 });
    }
    pairIndex++;
  }
  if (groups.length % 2 === 1) {
    const last = groups[groups.length - 1];
    const color = RHYME_COLORS[(groups.length - 1) % RHYME_COLORS.length];
    last.words.forEach(word => bars.push({ word, color, groupIndex: groups.length - 1 }));
  }
  return bars;
}
```

- [ ] **Step 4: Run — expect all pass**

```
npm test -- lib/flatten-bars
```
Expected: PASS (4 existing + 7 new = 11 tests)

- [ ] **Step 5: Run full suite**

```
npm test
```
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/flatten-bars.ts lib/flatten-bars.test.ts
git commit -m "feat: add ABAB interleaving to flattenBars for alternating scheme"
```

---

### Task 5: Extend `app/api/rhymes/route.ts`

**Files:**
- Modify: `app/api/rhymes/route.ts`

- [ ] **Step 1: Replace `app/api/rhymes/route.ts`**

```ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { fetchRhymeGroups } from '@/lib/rhymes';
import { getLanguage } from '@/lib/languages';
import type { RhymeExclusion } from '@/lib/languages';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  let rawLanguage: string | null = null;
  let rawDifficultyId: string | null = null;
  let rawSchemeId: string | null = null;
  let exclude: RhymeExclusion = { words: [], endings: [] };
  try {
    const body = await request.json();
    if (body && typeof body.language === 'string') rawLanguage = body.language;
    if (body && typeof body.difficultyId === 'string') rawDifficultyId = body.difficultyId;
    if (body && typeof body.schemeId === 'string') rawSchemeId = body.schemeId;
    if (Array.isArray(body?.exclude?.words)) {
      exclude.words = body.exclude.words
        .filter((w: unknown) => typeof w === 'string')
        .slice(0, 60);
    }
    if (Array.isArray(body?.exclude?.endings)) {
      exclude.endings = body.exclude.endings
        .filter((e: unknown) => typeof e === 'string')
        .slice(0, 20);
    }
  } catch {
    // No body or malformed JSON — use defaults.
  }
  const lang = getLanguage(rawLanguage);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[rhymes] ANTHROPIC_API_KEY not set — using fallback groups');
  }
  const client = apiKey ? new Anthropic({ apiKey }) : undefined;
  const groups = await fetchRhymeGroups({
    client,
    language: lang.id,
    exclude,
    difficultyId: rawDifficultyId ?? undefined,
    schemeId: rawSchemeId ?? undefined,
  });
  return NextResponse.json({ groups });
}
```

- [ ] **Step 2: Run full test suite**

```
npm test
```
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/api/rhymes/route.ts
git commit -m "feat: accept difficultyId and schemeId in /api/rhymes"
```

---

### Task 6: Create `DifficultyPicker` and `RhymeSchemePicker` components

**Files:**
- Create: `components/DifficultyPicker.tsx`
- Create: `components/RhymeSchemePicker.tsx`

No unit tests — same policy as `LanguagePicker`.

- [ ] **Step 1: Create `components/DifficultyPicker.tsx`**

```tsx
'use client';

import type { Difficulty, DifficultyId } from '@/lib/difficulties';

type Props = {
  difficulties: readonly Difficulty[];
  selectedId: DifficultyId;
  onChange: (id: DifficultyId) => void;
};

export function DifficultyPicker({ difficulties, selectedId, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Difficulty"
      className="flex flex-wrap justify-center gap-2 rounded-2xl bg-white/5 px-3 py-3"
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
            className={
              selected
                ? 'rounded-full border border-rhyme-yellow bg-rhyme-yellow/20 px-4 py-2 text-sm font-bold text-rhyme-yellow'
                : 'rounded-full bg-white/5 px-4 py-2 text-sm text-white/40 hover:bg-white/10'
            }
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/RhymeSchemePicker.tsx`**

```tsx
'use client';

import type { RhymeScheme, RhymeSchemeId } from '@/lib/rhyme-schemes';

type Props = {
  schemes: readonly RhymeScheme[];
  selectedId: RhymeSchemeId;
  onChange: (id: RhymeSchemeId) => void;
};

export function RhymeSchemePicker({ schemes, selectedId, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Rhyme scheme"
      className="flex flex-wrap justify-center gap-2 rounded-2xl bg-white/5 px-3 py-3"
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
            className={
              selected
                ? 'rounded-full border border-rhyme-yellow bg-rhyme-yellow/20 px-4 py-2 text-sm font-bold text-rhyme-yellow'
                : 'rounded-full bg-white/5 px-4 py-2 text-sm text-white/40 hover:bg-white/10'
            }
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Run full test suite**

```
npm test
```
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/DifficultyPicker.tsx components/RhymeSchemePicker.tsx
git commit -m "feat: add DifficultyPicker and RhymeSchemePicker components"
```

---

### Task 7: Wire through `components/Setup.tsx` and `components/Game.tsx`

**Files:**
- Modify: `components/Setup.tsx`
- Modify: `components/Game.tsx`

- [ ] **Step 1: Replace `components/Setup.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BEATS, pickBeat, type Beat } from '@/lib/beats';
import { LANGUAGES, type LanguageId } from '@/lib/languages';
import { DIFFICULTIES, DEFAULT_DIFFICULTY, type DifficultyId } from '@/lib/difficulties';
import { RHYME_SCHEMES, DEFAULT_SCHEME, type RhymeSchemeId } from '@/lib/rhyme-schemes';
import { loadLanguage, saveLanguage } from '@/lib/language-storage';
import { isYouTubeUrl } from '@/lib/yt-beat';
import Link from 'next/link';
import { BrowseBeats } from './BrowseBeats';
import { LanguagePicker } from './LanguagePicker';
import { DifficultyPicker } from './DifficultyPicker';
import { RhymeSchemePicker } from './RhymeSchemePicker';

type YtState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; beat: Beat; bpmFallback?: boolean }
  | { status: 'error'; message: string };

type Props = {
  initialBeatId: string | null;
  initialYtBeat?: Beat;
  initialLanguageId: LanguageId;
  onPlay: (beat: Beat, languageId: LanguageId, difficultyId: DifficultyId, schemeId: RhymeSchemeId) => void;
  onLogout: () => void;
};

export function Setup({ initialBeatId, initialYtBeat, initialLanguageId, onPlay, onLogout }: Props) {
  const [beatId, setBeatId] = useState<string | null>(
    initialYtBeat ? null : (initialBeatId ?? BEATS[0]?.id ?? null)
  );
  const [languageId, setLanguageId] = useState<LanguageId>(initialLanguageId);
  const [difficultyId, setDifficultyId] = useState<DifficultyId>(DEFAULT_DIFFICULTY);
  const [schemeId, setSchemeId] = useState<RhymeSchemeId>(DEFAULT_SCHEME);
  const [ytUrl, setYtUrl] = useState('');
  const [ytState, setYtState] = useState<YtState>(
    initialYtBeat ? { status: 'loaded', beat: initialYtBeat } : { status: 'idle' }
  );
  const [ytBeats, setYtBeats] = useState<Beat[]>([]);
  const [browseOpen, setBrowseOpen] = useState(false);
  const browseButtonRef = useRef<HTMLButtonElement>(null);

  const fetchCatalog = useCallback(() => {
    fetch('/beats/yt-catalog.json')
      .then(r => r.ok ? r.json() : [])
      .then((data: Beat[]) => setYtBeats(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const resolved = loadLanguage();
    if (resolved !== languageId) setLanguageId(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  function chooseLanguage(id: LanguageId) {
    setLanguageId(id);
    saveLanguage(id);
  }

  function chooseBeat(id: string | null) {
    setBeatId(id);
    setYtUrl('');
    setYtState({ status: 'idle' });
  }

  async function loadYtBeat() {
    setYtState({ status: 'loading' });
    try {
      const res = await fetch('/api/yt-beat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: ytUrl }),
      });
      const json = await res.json();
      if (!res.ok) {
        const message =
          json.error === 'ytdlp-not-found' ? 'yt-dlp is not installed on this server' :
          json.error === 'invalid-url'      ? 'Not a valid YouTube URL' :
          json.error === 'download-failed'  ? `Download failed: ${json.detail ?? ''}` :
          'Failed to load beat';
        setYtState({ status: 'error', message });
        return;
      }
      const beat: Beat = {
        id: json.id,
        src: json.src,
        title: json.title,
        bpm: json.bpm,
        barsPerLoop: json.barsPerLoop,
        category: json.category ?? 'other',
        ...(json.source === 'youtube' && { source: 'youtube' as const }),
      };
      setBeatId(null);
      setYtState({ status: 'loaded', beat, bpmFallback: json.bpmFallback });
      fetchCatalog();
    } catch {
      setYtState({ status: 'error', message: 'Network error' });
    }
  }

  const allBeats = [...BEATS, ...ytBeats];

  const selectedBundled: Beat | null =
    beatId ? (pickBeat(beatId) ?? allBeats.find(b => b.id === beatId) ?? null) : null;

  const activeBeat: Beat | null =
    ytState.status === 'loaded' ? ytState.beat : selectedBundled;

  const canLoad = ytState.status !== 'loading' && isYouTubeUrl(ytUrl);
  const canPlay = activeBeat !== null;

  return (
    <main className="flex min-h-screen flex-col p-6">
      <div className="flex justify-end">
        <button onClick={onLogout} className="text-white/60 hover:text-white">Log out</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <h1 className="text-4xl font-extrabold">The Rhyme Game</h1>
        <button
          onClick={() => activeBeat && onPlay(activeBeat, languageId, difficultyId, schemeId)}
          disabled={!canPlay}
          className="rounded-2xl bg-rhyme-yellow px-12 py-5 text-3xl font-extrabold text-bg disabled:opacity-50"
        >
          PLAY
        </button>
        <div className="w-full max-w-sm space-y-3">
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

          <div className="space-y-1">
            {ytState.status === 'loaded' ? (
              <div className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-sm">
                <span className="truncate">
                  {ytState.beat.title} · {ytState.beat.bpm} BPM
                  {ytState.bpmFallback && ' (BPM ~90, auto-detect failed)'}
                </span>
                <button
                  onClick={() => { setYtUrl(''); setYtState({ status: 'idle' }); }}
                  className="ml-2 shrink-0 text-white/60 hover:text-white"
                  aria-label="Clear YouTube beat"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="YouTube URL"
                  value={ytUrl}
                  disabled={ytState.status === 'loading'}
                  onChange={e => {
                    setYtUrl(e.target.value);
                    setYtState({ status: 'idle' });
                  }}
                  className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm placeholder:text-white/40 outline-none disabled:opacity-40"
                />
                <button
                  onClick={loadYtBeat}
                  disabled={!canLoad}
                  className="rounded-xl bg-white/20 px-3 py-2 text-sm disabled:opacity-40"
                >
                  {ytState.status === 'loading' ? '…' : 'Load'}
                </button>
              </div>
            )}
            {ytState.status === 'error' && (
              <p className="text-xs text-red-400">{ytState.message}</p>
            )}
          </div>

          <Link
            href="/yt"
            className="block text-center text-xs text-white/50 hover:text-white/80 underline"
          >
            Try YouTube mode →
          </Link>

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
      </div>
      {browseOpen && (
        <BrowseBeats
          beats={allBeats}
          selectedId={beatId}
          onChange={(id) => { chooseBeat(id); }}
          onClose={() => { setBrowseOpen(false); browseButtonRef.current?.focus(); }}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Replace `components/Game.tsx`**

```tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BEATS } from '@/lib/beats';
import type { Beat } from '@/lib/beats';
import type { Bar } from '@/lib/flatten-bars';
import { flattenBars } from '@/lib/flatten-bars';
import { DEFAULT_LANGUAGE, type LanguageId } from '@/lib/languages';
import { DEFAULT_DIFFICULTY, type DifficultyId } from '@/lib/difficulties';
import { DEFAULT_SCHEME, getRhymeScheme, type RhymeSchemeId } from '@/lib/rhyme-schemes';
import { sampleGroups } from '@/lib/rhymes';
import type { RhymeGroup } from '@/lib/fallback-groups';
import { useBeat } from '@/hooks/useBeat';
import { useGameLoop } from '@/hooks/useGameLoop';
import { addRecentBeat } from '@/lib/recent-beats';
import { Setup } from './Setup';
import { WordGrid } from './WordGrid';
import { BouncingBall } from './BouncingBall';
import { EndScreen } from './EndScreen';

const MAX_EXCLUDED_WORDS = 60;
const MAX_EXCLUDED_ENDINGS = 20;

type Phase = 'setup' | 'loading' | 'playing' | 'ended';

export function Game() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('setup');
  const [activeBeat, setActiveBeat] = useState<Beat | null>(BEATS[0] ?? null);
  const [languageId, setLanguageId] = useState<LanguageId>(DEFAULT_LANGUAGE);
  const [difficultyId, setDifficultyId] = useState<DifficultyId>(DEFAULT_DIFFICULTY);
  const [schemeId, setSchemeId] = useState<RhymeSchemeId>(DEFAULT_SCHEME);
  const [bars, setBars] = useState<Bar[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const usedWordsRef = useRef<string[]>([]);
  const usedEndingsRef = useRef<string[]>([]);

  const beatHandle = useBeat(activeBeat ?? undefined);

  const tick = useGameLoop({
    audio: phase === 'playing' ? beatHandle.audio : null,
    bpm: activeBeat?.bpm ?? 90,
    totalBars: bars.length,
    active: phase === 'playing',
    startOffset: activeBeat?.startOffset ?? 0,
    onEnd: () => {
      beatHandle.stop();
      setPhase('ended');
    },
  });

  useEffect(() => {
    if (phase !== 'loading' || !activeBeat) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/rhymes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            language: languageId,
            difficultyId,
            schemeId,
            exclude: {
              words: usedWordsRef.current,
              endings: usedEndingsRef.current,
            },
          }),
        });
        if (!res.ok) throw new Error('rhymes-failed');
        const json = await res.json();
        if (cancelled) return;

        const scheme = getRhymeScheme(schemeId);
        const allGroups: RhymeGroup[] = json.groups ?? [];
        const picked = sampleGroups(allGroups, scheme.groupCount);
        const newBars = flattenBars(picked, scheme);

        const roundWords = picked.flatMap(g => g.words);
        const roundEndings = picked.map(g => g.ending);
        usedWordsRef.current = [
          ...usedWordsRef.current,
          ...roundWords,
        ].slice(-MAX_EXCLUDED_WORDS);
        usedEndingsRef.current = [
          ...usedEndingsRef.current,
          ...roundEndings,
        ].slice(-MAX_EXCLUDED_ENDINGS);

        setBars(newBars);
        try {
          await beatHandle.play();
        } catch {
          throw new Error('audio-failed');
        }
        if (cancelled) return;
        setPhase('playing');
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error && err.message === 'audio-failed'
              ? "Couldn't play beat"
              : "Couldn't load rhymes"
          );
          setPhase('setup');
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  function handlePlay(beat: Beat, lang: LanguageId, difficulty: DifficultyId, scheme: RhymeSchemeId) {
    addRecentBeat(beat.id);
    setActiveBeat(beat);
    setLanguageId(lang);
    setDifficultyId(difficulty);
    setSchemeId(scheme);
    setLoadError(null);
    setPhase('loading');
  }

  function quitToSetup() {
    beatHandle.stop();
    setPhase('setup');
  }

  if (phase === 'setup') {
    const isYtBeat = activeBeat !== null && !BEATS.some(b => b.id === activeBeat.id);
    return (
      <>
        {loadError && (
          <div className="bg-rhyme-red/30 text-center py-2">{loadError}</div>
        )}
        <Setup
          initialBeatId={isYtBeat ? null : (activeBeat?.id ?? null)}
          initialYtBeat={isYtBeat ? activeBeat : undefined}
          initialLanguageId={languageId}
          onPlay={handlePlay}
          onLogout={logout}
        />
      </>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-xl">
        Loading…
      </div>
    );
  }

  if (phase === 'ended') {
    return (
      <EndScreen
        onPlayAgain={() => setPhase('loading')}
        onChangeBeat={() => setPhase('setup')}
      />
    );
  }

  return (
    <main className="min-h-screen p-4 flex flex-col">
      <div className="flex justify-between mb-2">
        <button onClick={() => {
          if (confirm('End session?')) quitToSetup();
        }} aria-label="Quit" className="text-white/70 text-xl">←</button>
        <div className="text-white/60 text-sm">
          {activeBeat?.title} · {activeBeat?.bpm.toFixed(1)} BPM
        </div>
      </div>
      <BouncingBall x={tick.ballX} yDip={tick.ballYDip} />
      <div className="mt-4 mx-auto w-full max-w-md">
        <WordGrid bars={bars} activeRow={tick.currentBar} ballX={tick.ballX} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Run full test suite**

```
npm test
```
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/Setup.tsx components/Game.tsx
git commit -m "feat: wire difficulty and scheme through Setup and Game"
```

---

## File Map

| File | Action |
|------|--------|
| `lib/difficulties.ts` | Create |
| `lib/rhyme-schemes.ts` | Create |
| `lib/difficulties.test.ts` | Create |
| `lib/rhyme-schemes.test.ts` | Create |
| `lib/languages.ts` | Modify — extend `promptTemplate` × 5 |
| `lib/rhymes.ts` | Modify — `FetchOpts`, `buildPrompt`, `fetchRhymeGroups` |
| `lib/rhymes.test.ts` | Modify — `buildPrompt` tests, remove `count` |
| `lib/flatten-bars.ts` | Modify — ABAB interleaving |
| `lib/flatten-bars.test.ts` | Modify — ABAB tests |
| `app/api/rhymes/route.ts` | Modify — parse `difficultyId` + `schemeId` |
| `components/DifficultyPicker.tsx` | Create |
| `components/RhymeSchemePicker.tsx` | Create |
| `components/Setup.tsx` | Modify — state + pickers + `onPlay` signature |
| `components/Game.tsx` | Modify — `handlePlay` + scheme-aware `flattenBars` call |

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| `lib/difficulties.ts` + `getDifficulty` fallback | 1 |
| `lib/rhyme-schemes.ts` + `getRhymeScheme` fallback | 1 |
| Extend `promptTemplate` × 5 (dynamic vocab + group-size lines) | 2 |
| `FetchOpts`: remove `count`, add `difficultyId`/`schemeId` | 3 |
| Extract + export `buildPrompt` | 3 |
| `buildTool` tightens schema when `wordsPerGroup` is a number | 3 |
| `fetchRhymeGroups` resolves difficulty + scheme | 3 |
| Route parses `difficultyId` + `schemeId` | 5 |
| `flattenBars` gains `scheme?` param | 4 |
| ABAB interleaving (zip, per-pair colors, odd-count fallback) | 4 |
| `DifficultyPicker` + `RhymeSchemePicker` components | 6 |
| Setup: two new `useState` calls (no localStorage), pickers added | 7 |
| `onPlay` carries `difficultyId` + `schemeId` | 7 |
| Game stores + forwards both to API | 7 |
| Game passes scheme to `flattenBars` | 7 |
| Game uses `scheme.groupCount` for `sampleGroups` (not hardcoded 10) | 7 |
| `app/page.tsx` unchanged | ✓ (Game owns all state) |
| Fallback groups unchanged | ✓ (`fetchRhymeGroups` fallback path untouched) |

**Placeholder scan:** None found.

**Type consistency:** All types flow consistently: `DifficultyId`/`RhymeSchemeId` defined in Task 1, used across Tasks 3–7. `flattenBars(groups, scheme?)` defined in Task 4 matches all call sites in Task 7. `onPlay(beat, lang, difficultyId, schemeId)` defined and consumed within Task 7.
