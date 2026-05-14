import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { fetchRhymeGroups } from '@/lib/rhymes';
import { flattenBars } from '@/lib/flatten-bars';
import { getLanguage } from '@/lib/languages';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  let rawLanguage: string | null = null;
  try {
    const body = await request.json();
    if (body && typeof body.language === 'string') {
      rawLanguage = body.language;
    }
  } catch {
    // No body or malformed JSON — fall through to default language.
  }
  const lang = getLanguage(rawLanguage);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[rhymes] ANTHROPIC_API_KEY not set — using fallback groups');
  }
  const client = apiKey ? new Anthropic({ apiKey }) : undefined;
  const groups = await fetchRhymeGroups({ count: 10, client, language: lang.id });
  const bars = flattenBars(groups);
  return NextResponse.json({ groups, bars });
}
