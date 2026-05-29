import { describe, it, expect, vi } from 'vitest';
import { fetchRhymeBlocks, sampleBlocks, buildPrompt } from './rhymes';
import { buildFallbackBlocks, type RhymeBlock } from './fallback-groups';
import { getLanguage } from './languages';
import { getRhymeScheme } from './rhyme-schemes';

type Behavior = 'good' | 'malformed' | 'throws' | 'empty';

function mockGenerate(behavior: Behavior) {
  return vi.fn(async (_call: { prompt: string; tool: { name: string; description: string }; temperature: number }) => {
    if (behavior === 'throws') throw new Error('network down');
    if (behavior === 'malformed') return null; // generator couldn't produce a tool call
    if (behavior === 'empty') return { blocks: [] };
    return {
      blocks: [
        ['кіт', 'літ', 'піт', 'цвіт'],
        ['хата', 'лата', 'вата', 'плата'],
      ],
    };
  });
}

describe('fetchRhymeBlocks', () => {
  it('returns blocks from a successful tool-use response', async () => {
    const generate = mockGenerate('good');
    const { blocks, usedFallback } = await fetchRhymeBlocks({ generate, language: 'uk' });
    expect(blocks).toEqual([
      { words: ['кіт', 'літ', 'піт', 'цвіт'] },
      { words: ['хата', 'лата', 'вата', 'плата'] },
    ]);
    expect(usedFallback).toBe(false);
  });

  it("uses the requested language's prompt template", async () => {
    const generate = mockGenerate('good');
    await fetchRhymeBlocks({ generate, language: 'en' });
    const msg: string = generate.mock.calls[0][0].prompt;
    expect(msg).toContain('English');
    expect(msg).toContain('8 4-bar blocks'); // AABB default → blockCount=8
  });

  it('sets temperature to a random value in [0.4, 0.8)', async () => {
    const generate = mockGenerate('good');
    await fetchRhymeBlocks({ generate, language: 'uk' });
    const { temperature } = generate.mock.calls[0][0];
    expect(temperature).toBeGreaterThanOrEqual(0.4);
    expect(temperature).toBeLessThan(0.8);
  });

  it('includes excluded words in the prompt', async () => {
    const generate = mockGenerate('good');
    await fetchRhymeBlocks({
      generate,
      language: 'uk',
      exclude: { words: ['кіт', 'хата'], endings: [] },
    });
    const msg: string = generate.mock.calls[0][0].prompt;
    expect(msg).toContain('кіт');
    expect(msg).toContain('хата');
  });

  it('interpolates the language label into the tool description', async () => {
    const generate = mockGenerate('good');
    await fetchRhymeBlocks({ generate, language: 'es' });
    expect(generate.mock.calls[0][0].tool.description).toContain('Español');
  });

  it('uses rhyme_blocks as tool name', async () => {
    const generate = mockGenerate('good');
    await fetchRhymeBlocks({ generate, language: 'uk' });
    expect(generate.mock.calls[0][0].tool.name).toBe('rhyme_blocks');
  });

  it('falls back to fallback blocks when the generator throws', async () => {
    const { blocks, usedFallback } = await fetchRhymeBlocks({
      generate: mockGenerate('throws'),
      language: 'de',
      schemeId: 'AABB',
    });
    expect(blocks).toEqual(buildFallbackBlocks('de', getRhymeScheme('AABB'), 8));
    expect(usedFallback).toBe(true);
  });

  it('falls back when the generator returns no tool call', async () => {
    const { blocks, usedFallback } = await fetchRhymeBlocks({
      generate: mockGenerate('malformed'),
      language: 'pl',
      schemeId: 'AABB',
    });
    expect(blocks).toEqual(buildFallbackBlocks('pl', getRhymeScheme('AABB'), 8));
    expect(usedFallback).toBe(true);
  });

  it('falls back when blocks array is empty', async () => {
    const { blocks, usedFallback } = await fetchRhymeBlocks({
      generate: mockGenerate('empty'),
      language: 'en',
      schemeId: 'AABB',
    });
    expect(blocks).toEqual(buildFallbackBlocks('en', getRhymeScheme('AABB'), 8));
    expect(usedFallback).toBe(true);
  });

  it('falls back to fallback blocks when the generator yields null', async () => {
    const { blocks, usedFallback } = await fetchRhymeBlocks({
      generate: async () => null,
      language: 'es',
      schemeId: 'AABB',
    });
    expect(blocks).toEqual(buildFallbackBlocks('es', getRhymeScheme('AABB'), 8));
    expect(usedFallback).toBe(true);
  });

  it('defaults to uk when language is missing or unknown', async () => {
    const { blocks, usedFallback } = await fetchRhymeBlocks({ generate: async () => null });
    expect(blocks).toEqual(buildFallbackBlocks('uk', getRhymeScheme('AABB'), 8));
    expect(usedFallback).toBe(true);
  });

  it('maps expert difficultyId onto Difficulty: hard in the prompt', async () => {
    const generate = mockGenerate('good');
    await fetchRhymeBlocks({ generate, language: 'en', difficultyId: 'expert' });
    const msg: string = generate.mock.calls[0][0].prompt;
    expect(msg).toContain('Difficulty: hard');
  });

  it('maps beginner difficultyId onto Difficulty: easy in the prompt', async () => {
    const generate = mockGenerate('good');
    await fetchRhymeBlocks({ generate, language: 'en', difficultyId: 'beginner' });
    const msg: string = generate.mock.calls[0][0].prompt;
    expect(msg).toContain('Difficulty: easy');
  });

  it('requests scheme.blockCount blocks by default', async () => {
    const generate = mockGenerate('good');
    await fetchRhymeBlocks({ generate, language: 'en', schemeId: 'AAAA' });
    const msg: string = generate.mock.calls[0][0].prompt;
    expect(msg).toContain('8 4-bar blocks');
  });

  it('uses explicit count over scheme.blockCount when provided', async () => {
    const generate = mockGenerate('good');
    await fetchRhymeBlocks({ generate, language: 'uk', schemeId: 'AABB', count: 12 });
    const msg: string = generate.mock.calls[0][0].prompt;
    expect(msg).toContain('12 4-bar blocks');
  });

  it('passes the scheme pattern into the prompt', async () => {
    const generate = mockGenerate('good');
    await fetchRhymeBlocks({ generate, language: 'en', schemeId: 'AXAX' });
    const msg: string = generate.mock.calls[0][0].prompt;
    expect(msg).toContain('AXAX');
  });
});

