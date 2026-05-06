import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { fetchRhymeGroups } from '@/lib/rhymes';
import { flattenBars } from '@/lib/flatten-bars';

export const runtime = 'nodejs';

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const client = apiKey ? new Anthropic({ apiKey }) : undefined;
  const groups = await fetchRhymeGroups({ count: 10, client });
  const bars = flattenBars(groups);
  return NextResponse.json({ groups, bars });
}
