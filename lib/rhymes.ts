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
