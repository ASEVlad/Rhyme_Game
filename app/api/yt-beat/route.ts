import { execFileSync } from 'child_process';
import { existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { isYouTubeUrl, hashUrl, selectFilesToDelete } from '@/lib/yt-beat';

export const runtime = 'nodejs';

const TMP_DIR = '/tmp';
const TMP_PREFIX = 'rhyme-game-yt-';
const KEEP_N = 3;

function tmpMp3Path(id: string) {
  return join(TMP_DIR, `${TMP_PREFIX}${id}.mp3`);
}

function estimateBarsPerLoop(bpm: number, durationSec: number): number {
  const raw = (bpm * durationSec) / 240;
  const candidates = [4, 8, 16, 32, 64];
  return candidates.reduce((best, c) =>
    Math.abs(c - raw) < Math.abs(best - raw) ? c : best, 8);
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
    const samples = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
    const mt = new MusicTempo(samples, { minBPM: 60, maxBPM: 200 });
    let bpm: number = mt.tempo;
    // music-tempo often returns 2× BPM for slow hip-hop; halve if plausible
    if (bpm > 130 && bpm / 2 >= 70) bpm = bpm / 2;
    return { bpm: Math.round(bpm * 10) / 10, bpmFallback: false };
  } catch {
    return { bpm: 90, bpmFallback: true };
  }
}

function cleanupOldFiles() {
  const files = readdirSync(TMP_DIR)
    .filter(f => f.startsWith(TMP_PREFIX) && f.endsWith('.mp3'))
    .map(f => join(TMP_DIR, f))
    .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs); // oldest first
  for (const f of selectFilesToDelete(files, KEEP_N)) {
    try { unlinkSync(f); } catch { /* ignore */ }
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
  const filepath = tmpMp3Path(id);

  if (!existsSync(filepath)) {
    // yt-dlp output template: %(ext)s expands to "mp3" after extraction,
    // producing the same path as tmpMp3Path(id).
    const outputTemplate = join(TMP_DIR, `${TMP_PREFIX}${id}.%(ext)s`);
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
    cleanupOldFiles();
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

  let title = 'YouTube Beat';
  try {
    title = execFileSync('yt-dlp', [
      '--print', 'title',
      '--no-download',
      '--no-playlist',
      url,
    ], { encoding: 'utf8', timeout: 15_000 }).trim().slice(0, 80);
  } catch { /* use default title */ }

  return NextResponse.json({
    id,
    title,
    bpm,
    barsPerLoop,
    ...(bpmFallback && { bpmFallback: true }),
    src: `/api/yt-audio/${id}`,
    category: 'other',
  });
}
