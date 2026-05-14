# Rhyme Game — Language Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 5-language picker (Ukrainian / English / Spanish / German / Polish) to The Rhyme Game so the AI generates rhymes in the player's chosen language, with the UI shell translated once to English.

**Architecture:** A single source-of-truth `lib/languages.ts` module owns the supported-language list, prompt templates, and a `getLanguage(id)` resolver that hands back a guaranteed `Language` for any input. `lib/fallback-groups.ts` becomes a per-language record. `lib/rhymes.ts` and the `/api/rhymes` route are parameterized by language. The Setup screen gains a `LanguagePicker` with localStorage persistence; the choice flows through `Game` into the API call. Everything else in the UI is translated to English in a one-time pass.

**Tech Stack:** Next.js 14 (app router), TypeScript, React 18, Tailwind, Anthropic SDK, Vitest. Test command: `npm test`. Path alias: `@/` → repo root.

**Reference spec:** [docs/superpowers/specs/2026-05-14-rhyme-game-language-picker-design.md](../specs/2026-05-14-rhyme-game-language-picker-design.md)

---

## Task 1: Languages module — types, prompts, resolver

**Files:**
- Create: `lib/languages.ts`
- Test: `lib/languages.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/languages.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { LANGUAGES, DEFAULT_LANGUAGE, getLanguage, type LanguageId } from './languages';

const EXPECTED_IDS: LanguageId[] = ['uk', 'en', 'es', 'de', 'pl'];

describe('LANGUAGES', () => {
  it('contains all five supported languages in a stable order', () => {
    expect(LANGUAGES.map(l => l.id)).toEqual(EXPECTED_IDS);
  });

  it('each entry has a non-empty native label and a prompt template', () => {
    for (const l of LANGUAGES) {
      expect(l.label.length).toBeGreaterThan(0);
      expect(typeof l.promptTemplate).toBe('function');
      const prompt = l.promptTemplate(7);
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toContain('7');
    }
  });
});

describe('DEFAULT_LANGUAGE', () => {
  it('is uk', () => {
    expect(DEFAULT_LANGUAGE).toBe('uk');
  });
});

describe('getLanguage', () => {
  it('returns the matching language for a known id', () => {
    expect(getLanguage('en').id).toBe('en');
    expect(getLanguage('pl').id).toBe('pl');
  });

  it('falls back to uk for null, undefined, empty, or unknown ids', () => {
    expect(getLanguage(null).id).toBe('uk');
    expect(getLanguage(undefined).id).toBe('uk');
    expect(getLanguage('').id).toBe('uk');
    expect(getLanguage('ru').id).toBe('uk');
    expect(getLanguage('xx-YY').id).toBe('uk');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- lib/languages.test.ts`
Expected: FAIL (module does not exist yet)

- [ ] **Step 3: Implement `lib/languages.ts`**

Create `lib/languages.ts`:

