// scripts/gen-beat.mjs
// Generates an 8-bar 90 BPM kick+hat WAV at public/beats/click-90.wav
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SAMPLE_RATE = 44100;
const BPM = 90;
const BARS = 8;
const BEATS_PER_BAR = 4;
const TOTAL_BEATS = BARS * BEATS_PER_BAR;          // 32
const SECONDS_PER_BEAT = 60 / BPM;                 // 0.6667
const TOTAL_SAMPLES = Math.round(TOTAL_BEATS * SECONDS_PER_BEAT * SAMPLE_RATE);

// Output buffer of int16 samples
const samples = new Int16Array(TOTAL_SAMPLES);

// Helper: add a "kick"-ish thump at sampleIndex
function addKick(at) {
  const dur = Math.round(0.18 * SAMPLE_RATE); // 180 ms
  for (let i = 0; i < dur; i++) {
    if (at + i >= TOTAL_SAMPLES) break;
    const t = i / SAMPLE_RATE;
    // Decaying low-freq sine, freq slightly drops
    const env = Math.exp(-t * 14);
    const freq = 60 - 30 * t; // 60 Hz dropping to ~50
    const v = Math.sin(2 * Math.PI * freq * t) * env * 0.7;
    const s = Math.max(-1, Math.min(1, v));
    samples[at + i] = Math.max(-32767, Math.min(32767, samples[at + i] + Math.round(s * 32767)));
  }
}

// Helper: hi-hat-ish noise tick
function addHat(at) {
  const dur = Math.round(0.04 * SAMPLE_RATE); // 40 ms
  for (let i = 0; i < dur; i++) {
    if (at + i >= TOTAL_SAMPLES) break;
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 80);
    const v = (Math.random() * 2 - 1) * env * 0.25;
    const s = Math.max(-1, Math.min(1, v));
    samples[at + i] = Math.max(-32767, Math.min(32767, samples[at + i] + Math.round(s * 32767)));
  }
}

for (let beat = 0; beat < TOTAL_BEATS; beat++) {
  const at = Math.round(beat * SECONDS_PER_BEAT * SAMPLE_RATE);
  // Kick on beat 1 and 3 of every bar; hat on every beat
  const beatInBar = beat % BEATS_PER_BAR;
  if (beatInBar === 0 || beatInBar === 2) addKick(at);
  addHat(at);
}

// Write WAV file: 44-byte header + PCM data
function writeWav(path, int16Samples, sampleRate) {
  const dataSize = int16Samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  // RIFF header
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);  // chunk size
  buf.write('WAVE', 8);
  // fmt subchunk
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);            // subchunk1 size (PCM)
  buf.writeUInt16LE(1, 20);             // audio format (PCM)
  buf.writeUInt16LE(1, 22);             // num channels (mono)
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate (mono * 2 bytes)
  buf.writeUInt16LE(2, 32);             // block align
  buf.writeUInt16LE(16, 34);            // bits per sample
  // data subchunk
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  // PCM payload
  for (let i = 0; i < int16Samples.length; i++) {
    buf.writeInt16LE(int16Samples[i], 44 + i * 2);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
}

const outPath = 'public/beats/click-90.wav';
writeWav(outPath, samples, SAMPLE_RATE);
const seconds = TOTAL_SAMPLES / SAMPLE_RATE;
console.log(`Wrote ${outPath} — ${seconds.toFixed(4)}s, ${TOTAL_BEATS} beats @ ${BPM} BPM, ${BARS} bars`);
