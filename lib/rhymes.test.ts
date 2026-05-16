import { describe, it, expect, vi } from 'vitest';
import { fetchRhymeGroups, sampleGroups, buildPrompt } from './rhymes';
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
    const groups = await fetchRhymeGroups({ client, language: 'uk' });
    expect(groups).toEqual([
      { ending: '-іт', words: ['кіт', 'літ', 'піт'] },
      { ending: '-ата', words: ['хата', 'лата'] },
    ]);
  });

  it("uses the requested language's prompt template", async () => {
    const client = mockClient('good');
    await fetchRhymeGroups({ client, language: 'en' });
    const call = client.messages.create.mock.calls[0][0];
    const userMessage = call.messages[0].content;
    expect(userMessage).toContain('English');
    expect(userMessage).toContain('10 groups'); // free scheme groupCount
  });

  it('includes a theme word in the prompt', async () => {
    const client = mockClient('good');
    await fetchRhymeGroups({ client, language: 'en' });
    const call = client.messages.create.mock.calls[0][0];
    const userMessage: string = call.messages[0].content;
    const themes = getLanguage('en').themes;
    expect(themes.some(t => userMessage.includes(t))).toBe(true);
  });

  it('sets temperature to 1', async () => {
    const client = mockClient('good');
    await fetchRhymeGroups({ client, language: 'uk' });
    const call = client.messages.create.mock.calls[0][0];
    expect(call.temperature).toBe(1);
  });

  it('includes excluded words in the prompt', async () => {
    const client = mockClient('good');
    await fetchRhymeGroups({
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
    await fetchRhymeGroups({ client, language: 'es' });
    const call = client.messages.create.mock.calls[0][0];
    expect(call.tools[0].description).toContain('Español');
  });

  it('falls back to the requested language groups when the API throws', async () => {
    const groups = await fetchRhymeGroups({
      client: mockClient('throws'),
      language: 'de',
    });
    expect(groups).toEqual(FALLBACK_GROUPS_BY_LANGUAGE.de);
  });

  it('falls back when no tool-use block is returned', async () => {
    const groups = await fetchRhymeGroups({
      client: mockClient('malformed'),
      language: 'pl',
    });
    expect(groups).toEqual(FALLBACK_GROUPS_BY_LANGUAGE.pl);
  });

  it('falls back when groups array is empty', async () => {
    const groups = await fetchRhymeGroups({
      client: mockClient('empty'),
      language: 'en',
    });
    expect(groups).toEqual(FALLBACK_GROUPS_BY_LANGUAGE.en);
  });

  it("falls back to the requested language's groups when no client is provided", async () => {
    const groups = await fetchRhymeGroups({ language: 'es' });
    expect(groups).toEqual(FALLBACK_GROUPS_BY_LANGUAGE.es);
  });

  it('defaults to uk when language is missing or unknown', async () => {
    const groups = await fetchRhymeGroups();
    expect(groups).toEqual(FALLBACK_GROUPS_BY_LANGUAGE.uk);

    const groups2 = await fetchRhymeGroups({ language: 'ru' as any });
    expect(groups2).toEqual(FALLBACK_GROUPS_BY_LANGUAGE.uk);
  });

  it('passes expert difficultyHint to the prompt when difficultyId is expert', async () => {
    const client = mockClient('good');
    await fetchRhymeGroups({ client, language: 'en', difficultyId: 'expert' });
    const call = client.messages.create.mock.calls[0][0];
    const msg: string = call.messages[0].content;
    expect(msg).toContain('rare, abstract, or sophisticated vocabulary');
  });

  it('requests 8 groups when schemeId is bar4', async () => {
    const client = mockClient('good');
    await fetchRhymeGroups({ client, language: 'en', schemeId: 'bar4' });
    const call = client.messages.create.mock.calls[0][0];
    const msg: string = call.messages[0].content;
    expect(msg).toContain('8 groups');
  });

  it('uses explicit count over scheme.groupCount when provided', async () => {
    const create = vi.fn(async () => ({
      content: [
        { type: 'tool_use', name: 'rhyme_groups', input: { groups: [] } },
      ],
    }));
    const client = { messages: { create } } as any;
    await fetchRhymeGroups({ client, language: 'uk', schemeId: 'free', count: 23 });
    const promptArg = create.mock.calls[0][0].messages[0].content as string;
    // The Ukrainian prompt template embeds the count number; assert it's our override.
    expect(promptArg).toMatch(/23/);
  });

  it('falls back to scheme.groupCount when count is omitted', async () => {
    const create = vi.fn(async () => ({
      content: [
        { type: 'tool_use', name: 'rhyme_groups', input: { groups: [] } },
      ],
    }));
    const client = { messages: { create } } as any;
    // 'free' scheme has groupCount: 10
    await fetchRhymeGroups({ client, language: 'uk', schemeId: 'free' });
    const promptArg = create.mock.calls[0][0].messages[0].content as string;
    expect(promptArg).toMatch(/(^|\s|\D)10(\s|\D|$)/);
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

describe('buildPrompt', () => {
  const lang = getLanguage('en');

  it('includes the group count in the output', () => {
    const p = buildPrompt(lang, 8, 'nature');
    expect(p).toContain('8');
  });

  it('uses "3–4 words" when wordsPerGroup is null', () => {
    const p = buildPrompt(lang, 4, 'nature', undefined, null);
    expect(p).toContain('3–4 words');
  });

  it('uses "3–4 words" when wordsPerGroup is undefined', () => {
    const p = buildPrompt(lang, 4, 'nature');
    expect(p).toContain('3–4 words');
  });

  it('uses exact count when wordsPerGroup is a number', () => {
    const p = buildPrompt(lang, 4, 'nature', undefined, 2);
    expect(p).toContain('exactly 2 words');
  });

  it('includes difficultyHint in the output', () => {
    const p = buildPrompt(lang, 4, 'nature', 'rare, abstract, or sophisticated vocabulary');
    expect(p).toContain('rare, abstract, or sophisticated vocabulary');
  });

  it('does not include the hardcoded teenager line when difficultyHint is provided', () => {
    const p = buildPrompt(lang, 4, 'nature', 'expert vocabulary');
    expect(p).not.toContain('teenager');
  });

  it('includes excluded words from the exclude argument', () => {
    const p = buildPrompt(lang, 4, 'nature', undefined, undefined, {
      words: ['cat', 'bat'],
      endings: ['-at'],
    });
    expect(p).toContain('cat');
    expect(p).toContain('-at');
  });
});