```ts
export type LanguageId = 'uk' | 'en' | 'es' | 'de' | 'pl';

export type Language = {
  id: LanguageId;
  label: string;
  promptTemplate: (count: number) => string;
};

function joinLines(lines: string[]): string {
  return lines.join(' ');
}

export const LANGUAGES: readonly Language[] = [
  {
    id: 'uk',
    label: 'Українська',
    promptTemplate: (count) => joinLines([
      `Згенеруй ${count} груп поширених українських слів, які римуються між собою.`,
      'Кожна група повинна мати спільне закінчення (від наголошеного голосного до кінця слова).',
      'У кожній групі — 3–4 слова. Уникай рідкісних, архаїчних або вульгарних слів.',
      'Перевага — простим іменникам, дієсловам та прикметникам, які впізнає підліток або початківець.',
      'Виведи результат через інструмент rhyme_groups.',
    ]),
  },
  {
    id: 'en',
    label: 'English',
    promptTemplate: (count) => joinLines([
      `Generate ${count} groups of common English words that rhyme.`,
      'Each group must share an ending (from the stressed vowel to the end of the word).',
      '3–4 words per group. Avoid rare, archaic, or vulgar words.',
      'Prefer simple nouns, verbs, and adjectives recognizable to a teenager or beginner.',
      'Return the result via the rhyme_groups tool.',
    ]),
  },
  {
    id: 'es',
    label: 'Español',
    promptTemplate: (count) => joinLines([
      `Genera ${count} grupos de palabras españolas comunes que rimen entre sí.`,
      'Cada grupo debe compartir una terminación (desde la vocal tónica hasta el final de la palabra).',
      '3–4 palabras por grupo. Evita palabras raras, arcaicas o vulgares.',
      'Prefiere sustantivos, verbos y adjetivos simples reconocibles para un adolescente o principiante.',
      'Devuelve el resultado a través de la herramienta rhyme_groups.',
    ]),
  },
  {
    id: 'de',
    label: 'Deutsch',
    promptTemplate: (count) => joinLines([
      `Generiere ${count} Gruppen häufiger deutscher Wörter, die sich reimen.`,
      'Jede Gruppe muss eine gemeinsame Endung haben (vom betonten Vokal bis zum Wortende).',
      '3–4 Wörter pro Gruppe. Vermeide seltene, archaische oder vulgäre Wörter.',
      'Bevorzuge einfache Substantive, Verben und Adjektive, die ein Jugendlicher oder Anfänger erkennt.',
      'Gib das Ergebnis über das Tool rhyme_groups zurück.',
    ]),
  },
  {
    id: 'pl',
    label: 'Polski',
    promptTemplate: (count) => joinLines([
      `Wygeneruj ${count} grup popularnych polskich słów, które się rymują.`,
      'Każda grupa musi mieć wspólne zakończenie (od akcentowanej samogłoski do końca słowa).',
      '3–4 słowa w grupie. Unikaj rzadkich, archaicznych lub wulgarnych słów.',
      'Preferuj proste rzeczowniki, czasowniki i przymiotniki rozpoznawalne dla nastolatka lub początkującego.',
      'Zwróć wynik za pomocą narzędzia rhyme_groups.',
    ]),
  },
];

export const DEFAULT_LANGUAGE: LanguageId = 'uk';

const BY_ID: Record<LanguageId, Language> = LANGUAGES.reduce(
  (acc, lang) => {
    acc[lang.id] = lang;
    return acc;
  },
  {} as Record<LanguageId, Language>
);

export function getLanguage(id: string | null | undefined): Language {
  if (id && id in BY_ID) return BY_ID[id as LanguageId];
  return BY_ID[DEFAULT_LANGUAGE];
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- lib/languages.test.ts`
Expected: PASS (all four describe blocks green)

- [ ] **Step 5: Commit**

```bash
git add lib/languages.ts lib/languages.test.ts
git commit -m "feat(lang): add language module with prompt templates and getLanguage resolver"
```

---

## Task 2: Per-language fallback groups

**Files:**
- Modify: `lib/fallback-groups.ts`
- Modify: `lib/languages.test.ts` (extend)

- [ ] **Step 1: Extend the failing test**

Append to `lib/languages.test.ts`:

```ts
import { FALLBACK_GROUPS_BY_LANGUAGE } from './fallback-groups';

describe('FALLBACK_GROUPS_BY_LANGUAGE', () => {
  it('has an entry for every supported language', () => {
    for (const id of EXPECTED_IDS) {
      expect(FALLBACK_GROUPS_BY_LANGUAGE[id]).toBeDefined();
    }
  });

  it('each language has at least 10 fallback groups', () => {
    for (const id of EXPECTED_IDS) {
      expect(FALLBACK_GROUPS_BY_LANGUAGE[id].length).toBeGreaterThanOrEqual(10);
    }
  });

  it('every group has a non-empty ending and at least 2 words', () => {
    for (const id of EXPECTED_IDS) {
      for (const group of FALLBACK_GROUPS_BY_LANGUAGE[id]) {
        expect(group.ending.length).toBeGreaterThan(0);
        expect(group.words.length).toBeGreaterThanOrEqual(2);
        for (const word of group.words) {
          expect(typeof word).toBe('string');
          expect(word.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- lib/languages.test.ts`
Expected: FAIL (`FALLBACK_GROUPS_BY_LANGUAGE` not exported; current export is `FALLBACK_GROUPS`)

- [ ] **Step 3: Refactor `lib/fallback-groups.ts`**

Replace the entire contents of `lib/fallback-groups.ts` with:

