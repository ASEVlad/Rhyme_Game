import { describe, it, expect, vi } from 'vitest';
import { fetchRhymeGroups, sampleGroups } from './rhymes';
import { FALLBACK_GROUPS_BY_LANGUAGE } from './fallback-groups';
import type { RhymeGroup } from './fallback-groups';
import { getLanguage } from './languages';

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

  it('includes a theme word in the prompt', async () => {
    const client = mockClient('good');
    await fetchRhymeGroups({ count: 3, client, language: 'en' });
    const call = client.messages.create.mock.calls[0][0];
    const userMessage: string = call.messages[0].content;
    const themes = getLanguage('en').themes;
    expect(themes.some(t => userMessage.includes(t))).toBe(true);
  });

  it('sets temperature to 1', async () => {
    const client = mockClient('good');
    await fetchRhymeGroups({ count: 2, client, language: 'uk' });
    const call = client.messages.create.mock.calls[0][0];
    expect(call.temperature).toBe(1);
  });

  it('includes excluded words in the prompt', async () => {
    const client = mockClient('good');
    await fetchRhymeGroups({
      count: 2,
      client,
      language: 'uk',
      exclude: { words: ['кіт', 'хата'], endings: [] },
    });
    const call = client.messages.create.mock.calls[0][0];
    const msg: string = call.messages[0].content;
    expect(msg).toContain('кіт');
    expect(msg).toContain('хата');
  });

  it('includes excluded endings in the prompt', async () => {
    const client = mockClient('good');
    await fetchRhymeGroups({
      count: 2,
      client,
      language: 'en',
      exclude: { words: [], endings: ['-ay', '-ight'] },
    });
    const call = client.messages.create.mock.calls[0][0];
    const msg: string = call.messages[0].content;
    expect(msg).toContain('-ay');
    expect(msg).toContain('-ight');
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

  it("falls back to the requested language's groups when no client is provided", async () => {
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

describe('sampleGroups', () => {
  const pool: RhymeGroup[] = Array.from({ length: 20 }, (_, i) => ({
    ending: `-end${i}`,
    words: [`word${i}a`, `word${i}b`],
  }));

  it('returns exactly n groups', () => {
    expect(sampleGroups(pool, 10).length).toBe(10);
  });

  it('returns all items when n >= pool size', () => {
    expect(sampleGroups(pool, 20).length).toBe(20);
    expect(sampleGroups(pool, 99).length).toBe(20);
  });

  it('returns a subset of the original pool', () => {
    const sample = sampleGroups(pool, 10);
    for (const g of sample) {
      expect(pool).toContainEqual(g);
    }
  });

  it('does not mutate the original pool', () => {
    const original = [...pool];
    sampleGroups(pool, 10);
    expect(pool).toEqual(original);
  });

  it('returns 0 items for n=0', () => {
    expect(sampleGroups(pool, 0)).toEqual([]);
  });
});
