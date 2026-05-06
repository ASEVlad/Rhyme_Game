import type Anthropic from '@anthropic-ai/sdk';
import { FALLBACK_GROUPS, type RhymeGroup } from './fallback-groups';

const TOOL_NAME = 'rhyme_groups';

const TOOL = {
  name: TOOL_NAME,
  description: 'Return groups of common Ukrainian words that rhyme.',
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

export type FetchOpts = {
  count?: number;
  client?: Pick<Anthropic, 'messages'>;
};

function buildPrompt(count: number): string {
  return [
    `Згенеруй ${count} груп поширених українських слів, які римуються між собою.`,
    'Кожна група повинна мати спільне закінчення (від наголошеного голосного до кінця слова).',
    'У кожній групі — 3–4 слова. Уникай рідкісних, архаїчних або вульгарних слів.',
    'Перевага — простим іменникам, дієсловам та прикметникам, які впізнає підліток або початківець.',
    'Виведи результат через інструмент rhyme_groups.',
  ].join(' ');
}

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
  const client = opts.client;
  if (!client) return FALLBACK_GROUPS;
  try {
    const response: any = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 2048,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{ role: 'user', content: buildPrompt(count) }],
    });
    const parsed = parseGroups(response?.content);
    return parsed ?? FALLBACK_GROUPS;
  } catch (err) {
    console.error('[rhymes] fetch failed, using fallback', err);
    return FALLBACK_GROUPS;
  }
}