```ts
import type { LanguageId } from './languages';

export type RhymeGroup = { ending: string; words: string[] };

export const FALLBACK_GROUPS_BY_LANGUAGE: Record<LanguageId, RhymeGroup[]> = {
  uk: [
    { ending: '-іт',   words: ['кіт', 'щит', 'піт', 'цвіт'] },
    { ending: '-ата',  words: ['хата', 'лата', 'вата', 'плата'] },
    { ending: '-ить',  words: ['летить', 'горить', 'болить', 'кричить'] },
    { ending: '-ова',  words: ['нова', 'голова', 'основа', 'розмова'] },
    { ending: '-ина',  words: ['калина', 'малина', 'людина', 'хвилина'] },
    { ending: '-ого',  words: ['нового', 'білого', 'чужого', 'малого'] },
    { ending: '-ало',  words: ['мало', 'стало', 'сказало', 'пропало'] },
    { ending: '-ення', words: ['рішення', 'значення', 'натхнення', 'зіткнення'] },
    { ending: '-уть',  words: ['ідуть', 'несуть', 'кують', 'пасуть'] },
    { ending: '-іти',  words: ['летіти', 'горіти', 'жаліти', 'хотіти'] },
    { ending: '-ість', words: ['радість', 'свіжість', 'юність', 'ніжність'] },
    { ending: '-іра',  words: ['віра', 'міра', 'ліра', 'жара'] },
  ],
  en: [
    { ending: '-ay',    words: ['day', 'way', 'play', 'say'] },
    { ending: '-ight',  words: ['light', 'night', 'sight', 'right'] },
    { ending: '-ake',   words: ['cake', 'lake', 'take', 'make'] },
    { ending: '-ime',   words: ['time', 'lime', 'climb', 'dime'] },
    { ending: '-ow',    words: ['low', 'slow', 'grow', 'show'] },
    { ending: '-and',   words: ['hand', 'sand', 'land', 'stand'] },
    { ending: '-ing',   words: ['sing', 'ring', 'king', 'thing'] },
    { ending: '-all',   words: ['ball', 'call', 'fall', 'wall'] },
    { ending: '-ear',   words: ['year', 'near', 'clear', 'hear'] },
    { ending: '-ind',   words: ['mind', 'kind', 'find', 'blind'] },
  ],
  es: [
    { ending: '-ar',    words: ['mar', 'hablar', 'andar', 'lugar'] },
    { ending: '-or',    words: ['amor', 'calor', 'dolor', 'color'] },
    { ending: '-ana',   words: ['mañana', 'ventana', 'manzana', 'hermana'] },
    { ending: '-ado',   words: ['estado', 'soldado', 'mercado', 'helado'] },
    { ending: '-er',    words: ['comer', 'beber', 'ver', 'leer'] },
    { ending: '-ente',  words: ['gente', 'mente', 'siguiente', 'presente'] },
    { ending: '-ida',   words: ['vida', 'salida', 'comida', 'herida'] },
    { ending: '-illa',  words: ['silla', 'mejilla', 'orilla', 'semilla'] },
    { ending: '-aje',   words: ['viaje', 'paisaje', 'mensaje', 'pasaje'] },
    { ending: '-ón',    words: ['razón', 'canción', 'corazón', 'balcón'] },
  ],
  de: [
    { ending: '-icht',  words: ['Licht', 'Pflicht', 'Sicht', 'Gesicht'] },
    { ending: '-aus',   words: ['Haus', 'Maus', 'raus', 'aus'] },
    { ending: '-ein',   words: ['mein', 'sein', 'klein', 'allein'] },
    { ending: '-and',   words: ['Hand', 'Sand', 'Land', 'Stand'] },
    { ending: '-acht',  words: ['Nacht', 'Macht', 'acht', 'lacht'] },
    { ending: '-eit',   words: ['Zeit', 'Streit', 'weit', 'breit'] },
    { ending: '-eer',   words: ['Meer', 'mehr', 'leer', 'sehr'] },
    { ending: '-ang',   words: ['lang', 'sang', 'klang', 'sprang'] },
    { ending: '-ehen',  words: ['gehen', 'sehen', 'stehen', 'drehen'] },
    { ending: '-ank',   words: ['Bank', 'Dank', 'krank', 'blank'] },
  ],
  pl: [
    { ending: '-oga',   words: ['noga', 'droga', 'podłoga', 'trwoga'] },
    { ending: '-ota',   words: ['robota', 'ochota', 'prostota', 'brzydota'] },
    { ending: '-ada',   words: ['rada', 'lada', 'narada', 'gromada'] },
    { ending: '-ana',   words: ['ściana', 'rana', 'polana', 'słomiana'] },
    { ending: '-ość',   words: ['miłość', 'radość', 'młodość', 'czystość'] },
    { ending: '-anie',  words: ['kochanie', 'spotkanie', 'śpiewanie', 'czytanie'] },
    { ending: '-ić',    words: ['pić', 'bić', 'śnić', 'mówić'] },
    { ending: '-ina',   words: ['godzina', 'malina', 'kalina', 'drabina'] },
    { ending: '-aj',    words: ['zwyczaj', 'kraj', 'raj', 'daj'] },
    { ending: '-ucha',  words: ['mucha', 'ucha', 'ducha', 'słucha'] },
  ],
};
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- lib/languages.test.ts`
Expected: PASS (all three new describe blocks green)

- [ ] **Step 5: Verify the rest of the suite still compiles (will fail)**

