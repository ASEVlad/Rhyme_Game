import { NextResponse } from 'next/server';
import { fetchRhymeBlocks } from '@/lib/rhymes';
import { getGeminiKeys } from '@/lib/gemini';
import { getLanguage } from '@/lib/languages';
import type { RhymeExclusion } from '@/lib/languages';
import { getDifficulty } from '@/lib/difficulties';
import { getRhymeScheme } from '@/lib/rhyme-schemes';
import { auth } from '@/auth';
import { logGameRun, type GameRunRecord } from '@/lib/game-runs';

export const runtime = 'nodejs';
export const maxDuration = 30;

function parseBeat(raw: unknown): GameRunRecord['beat'] {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  return {
    id: typeof b.id === 'string' ? b.id.slice(0, 200) : null,
    title: typeof b.title === 'string' ? b.title.slice(0, 300) : null,
    bpm: typeof b.bpm === 'number' && Number.isFinite(b.bpm) ? b.bpm : null,
    category: typeof b.category === 'string' ? b.category.slice(0, 50) : null,
    source: b.source === 'youtube' ? 'youtube' : 'local',
  };
}

export async function POST(request: Request) {
  let rawLanguage: string | null = null;
  let rawDifficultyId: string | null = null;
  let rawSchemeId: string | null = null;
  let exclude: RhymeExclusion = { words: [], endings: [] };
  let count: number | undefined;
  let beat: GameRunRecord['beat'] = null;
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
    beat = parseBeat(body?.beat);
  } catch {
    // No body or malformed JSON — use defaults.
  }
  const lang = getLanguage(rawLanguage);
  const difficulty = getDifficulty(rawDifficultyId);
  const scheme = getRhymeScheme(rawSchemeId);

  if (!getGeminiKeys().length) {
    console.warn('[rhymes] no GEMINI_API_KEY set — using fallback blocks');
  }
  const { blocks, usedFallback } = await fetchRhymeBlocks({
    language: lang.id,
    exclude,
    difficultyId: difficulty.id,
    schemeId: scheme.id,
    count,
  });

  const session = await auth();
  await logGameRun({
    userEmail: session?.user?.email ?? null,
    beat,
    language: lang.id,
    difficulty: difficulty.id,
    scheme: scheme.id,
    blockCount: blocks.length,
    usedFallback,
    blocks,
  });

  return NextResponse.json({ blocks });
}
