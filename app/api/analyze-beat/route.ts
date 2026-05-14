import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { BeatCategory } from '@/lib/beats';

export const runtime = 'nodejs';

const RATE_WINDOW_MS = 60_000;
const MAX_CALLS = 10;
const callsByIp = new Map<string, number[]>();

const VALID_CATEGORIES: BeatCategory[] = ['boom-bap', 'trap', 'jazz', 'lo-fi', 'drill', 'other'];

const TOOL = {
  name: 'beat_category',
  description: 'Return the most likely genre category for a beat.',
  input_schema: {
    type: 'object' as const,
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ category: 'other' });

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'beat_category' },
      messages: [{
        role: 'user',
        content: `Given a beat titled "${title}" with a detected BPM of ${bpm}, suggest the most likely genre category.`,
      }],
    });
    const block = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'beat_category'
    );
    const category = (block?.input as { category?: string })?.category;
    return NextResponse.json({
      category: VALID_CATEGORIES.includes(category as BeatCategory) ? category : 'other',
    });
  } catch {
    return NextResponse.json({ category: 'other' });
  }
}
