/**
 * Batch beat calibration script.
 * Detects BPM via music-tempo, infers category from filename,
 * derives a clean id/title, and prints beats.ts entries.
 *
 * Usage: node scripts/calibrate-beats.mjs
 */

import { execFileSync } from 'child_process';
import { readdirSync } from 'fs';
import { join, basename, extname } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const MusicTempo = require('music-tempo');

const BEATS_DIR = new URL('../public/beats/', import.meta.url).pathname;
const SAMPLE_RATE = 22050;

// ── Category inference ────────────────────────────────────────────────────────
function inferCategory(filename) {
  const f = filename.toLowerCase();
  if (/lo-?fi|lofi/.test(f)) return 'lo-fi';
  if (/trap/.test(f)) return 'trap';
  if (/jazz/.test(f)) return 'jazz';
  if (/drill/.test(f)) return 'drill';
  if (/boom.?bap|old.?school|90s|underground/.test(f)) return 'boom-bap';
  return 'other';
}

// ── Clean id/title ────────────────────────────────────────────────────────────
function cleanName(filename) {
  let name = basename(filename, extname(filename));

  // Strip common filler patterns
  name = name
    .replace(/^\[?(FREE|SOLD)\]?\s*/gi, '')
    .replace(/\(?(FREE)\)?\s*/gi, '')
    .replace(/FREE\s+FOR\s+PROFIT\s+USE/gi, '')
    .replace(/\(prod\..*?\)/gi, '')
    .replace(/prod\.\s*by\s*[^|[\]]+/gi, '')
    .replace(/\s*\|\s*.*/g, '')           // everything after first pipe
    .replace(/\s*[-–—]\s*(rap beats|rap instrumental|free type beat|type beat|hip hop instrumental|underground hip hop instrumental)[^)[\]]*$/gi, '')
    .replace(/\s*\(?(freestyle|hard|free type beat)\)?\s*$/gi, '')
    .replace(/\[\d{4}\]\s*$/g, '')        // trailing [2023] etc
    .replace(/[＂"＂"]/g, '"')
    .replace(/[^\w\s'",.\-!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!name || name.length < 3) {
    name = basename(filename, extname(filename))
      .replace(/[^\w\s]/g, ' ').trim().slice(0, 40);
  }

  // Title case
  const title = name
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return { id, title };
}

// ── BPM detection (with halving correction) ───────────────────────────────────
function detectBpm(filepath) {
  const raw = execFileSync('ffmpeg', [
    '-i', filepath,
    '-f', 'f32le',
    '-ar', String(SAMPLE_RATE),
    '-ac', '1',
    '-loglevel', 'error',
    '-',
  ], { maxBuffer: 50 * 1024 * 1024 });

  const samples = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const mt = new MusicTempo(samples, { minBPM: 60, maxBPM: 200 });
  let bpm = mt.tempo;

  // music-tempo often detects 2× BPM for slow hip-hop (e.g. 180 instead of 90).
  // If halving gives a value in the plausible hip-hop range (70–120), use it.
  if (bpm > 130 && bpm / 2 >= 70) {
    bpm = bpm / 2;
  }

  return Math.round(bpm * 10) / 10;
}

function getDurationSec(filepath) {
  const out = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    filepath,
  ], { encoding: 'utf8' });
  return parseFloat(out.trim());
}

function estimateBarsPerLoop(bpm, durationSec) {
  const raw = (bpm * durationSec) / 240;
  const candidates = [4, 8, 16, 32, 64];
  return candidates.reduce((best, c) => Math.abs(c - raw) < Math.abs(best - raw) ? c : best, 8);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const files = readdirSync(BEATS_DIR)
  .filter(f => /\.(mp3|wav|ogg|flac)$/i.test(f) && f !== 'click-90.wav')
  .sort();

console.log(`Processing ${files.length} beats...\n`);

const entries = [];
const errors = [];

for (const file of files) {
  const filepath = join(BEATS_DIR, file);
  const { id, title } = cleanName(file);
  const category = inferCategory(file);

  process.stdout.write(`  ${title.slice(0, 52).padEnd(52)} `);

  let bpm, barsPerLoop;
  try {
    const duration = getDurationSec(filepath);
    bpm = detectBpm(filepath);
    barsPerLoop = estimateBarsPerLoop(bpm, duration);
    process.stdout.write(`${String(bpm).padEnd(7)} ${category}\n`);
  } catch (e) {
    const msg = String(e?.message ?? e).slice(0, 80);
    process.stdout.write(`ERROR\n`);
    errors.push({ file, msg });
    continue;
  }

  entries.push({ id, title, file, bpm, barsPerLoop, category });
}

if (errors.length) {
  console.log('\n⚠ Failed files:');
  for (const { file, msg } of errors) {
    console.log(`  ${file}\n    ${msg}`);
  }
}

console.log('\n\n// ── Paste into lib/beats.ts BEATS array ───────────────────────────────────\n');

for (const e of entries) {
  const src = `/beats/${e.file}`;
  console.log(`  {`);
  console.log(`    id: '${e.id}',`);
  console.log(`    src: ${JSON.stringify(src)},`);
  console.log(`    title: '${e.title}',`);
  console.log(`    bpm: ${e.bpm},`);
  console.log(`    barsPerLoop: ${e.barsPerLoop},`);
  console.log(`    startOffset: 0,`);
  console.log(`    category: '${e.category}',`);
  console.log(`  },`);
}
