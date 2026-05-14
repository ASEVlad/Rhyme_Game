import { execFileSync } from 'child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { isYouTubeUrl, hashUrl } from '@/lib/yt-beat';
import type { Beat, BeatCategory } from '@/lib/beats';

export const runtime = 'nodejs';

const BEATS_DIR = join(process.cwd(), 'public', 'beats');
const YT_PREFIX = 'yt-';
const CATALOG_PATH = join(BEATS_DIR, 'yt-catalog.json');
const KEEP_N = 200;

const VALID_CATEGORIES: BeatCategory[] = ['boom-bap', 'trap', 'jazz', 'lo-fi', 'drill', 'other'];

const GENRE_TOOL = {
  name: 'beat_category',
  description: 'Return the most likely genre category for a beat.',
  input_schema: {
    type: 'object' as const,
    properties: {
      category: { type: 'string', enum: VALID_CATEGORIES },
    },
    required: ['category'],
  },
};

const TITLE_TOOL = {
  name: 'beat_title',
  description: 'Return a short clean title for a rap beat.',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: '2–5 words, no SEO filler' },
    },
    required: ['title'],
  },
};

function beatPath(id: string) {
  return join(BEATS_DIR, `${YT_PREFIX}${id}.mp3`);
}

function readCatalog(): Beat[] {
  try {
    return JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as Beat[];
  } catch {
    return [];
  }
}

function writeCatalog(catalog: Beat[]) {
  writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
}

function estimateBarsPerLoop(bpm: number, durationSec: number): number {
  const raw = (bpm * durationSec) / 240;
  const candidates = [4, 8, 16, 32, 64];
  return candidates.reduce((best, c) =>
    Math.abs(c - raw) < Math.abs(best - raw) ? c : best, candidates[0]);
}

function detectBpm(filepath: string): { bpm: number; bpmFallback: boolean } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const MusicTempo = require('music-tempo');
    const raw = execFileSync('ffmpeg', [
      '-i', filepath,
      '-t', '60',
      '-f', 'f32le',
      '-ar', '22050',
      '-ac', '1',
      '-loglevel', 'error',
      '-',
    ], { maxBuffer: 50 * 1024 * 1024 });
    const samples = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 4));
    const mt = new MusicTempo(samples, { minBPM: 60, maxBPM: 200 });
    let bpm: number = mt.tempo;
    if (!bpm || bpm < 1) throw new Error('invalid bpm');
    if (bpm > 130 && bpm / 2 >= 70) bpm = bpm / 2;
    return { bpm: Math.round(bpm * 10) / 10, bpmFallback: false };
  } catch {
    return { bpm: 90, bpmFallback: true };
  }
}

async function detectGenre(title: string, bpm: number): Promise<BeatCategory> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return 'other';
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      tools: [GENRE_TOOL],
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
    return VALID_CATEGORIES.includes(category as BeatCategory)
      ? (category as BeatCategory)
      : 'other';
  } catch {
    return 'other';
  }
}

async function generateTitle(
  rawTitle: string,
  description: string,
  bpm: number,
  genre: BeatCategory,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return rawTitle.slice(0, 80);
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      tools: [TITLE_TOOL],
      tool_choice: { type: 'tool', name: 'beat_title' },
      messages: [{
        role: 'user',
        content: [
          'Clean up this YouTube beat title into 2–5 words.',
          'Strip: FREE, SOLD, year numbers, "Type Beat", "Instrumental", "Rap Beats", pipe-separated suffixes, bracketed tags.',
          'Keep: artist names (J Cole, Kendrick), mood words (dark, chill), genre words (boom bap, trap, jazz).',
          'If the description adds useful mood/vibe info, use it.',
          '',
          `YouTube title: ${rawTitle}`,
          `Description (first 500 chars): ${description}`,
          `BPM: ${bpm}  Genre: ${genre}`,
        ].join('\n'),
      }],
    });
    const block = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'beat_title'
    );
    const title = (block?.input as { title?: string })?.title;
    return typeof title === 'string' && title.trim() ? title.trim() : rawTitle.slice(0, 80);
  } catch {
    return rawTitle.slice(0, 80);
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid-body' }, { status: 400 });
  }

  const url = typeof (body as any)?.url === 'string' ? (body as any).url.trim() : '';
  if (!isYouTubeUrl(url)) {
    return NextResponse.json({ error: 'invalid-url' }, { status: 400 });
  }

  const id = hashUrl(url);

  // Early return: already in catalog — no download, no LLM, no file I/O
  const catalogOnEntry = readCatalog();
  const existing = catalogOnEntry.find(b => b.id === id);
  if (existing) return NextResponse.json(existing);

  const filepath = beatPath(id);

  if (!existsSync(filepath)) {
    const outputTemplate = join(BEATS_DIR, `${YT_PREFIX}${id}.%(ext)s`);
    try {
      execFileSync('yt-dlp', [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '5',
        '--no-playlist',
        '-o', outputTemplate,
        url,
      ], { timeout: 120_000 });
    } catch (e: unknown) {
      if ((e as any)?.code === 'ENOENT') {
        return NextResponse.json({ error: 'ytdlp-not-found' }, { status: 500 });
      }
      return NextResponse.json({
        error: 'download-failed',
        detail: String((e as any)?.message ?? '').slice(0, 200),
      }, { status: 500 });
    }

    if (!existsSync(filepath)) {
      return NextResponse.json(
        { error: 'download-failed', detail: 'expected .mp3 not found after yt-dlp' },
        { status: 500 },
      );
    }
  }

  const { bpm, bpmFallback } = detectBpm(filepath);

  let barsPerLoop = 64;
  try {
    const durationOut = execFileSync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      filepath,
    ], { encoding: 'utf8' });
    barsPerLoop = estimateBarsPerLoop(bpm, parseFloat(durationOut.trim()));
  } catch { /* use default 64 */ }

  // Fetch YouTube title + description in one yt-dlp call
  let rawTitle = 'YouTube Beat';
  let description = '';
  try {
    const out = execFileSync('yt-dlp', [
      '--print', '%(title)s',
      '--print', '%(description)s',
      '--no-download',
      '--no-playlist',
      url,
    ], { encoding: 'utf8', timeout: 15_000 });
    const nl = out.indexOf('\n');
    rawTitle = (nl >= 0 ? out.slice(0, nl) : out).trim() || 'YouTube Beat';
    description = nl >= 0 ? out.slice(nl + 1, nl + 501).trim() : '';
  } catch { /* use defaults */ }

  // Inline genre detection
  const category = await detectGenre(rawTitle, bpm);

  // Inline title generation
  const title = await generateTitle(rawTitle, description, bpm, category);

  const beat: Beat & { source: 'youtube' } = {
    id,
    src: `/beats/${YT_PREFIX}${id}.mp3`,
    title,
    bpm,
    barsPerLoop,
    category,
    source: 'youtube',
  };

  // Catalog update: prepend, evict beyond KEEP_N (delete their .mp3s), write
  const freshCatalog = readCatalog();
  const merged = [beat, ...freshCatalog.filter(b => b.id !== id)];
  const evicted = merged.splice(KEEP_N);
  for (const b of evicted) {
    try { unlinkSync(beatPath(b.id)); } catch { /* ignore */ }
  }
  try { writeCatalog(merged); } catch { /* ignore */ }

  return NextResponse.json({ ...beat, ...(bpmFallback && { bpmFallback: true }) });
}