describe('sampleBlocks', () => {
  const pool: RhymeBlock[] = Array.from({ length: 20 }, (_, i) => ({
    words: [`w${i}a`, `w${i}b`, `w${i}c`, `w${i}d`],
  }));

  it('returns exactly n blocks', () => {
    expect(sampleBlocks(pool, 10).length).toBe(10);
  });

  it('returns all items when n >= pool size', () => {
    expect(sampleBlocks(pool, 20).length).toBe(20);
    expect(sampleBlocks(pool, 99).length).toBe(20);
  });

  it('returns a subset of the original pool', () => {
    const sample = sampleBlocks(pool, 10);
    for (const b of sample) {
      expect(pool).toContainEqual(b);
    }
  });

  it('does not mutate the original pool', () => {
    const original = [...pool];
    sampleBlocks(pool, 10);
    expect(pool).toEqual(original);
  });

  it('returns 0 items for n=0', () => {
    expect(sampleBlocks(pool, 0)).toEqual([]);
  });
});

describe('buildPrompt', () => {
  const lang = getLanguage('en');
  const scheme = getRhymeScheme('AABB');

  it('includes the block count in the output', () => {
    const p = buildPrompt(lang, 8, scheme);
    expect(p).toContain('8');
  });

  it('includes the scheme pattern in the output', () => {
    const p = buildPrompt(lang, 8, getRhymeScheme('AXAX'));
    expect(p).toContain('AXAX');
  });

  it('maps difficultyHint onto Difficulty: <level> in the output', () => {
    const p = buildPrompt(lang, 8, scheme, 'rare, abstract, or sophisticated vocabulary');
    expect(p).toContain('Difficulty: hard');
  });

  it('includes excluded words from the exclude argument', () => {
    const p = buildPrompt(lang, 8, scheme, undefined, {
      words: ['cat', 'bat'],
      endings: ['-at'],
    });
    expect(p).toContain('cat');
    expect(p).toContain('-at');
  });
});
