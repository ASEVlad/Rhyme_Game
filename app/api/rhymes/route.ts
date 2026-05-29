import { NextResponse } from 'next/server';
import { fetchRhymeBlocks } from '@/lib/rhymes';
import { getGeminiKeys } from '@/lib/gemini';
import { getLanguage } from '@/lib/languages';
import type { RhymeExclusion } from '@/lib/languages';
import { getDifficulty } from '@/lib/difficulties';
import { getRhymeScheme } from '@/lib/rhyme-schemes';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  let rawLanguage: string | null = null;
  let rawDifficultyId: string | null = null;
  let rawSchemeId: string | null = null;
  let exclude: RhymeExclusion = { words: [], endings: [] };
  let count: number | undefined;
  try {
    const body = await request.json();
    if (body && typeof body.language === 'string') rawLanguage = body.language;
    if (body && typeof body.difficultyId === 'string') rawDifficultyId = body.difficultyId;
    if (body && typeof body.schemeId === 'string') rawSchemeId = body.schemeId;
    if (Array.isArray(body?.exclude?.words)) {
      exclude.words = body.exclude.words
        .filter((w: unknown) => typeof w === 'string')
        .slice(0, 60);
    }
    if (typeof body?.count === 'number' && Number.isFinite(body.count)) {
      count = Math.max(1, Math.min(50, Math.floor(body.count)));
    }
  } catch {
    // No body or malformed JSON — use defaults.
  }
  const lang = getLanguage(rawLanguage);

  if (!getGeminiKeys().length) {
    console.warn('[rhymes] no GEMINI_API_KEY set — using fallback blocks');
  }
  const { blocks } = await fetchRhymeBlocks({
    language: lang.id,
    exclude,
    difficultyId: getDifficulty(rawDifficultyId).id,
    schemeId: getRhymeScheme(rawSchemeId).id,
    count,
  });
  return NextResponse.json({ blocks });
}
