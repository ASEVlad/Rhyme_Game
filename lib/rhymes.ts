import { buildFallbackBlocks, type RhymeBlock } from './fallback-groups';
import { getLanguage, type Language, type LanguageId, type RhymeExclusion } from './languages';
import { getDifficulty, type DifficultyId } from './difficulties';
import { getRhymeScheme, type RhymeSchemeId, type RhymeScheme } from './rhyme-schemes';
import { callGeminiTool, type GeminiTool } from './gemini';

const TOOL_NAME = 'rhyme_blocks';

// Flash for quality; Flash-Lite as fallback when Flash is rate-limited/overloaded.
const RHYME_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

function buildTool(lang: Language): GeminiTool {
  return {
    name: TOOL_NAME,
    description: `Return 4-bar blocks of common ${lang.label} end-words that rhyme according to a pattern.`,
    parameters: {
      type: 'object',
      properties: {
        blocks: {
          type: 'array',
          items: {
            type: 'array',
            items: { type: 'string' },
            minItems: 4,
            maxItems: 4,
          },
        },
      },
      required: ['blocks'],
    },
  };
}

/** Forces the rhyme tool call and returns its parsed arguments, or null. */
export type RhymeGenerator = (call: {
  prompt: string;
  tool: GeminiTool;
  temperature: number;
}) => Promise<Record<string, unknown> | null>;

const defaultGenerator: RhymeGenerator = (call) =>
  callGeminiTool({ ...call, models: RHYME_MODELS, maxTokens: 4096 });

export type FetchOpts = {
  /** Override the model caller (used in tests). Defaults to Gemini. */
  generate?: RhymeGenerator;
  language?: LanguageId;
  exclude?: RhymeExclusion;
  difficultyId?: DifficultyId;
  schemeId?: RhymeSchemeId;
  /** Override scheme.blockCount when set — sized to song duration. */
  count?: number;
};

function parseBlocks(input: unknown, pattern: string): RhymeBlock[] | null {
  const blocks = (input as any)?.blocks;
  if (!Array.isArray(blocks)) return null;
  const cleaned: RhymeBlock[] = [];
  for (const b of blocks) {
    if (!Array.isArray(b) || b.length !== 4) continue;
    const words: string[] = [];
    let ok = true;
    for (let i = 0; i < 4; i++) {
      const w = b[i];
      if (typeof w !== 'string') { ok = false; break; }
      const isX = pattern[i] === 'X';
      if (isX) words.push('');
      else if (w.length === 0) { ok = false; break; }
      else words.push(w);
    }
    if (ok) cleaned.push({ words });
  }
  return cleaned.length ? cleaned : null;
}

export function buildPrompt(
  lang: Language,
  count: number,
  scheme: RhymeScheme,
  difficultyHint?: string,
  exclude?: RhymeExclusion,
): string {
  const theme = lang.themes[Math.floor(Math.random() * lang.themes.length)];
  return lang.promptTemplate(count, theme, exclude, difficultyHint, scheme);
}

export function sampleBlocks(blocks: RhymeBlock[], n: number): RhymeBlock[] {
  const copy = [...blocks];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export async function fetchRhymeBlocks(opts: FetchOpts = {}): Promise<RhymeBlock[]> {
  const difficulty = getDifficulty(opts.difficultyId);
  const scheme = getRhymeScheme(opts.schemeId);
  const count = opts.count ?? scheme.blockCount;
  const lang = getLanguage(opts.language);
  const fallback = () => buildFallbackBlocks(lang.id, scheme, count);
  const generate = opts.generate ?? defaultGenerator;
  try {
    const tool = buildTool(lang);
    const prompt = buildPrompt(lang, count, scheme, difficulty.promptHint, opts.exclude);
    const temperature = 0.4 + Math.random() * 0.4;
    const input = await generate({ prompt, tool, temperature });
    const parsed = parseBlocks(input, scheme.pattern);
    return parsed ?? fallback();
  } catch (err) {
    console.error('[rhymes] fetch failed, using fallback', err);
    return fallback();
  }
}
