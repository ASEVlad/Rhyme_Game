import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { fetchRhymeGroups } from '@/lib/rhymes';
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
    if (Array.isArray(body?.exclude?.endings)) {
      exclude.endings = body.exclude.endings
        .filter((e: unknown) => typeof e === 'string')
        .slice(0, 20);
    }
  } catch {
    // No body or malformed JSON — use defaults.
  }
  const lang = getLanguage(rawLanguage);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[rhymes] ANTHROPIC_API_KEY not set — using fallback groups');
  }
  const client = apiKey ? new Anthropic({ apiKey }) : undefined;
  const groups = await fetchRhymeGroups({
    client,
    language: lang.id,
    exclude,
    difficultyId: getDifficulty(rawDifficultyId).id,
    schemeId: getRhymeScheme(rawSchemeId).id,
  });
  return NextResponse.json({ groups });
}
