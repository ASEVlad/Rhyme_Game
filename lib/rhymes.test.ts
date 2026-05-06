import { describe, it, expect, vi } from 'vitest';
import { fetchRhymeGroups } from './rhymes';
import { FALLBACK_GROUPS } from './fallback-groups';

function mockClient(behavior: 'good' | 'malformed' | 'throws' | 'empty') {
  return {
    messages: {
      create: vi.fn(async () => {
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
      }),
    },
  } as any;
}

describe('fetchRhymeGroups', () => {
  it('returns groups from a successful tool-use response', async () => {
    const groups = await fetchRhymeGroups({ count: 2, client: mockClient('good') });
    expect(groups).toEqual([
      { ending: '-іт', words: ['кіт', 'літ', 'піт'] },
      { ending: '-ата', words: ['хата', 'лата'] },
    ]);
  });

  it('falls back when the API throws', async () => {
    const groups = await fetchRhymeGroups({ count: 2, client: mockClient('throws') });
    expect(groups).toEqual(FALLBACK_GROUPS);
  });

  it('falls back when no tool-use block is returned', async () => {
    const groups = await fetchRhymeGroups({ count: 2, client: mockClient('malformed') });
    expect(groups).toEqual(FALLBACK_GROUPS);
  });

  it('falls back when groups array is empty', async () => {
    const groups = await fetchRhymeGroups({ count: 2, client: mockClient('empty') });
    expect(groups).toEqual(FALLBACK_GROUPS);
  });
});
