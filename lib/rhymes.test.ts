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
