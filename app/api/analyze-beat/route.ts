import { NextRequest, NextResponse } from 'next/server';
import { callGeminiTool, type GeminiTool } from '@/lib/gemini';
import type { BeatCategory } from '@/lib/beats';

export const runtime = 'nodejs';

const RATE_WINDOW_MS = 60_000;
const MAX_CALLS = 10;
const callsByIp = new Map<string, number[]>();

// Cheap classification: Flash-Lite is plenty; fall back to Flash if it's down.
const BEAT_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];

const VALID_CATEGORIES: BeatCategory[] = ['boom-bap', 'trap', 'jazz', 'lo-fi', 'drill', 'other'];

const TOOL: GeminiTool = {
  name: 'beat_category',
  description: 'Return the most likely genre category for a beat.',
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: VALID_CATEGORIES,
      },
    },
    required: ['category'],
  },
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { bpm, title } = body as { bpm?: unknown; title?: unknown };
  if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0 || typeof title !== 'string') {
    return NextResponse.json({ category: 'other' });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const now = Date.now();
  const recent = (callsByIp.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= MAX_CALLS) {
    return NextResponse.json({ category: 'other' }, { status: 429 });
  }
  callsByIp.set(ip, [...recent, now]);

  const args = await callGeminiTool({
    prompt: `Given a beat titled "${title}" with a detected BPM of ${bpm}, suggest the most likely genre category.`,
    tool: TOOL,
    models: BEAT_MODELS,
    maxTokens: 64,
  });
  const category = (args as { category?: string } | null)?.category;
  return NextResponse.json({
    category: VALID_CATEGORIES.includes(category as BeatCategory) ? category : 'other',
  });
}