Run: `npm test`
Expected: `lib/rhymes.test.ts` and `lib/rhymes.ts` fail to compile — `FALLBACK_GROUPS` no longer exists. This is expected; Task 3 fixes it. Move on.

- [ ] **Step 6: Commit**

```bash
git add lib/fallback-groups.ts lib/languages.test.ts
git commit -m "feat(lang): refactor fallback groups to per-language record with EN/ES/DE/PL"
```

---

## Task 3: Parameterize `lib/rhymes.ts` by language

**Files:**
- Modify: `lib/rhymes.ts`
- Modify: `lib/rhymes.test.ts`

- [ ] **Step 1: Rewrite `lib/rhymes.test.ts`**

Replace the entire contents of `lib/rhymes.test.ts` with:

```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchRhymeGroups } from './rhymes';
import { FALLBACK_GROUPS_BY_LANGUAGE } from './fallback-groups';

type Behavior = 'good' | 'malformed' | 'throws' | 'empty';

function mockClient(behavior: Behavior) {
  const create = vi.fn(async () => {
    if (behavior === 'throws') throw new Error('network down');
    if (behavior === 'malformed') {
      return { content: [{ type: 'text', text: 'not json' }] };
    }
    if (behavior === 'empty') {
      return {
        content: [
          { type: 'tool_use', name: 'rhyme_groups', input: { groups: [] } },
        ],
      };
    }
    return {
      content: [
        {
          type: 'tool_use',
          name: 'rhyme_groups',
          input: {
            groups: [
              { ending: '-іт', words: ['кіт', 'літ', 'піт'] },
              { ending: '-ата', words: ['хата', 'лата'] },
            ],
          },
        },
      ],
    };
  });
  return { messages: { create } } as any;
}

describe('fetchRhymeGroups', () => {
  it('returns groups from a successful tool-use response', async () => {
    const client = mockClient('good');
    const groups = await fetchRhymeGroups({ count: 2, client, language: 'uk' });
    expect(groups).toEqual([
      { ending: '-іт', words: ['кіт', 'літ', 'піт'] },
      { ending: '-ата', words: ['хата', 'лата'] },
    ]);
  });

  it("uses the requested language's prompt template", async () => {
    const client = mockClient('good');
    await fetchRhymeGroups({ count: 3, client, language: 'en' });
    const call = client.messages.create.mock.calls[0][0];
    const userMessage = call.messages[0].content;
    expect(userMessage).toContain('English');
    expect(userMessage).toContain('3');
  });

  it("interpolates the language label into the tool description", async () => {
    const client = mockClient('good');
    await fetchRhymeGroups({ count: 1, client, language: 'es' });
    const call = client.messages.create.mock.calls[0][0];
    expect(call.tools[0].description).toContain('Español');
  });

  it('falls back to the requested language groups when the API throws', async () => {
    const groups = await fetchRhymeGroups({
      count: 2,
      client: mockClient('throws'),
      language: 'de',
    });
    expect(groups).toEqual(FALLBACK_GROUPS_BY_LANGUAGE.de);
  });

  it('falls back when no tool-use block is returned', async () => {
    const groups = await fetchRhymeGroups({
      count: 2,
      client: mockClient('malformed'),
      language: 'pl',
    });
    expect(groups).toEqual(FALLBACK_GROUPS_BY_LANGUAGE.pl);
  });

  it('falls back when groups array is empty', async () => {
    const groups = await fetchRhymeGroups({
      count: 2,
      client: mockClient('empty'),
      language: 'en',
    });
    expect(groups).toEqual(FALLBACK_GROUPS_BY_LANGUAGE.en);
  });

  it('falls back to uk when no client is provided', async () => {
    const groups = await fetchRhymeGroups({ count: 2, language: 'es' });
    expect(groups).toEqual(FALLBACK_GROUPS_BY_LANGUAGE.es);
  });

  it('defaults to uk when language is missing or unknown', async () => {
    const groups = await fetchRhymeGroups({ count: 2 });
    expect(groups).toEqual(FALLBACK_GROUPS_BY_LANGUAGE.uk);

    const groups2 = await fetchRhymeGroups({ count: 2, language: 'ru' as any });
    expect(groups2).toEqual(FALLBACK_GROUPS_BY_LANGUAGE.uk);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npm test -- lib/rhymes.test.ts`
Expected: FAIL (signature mismatch / missing exports — `language` option not yet implemented)

- [ ] **Step 3: Rewrite `lib/rhymes.ts`**

Replace the entire contents of `lib/rhymes.ts` with:

```ts
import type Anthropic from '@anthropic-ai/sdk';
import { FALLBACK_GROUPS_BY_LANGUAGE, type RhymeGroup } from './fallback-groups';
import { getLanguage, type Language, type LanguageId } from './languages';

const TOOL_NAME = 'rhyme_groups';

function buildTool(lang: Language) {
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
              words: {
                type: 'array',
                items: { type: 'string' },
                minItems: 2,
                maxItems: 5,
              },
            },
            required: ['ending', 'words'],
          },
        },
      },
      required: ['groups'],
    },
  };
}

export type FetchOpts = {
  count?: number;
  client?: Pick<Anthropic, 'messages'>;
  language?: LanguageId;
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

export async function fetchRhymeGroups(opts: FetchOpts = {}): Promise<RhymeGroup[]> {
  const count = opts.count ?? 10;
  const lang = getLanguage(opts.language);
  const fallback = FALLBACK_GROUPS_BY_LANGUAGE[lang.id];
  const client = opts.client;
  if (!client) return fallback;
  try {
    const tool = buildTool(lang);
    const response: any = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      tools: [tool],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{ role: 'user', content: lang.promptTemplate(count) }],
    });
    const parsed = parseGroups(response?.content);
    return parsed ?? fallback;
  } catch (err) {
    console.error('[rhymes] fetch failed, using fallback', err);
    return fallback;
  }
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npm test -- lib/rhymes.test.ts`
Expected: PASS (all 8 cases green)

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS (both `languages.test.ts` and `rhymes.test.ts` green; other suites unaffected)

- [ ] **Step 6: Commit**

```bash
git add lib/rhymes.ts lib/rhymes.test.ts
git commit -m "feat(lang): parameterize rhyme generation by language with per-call tool builder"
```

---

## Task 4: API route accepts language

**Files:**
- Modify: `app/api/rhymes/route.ts`

This route has no existing unit test (it's an integration endpoint). The change is small and validated by Task 9's smoke test. No new test in this task.

- [ ] **Step 1: Rewrite `app/api/rhymes/route.ts`**

Replace the entire contents of `app/api/rhymes/route.ts` with:

```ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { fetchRhymeGroups } from '@/lib/rhymes';
import { flattenBars } from '@/lib/flatten-bars';
import { getLanguage } from '@/lib/languages';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  let rawLanguage: string | null = null;
  try {
    const body = await request.json();
    if (body && typeof body.language === 'string') {
      rawLanguage = body.language;
    }
  } catch {
    // No body or malformed JSON — fall through to default language.
  }
  const lang = getLanguage(rawLanguage);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[rhymes] ANTHROPIC_API_KEY not set — using fallback groups');
  }
  const client = apiKey ? new Anthropic({ apiKey }) : undefined;
  const groups = await fetchRhymeGroups({ count: 10, client, language: lang.id });
  const bars = flattenBars(groups);
  return NextResponse.json({ groups, bars });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (or, if pre-existing errors are present, no *new* errors in `app/api/rhymes/route.ts`).

- [ ] **Step 3: Run the test suite**

Run: `npm test`
Expected: PASS (route is untested; suite reflects lib-layer correctness).

- [ ] **Step 4: Commit**

```bash
git add app/api/rhymes/route.ts
git commit -m "feat(api): accept language in /api/rhymes request body"
```

---

## Task 5: Client-only language-storage module

**Files:**
- Create: `lib/language-storage.ts`
- Test: `lib/language-storage.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/language-storage.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadLanguage, saveLanguage } from './language-storage';

const STORAGE_KEY = 'rhyme-language';

function setupBrowser({ language, stored }: { language?: string; stored?: string | null } = {}) {
  const store = new Map<string, string>();
  if (stored !== undefined && stored !== null) store.set(STORAGE_KEY, stored);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  });
  vi.stubGlobal('navigator', { language: language ?? 'en-US' });
  return store;
}

describe('loadLanguage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the stored value when valid', () => {
    setupBrowser({ stored: 'es' });
    expect(loadLanguage()).toBe('es');
  });

  it('ignores an invalid stored value and sniffs navigator.language', () => {
    setupBrowser({ stored: 'ru', language: 'de-AT' });
    expect(loadLanguage()).toBe('de');
  });

  it('sniffs navigator.language when nothing is stored', () => {
    setupBrowser({ language: 'pl-PL' });
    expect(loadLanguage()).toBe('pl');
  });

  it('lowercases and prefix-matches navigator.language', () => {
    setupBrowser({ language: 'EN-GB' });
    expect(loadLanguage()).toBe('en');
  });

  it('defaults to uk when navigator.language is unsupported', () => {
    setupBrowser({ language: 'ja-JP' });
    expect(loadLanguage()).toBe('uk');
  });

  it('defaults to uk when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    vi.stubGlobal('navigator', undefined);
    expect(loadLanguage()).toBe('uk');
  });
});

