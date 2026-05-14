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
  const count = scheme.groupCount;
  const lang = getLanguage(opts.language);
  const fallback = FALLBACK_GROUPS_BY_LANGUAGE[lang.id];
  const client = opts.client;
  if (!client) return fallback;
  const theme = lang.themes[Math.floor(Math.random() * lang.themes.length)];
  try {
    const tool = buildTool(lang, scheme.wordsPerGroup);
    const prompt = buildPrompt(lang, count, theme, difficulty.promptHint, scheme.wordsPerGroup, opts.exclude);
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
