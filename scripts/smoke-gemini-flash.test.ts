import fs from 'node:fs';
import path from 'node:path';
import { describe, test, expect } from 'vitest';
import { callGeminiTool, type GeminiTool } from '../lib/gemini';
import { buildPrompt } from '../lib/rhymes';
import { getLanguage } from '../lib/languages';
import { getRhymeScheme, type RhymeSchemeId } from '../lib/rhyme-schemes';

// Opt-in only: this makes live Gemini calls and consumes free-tier quota.
// Run with:  GEMINI_SMOKE=1 npx vitest run scripts/smoke-gemini-flash.test.ts
const ENABLED = process.env.GEMINI_SMOKE === '1';

// Load .env ONLY when enabled, so collection of this file in the normal suite
// never leaks GEMINI_API_KEY* into process.env for other tests.
if (ENABLED) {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const lang = getLanguage('uk');
const RHYME_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

const tool: GeminiTool = {
  name: 'rhyme_blocks',
  description: `Return 4-bar blocks of common ${lang.label} end-words that rhyme according to a pattern.`,
  parameters: {
    type: 'object',
    properties: {
      blocks: {
        type: 'array',
        items: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 },
      },
    },
    required: ['blocks'],
  },
};

describe.skipIf(!ENABLED)('gemini 2.5 flash — uk rhyme smoke (real callGeminiTool path)', () => {
  const cases: Array<[RhymeSchemeId, number]> = [
    ['AABB', 6],
    ['AXAX', 6],
    ['ABAB', 6],
    ['AAAA', 6],
    ['AXAA', 6],
  ];
  for (const [schemeId, count] of cases) {
    test(`generates ${schemeId} blocks`, async () => {
      const scheme = getRhymeScheme(schemeId);
      const prompt = buildPrompt(lang, count, scheme, 'common words a teenager would recognize', { words: [], endings: [] });
      const args = await callGeminiTool({ prompt, tool, temperature: 0.4 + Math.random() * 0.4, models: RHYME_MODELS, maxTokens: 4096 });
      const blocks = (args?.blocks as string[][]) ?? null;
      console.log(`\n##### ${schemeId} (count=${count}, pattern ${scheme.pattern}) #####`);
      if (!blocks) { console.log('  (no result — all keys/models failed)'); }
      else for (const w of blocks) console.log('   ', JSON.stringify(w));
      expect(blocks).not.toBeNull();
      expect(blocks!.length).toBeGreaterThan(0);
    }, 60_000);
  }
});