describe('saveLanguage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes to localStorage', () => {
    const store = setupBrowser();
    saveLanguage('pl');
    expect(store.get(STORAGE_KEY)).toBe('pl');
  });

  it('silently no-ops when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => saveLanguage('en')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- lib/language-storage.test.ts`
Expected: FAIL (module does not exist)

- [ ] **Step 3: Implement `lib/language-storage.ts`**

Create `lib/language-storage.ts`:

```ts
import { DEFAULT_LANGUAGE, getLanguage, type LanguageId } from './languages';

const STORAGE_KEY = 'rhyme-language';

function readStorage(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function sniffNavigator(): string | null {
  try {
    if (typeof navigator === 'undefined') return null;
    const raw = navigator.language;
    if (typeof raw !== 'string' || raw.length === 0) return null;
    return raw.split('-')[0]!.toLowerCase();
  } catch {
    return null;
  }
}

export function loadLanguage(): LanguageId {
  const stored = readStorage();
  if (stored) {
    const fromStored = getLanguage(stored);
    if (fromStored.id === stored) return fromStored.id;
  }
  const sniffed = sniffNavigator();
  if (sniffed) {
    const fromSniff = getLanguage(sniffed);
    if (fromSniff.id === sniffed) return fromSniff.id;
  }
  return DEFAULT_LANGUAGE;
}

export function saveLanguage(id: LanguageId): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // best-effort; ignore
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- lib/language-storage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/language-storage.ts lib/language-storage.test.ts
git commit -m "feat(lang): add client-only localStorage + navigator language helpers"
```

---

## Task 6: Translate UI shell to English

This is a pure string-edit task. No new behavior, no new tests. After this task the app is functionally identical but English; the language picker comes in Task 7+.

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/login/page.tsx`
- Modify: `components/Setup.tsx`
- Modify: `components/Game.tsx`
- Modify: `components/EndScreen.tsx`
- Modify: `components/BeatPicker.tsx`

- [ ] **Step 1: Update `app/layout.tsx`**

Replace lines 11–18 with:

```tsx
export const metadata: Metadata = {
  title: 'The Rhyme Game',
  description: 'A web game for freestyle rap practice',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Update `app/login/page.tsx`**

Translate the four Ukrainian strings:

- `'Неправильний пароль'` → `'Wrong password'`
- `"Помилка з'єднання"` → `'Connection error'`
- `Римова Гра` (h1) → `The Rhyme Game`
- `Пароль` (label) → `Password`
- `Введіть пароль` (placeholder) → `Enter password`
- `Перевірка...` → `Checking…`
- `Увійти` → `Log in`

- [ ] **Step 3: Update `components/Setup.tsx`**

Translate these strings:

- `Вийти` (logout button) → `Log out`
- `Римова Гра` (h1) → `The Rhyme Game`
- `ГРАТИ` (play button) → `PLAY`

- [ ] **Step 4: Update `components/Game.tsx`**

Translate these strings:

- `'Не вдалося відтворити біт'` → `"Couldn't play beat"`
- `'Не вдалося завантажити рими'` → `"Couldn't load rhymes"`
- `Завантаження...` → `Loading…`
- `Завершити сесію?` → `End session?`
- `Завершити` (red button) → `End`
- `Продовжити` → `Continue`
- aria-label `Вийти` (back arrow) → `Quit`

- [ ] **Step 5: Update `components/EndScreen.tsx`**

Translate:

- `Гарна робота!` → `Nice work!`
- `Ти пройшов {barsPlayed} барів` → `You played {barsPlayed} bars`
- `Грати знову` → `Play again`
- `Інший біт` → `Change beat`

- [ ] **Step 6: Update `components/BeatPicker.tsx`**

Translate:

- `Біти ще не додано` → `No beats added yet`
- aria-label `Попередній біт` → `Previous beat`
- aria-label `Наступний біт` → `Next beat`

- [ ] **Step 7: Run the build to catch any typos**

Run: `npm run build`
Expected: success. If a missed brace or syntax error appears, fix it and rerun.

- [ ] **Step 8: Run the test suite**

Run: `npm test`
Expected: PASS (no behavior change).

- [ ] **Step 9: Commit**

```bash
git add app/layout.tsx app/login/page.tsx components/Setup.tsx components/Game.tsx components/EndScreen.tsx components/BeatPicker.tsx
git commit -m "feat(ui): translate UI shell to English"
```

---

## Task 7: `LanguagePicker` component

**Files:**
- Create: `components/LanguagePicker.tsx`

No unit test — the codebase has no existing component tests; visual behavior is covered by Task 10's smoke test.

- [ ] **Step 1: Create the component**

Create `components/LanguagePicker.tsx`:

```tsx
'use client';

import type { Language, LanguageId } from '@/lib/languages';

type Props = {
  languages: readonly Language[];
  selectedId: LanguageId;
  onChange: (id: LanguageId) => void;
};

export function LanguagePicker({ languages, selectedId, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Rhyme language"
      className="flex flex-wrap justify-center gap-2 rounded-2xl bg-white/5 px-3 py-3"
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
            className={
              selected
                ? 'rounded-full bg-rhyme-yellow px-4 py-2 text-sm font-bold text-bg'
                : 'rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/20'
            }
          >
            {lang.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/LanguagePicker.tsx
git commit -m "feat(ui): add LanguagePicker pill-row component"
```

---

## Task 8: Wire LanguagePicker into Setup with persistence

**Files:**
- Modify: `components/Setup.tsx`

- [ ] **Step 1: Rewrite `components/Setup.tsx`**

Replace the entire contents of `components/Setup.tsx` with:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { BEATS } from '@/lib/beats';
import { LANGUAGES, type LanguageId } from '@/lib/languages';
import { loadLanguage, saveLanguage } from '@/lib/language-storage';
import { BeatPicker } from './BeatPicker';
import { LanguagePicker } from './LanguagePicker';

type Props = {
  initialBeatId: string | null;
  initialLanguageId: LanguageId;
  onPlay: (beatId: string, languageId: LanguageId) => void;
  onLogout: () => void;
};

export function Setup({ initialBeatId, initialLanguageId, onPlay, onLogout }: Props) {
  const [beatId, setBeatId] = useState<string | null>(initialBeatId ?? BEATS[0]?.id ?? null);
  const [languageId, setLanguageId] = useState<LanguageId>(initialLanguageId);
  const canPlay = beatId !== null;

  // After mount, reconcile language from localStorage / navigator.language.
  // Done in useEffect (not a lazy state initializer) to avoid SSR/hydration mismatch.
  useEffect(() => {
    const resolved = loadLanguage();
    if (resolved !== languageId) setLanguageId(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function chooseLanguage(id: LanguageId) {
    setLanguageId(id);
    saveLanguage(id);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.code === 'Space' || e.code === 'Enter') && canPlay && beatId) {
        e.preventDefault();
        onPlay(beatId, languageId);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canPlay, beatId, languageId, onPlay]);

  return (
    <main className="flex min-h-screen flex-col p-6">
      <div className="flex justify-end">
        <button onClick={onLogout} className="text-white/60 hover:text-white">Log out</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <h1 className="text-4xl font-extrabold">The Rhyme Game</h1>
        <button
          onClick={() => beatId && onPlay(beatId, languageId)}
          disabled={!canPlay}
          className="rounded-2xl bg-rhyme-yellow px-12 py-5 text-3xl font-extrabold text-bg disabled:opacity-50"
        >
          PLAY
        </button>
        <div className="w-full max-w-sm space-y-3">
          <BeatPicker beats={BEATS} selectedId={beatId} onChange={setBeatId} />
          <LanguagePicker
            languages={LANGUAGES}
            selectedId={languageId}
            onChange={chooseLanguage}
          />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: errors in `components/Game.tsx` (the `Setup` props signature changed). These are expected — Task 9 updates `Game`.

- [ ] **Step 3: Commit**

```bash
git add components/Setup.tsx
git commit -m "feat(ui): add language picker to Setup with localStorage persistence"
```

---

## Task 9: Wire language through Game to the API

**Files:**
- Modify: `components/Game.tsx`

- [ ] **Step 1: Rewrite `components/Game.tsx`**

Replace the entire contents of `components/Game.tsx` with:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BEATS, pickBeat } from '@/lib/beats';
import type { Bar } from '@/lib/flatten-bars';
import { DEFAULT_LANGUAGE, type LanguageId } from '@/lib/languages';
import { useBeat } from '@/hooks/useBeat';
import { useGameLoop } from '@/hooks/useGameLoop';
import { Setup } from './Setup';
import { WordGrid } from './WordGrid';
import { BouncingBall } from './BouncingBall';
import { EndScreen } from './EndScreen';

type Phase = 'setup' | 'loading' | 'playing' | 'ended' | 'quit-confirm';

export function Game() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('setup');
  const [beatId, setBeatId] = useState<string | null>(BEATS[0]?.id ?? null);
  const [languageId, setLanguageId] = useState<LanguageId>(DEFAULT_LANGUAGE);
  const [bars, setBars] = useState<Bar[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const beat = pickBeat(beatId ?? undefined);
  const beatHandle = useBeat(beat);

  const tick = useGameLoop({
    audio: phase === 'playing' ? beatHandle.audio : null,
    bpm: beat?.bpm ?? 90,
    totalBars: bars.length,
    active: phase === 'playing',
    onEnd: () => {
      beatHandle.stop();
      setPhase('ended');
    },
  });

  useEffect(() => {
    if (phase !== 'loading' || !beat) return;
    let cancelled = false;
    (async () => {
      try {
        const [res] = await Promise.all([
          fetch('/api/rhymes', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ language: languageId }),
          }),
          beatHandle.preload(),
        ]);
        if (res.status === 401) { router.push('/login'); return; }
        if (!res.ok) throw new Error('rhymes-failed');
        const json = await res.json();
        if (cancelled) return;
        setBars(json.bars);
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

  function handlePlay(id: string, lang: LanguageId) {
    setBeatId(id);
    setLanguageId(lang);
    setLoadError(null);
    setPhase('loading');
  }

  function quitToSetup() {
    beatHandle.stop();
    setPhase('setup');
  }

  if (phase === 'setup') {
    return (
      <>
        {loadError && (
          <div className="bg-rhyme-red/30 text-center py-2">{loadError}</div>
        )}
        <Setup
          initialBeatId={beatId}
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
        barsPlayed={bars.length}
        onPlayAgain={() => setPhase('loading')}
        onChangeBeat={() => setPhase('setup')}
      />
    );
  }

  if (phase === 'quit-confirm') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
        <p className="text-2xl font-bold">End session?</p>
        <div className="flex gap-4">
          <button
            onClick={quitToSetup}
            className="rounded-2xl bg-rhyme-red px-8 py-4 text-xl font-bold"
          >
            End
          </button>
          <button
            onClick={() => setPhase('playing')}
            className="rounded-2xl bg-white/10 px-8 py-4 text-xl"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // playing
  return (
    <main className="min-h-screen p-4 flex flex-col">
      <div className="flex justify-between mb-2">
        <button
          onClick={() => setPhase('quit-confirm')}
          aria-label="Quit"
          className="text-white/70 text-xl"
        >←</button>
        <div className="text-white/60 text-sm">
          {beat?.title} · {beat ? (Number.isInteger(beat.bpm) ? beat.bpm : beat.bpm.toFixed(1)) : ''} BPM
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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/Game.tsx
git commit -m "feat(game): thread chosen language through to the rhymes API call"
```

---

## Task 10: Manual smoke test + final cleanup

This task verifies end-to-end behavior in a real browser. **Do not skip** — it's the only check on UI wiring.

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (in a separate terminal so you can keep working).
Open: `http://localhost:3000` (log in with the password from `.env.local`).

- [ ] **Step 2: Verify default-language behavior**

- The Setup screen shows the title "The Rhyme Game", a yellow "PLAY" button, a beat picker, and a language picker below it.
- The language picker shows five pills in order: `Українська`, `English`, `Español`, `Deutsch`, `Polski`.
- One pill is highlighted (yellow). The default reflects your browser language if supported, else `Українська`.

- [ ] **Step 3: Verify each language renders the right rhymes**

For each of the five pills:

1. Click the pill.
2. Click PLAY.
3. After loading, the bar grid renders ~10 bars of words in that language. Verify the words look right (Cyrillic for `uk`, Latin for `en` / `es` / `de` / `pl`; appropriate diacritics for the latter three).
4. Wait for the song to end OR click the back arrow → "End".
5. Return to Setup.

- [ ] **Step 4: Verify persistence**

- Pick `Polski`, refresh the page. The `Polski` pill should still be highlighted.
- Open DevTools → Application → Local Storage. Confirm `rhyme-language = "pl"`.

- [ ] **Step 5: Verify the API failure fallback**

- Temporarily set `ANTHROPIC_API_KEY=` (empty) in `.env.local`, restart `npm run dev`.
- Pick `English`, PLAY. The grid should still render — using the English fallback groups.
- Restore the original `ANTHROPIC_API_KEY` afterward.

- [ ] **Step 6: Stop the dev server, run the full suite once more**

Run: `npm test && npm run build`
Expected: both PASS.

- [ ] **Step 7: No commit needed (verification-only task)**

If you needed to tweak `.env.local`, leave that as a local-only change (it's gitignored).

---

## Out of scope (do not implement)

- README translation (Ukrainian README stays for now; separate PR later if desired).
- Per-language beat catalog (beats are language-agnostic and not affected).
- Diacritic / accent normalization of model output beyond what `parseGroups` already does.
- User-typed custom languages.
- Flag emojis on the picker (decided against during brainstorming).
