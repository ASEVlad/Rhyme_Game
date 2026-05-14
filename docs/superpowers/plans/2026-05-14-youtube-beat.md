# YouTube Beat Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player paste a YouTube URL in the Setup screen and use that audio as a beat, with BPM auto-detected server-side via yt-dlp + ffmpeg + music-tempo.

**Architecture:** A POST endpoint downloads YouTube audio to `/tmp` via `yt-dlp`, runs BPM detection (ffmpeg → music-tempo, first 60 s, halving correction), and returns a `Beat`-shaped JSON payload. A companion GET endpoint streams the temp MP3 to the browser. `Setup` gains a URL input below the BeatPicker that calls these endpoints; the `onPlay` callback is refactored to accept a full `Beat` so YouTube beats (not in the static array) flow through the existing `useBeat`/`useGameLoop` pipeline unchanged.

**Tech Stack:** Next.js 14 App Router (Node.js runtime), yt-dlp (system binary), ffmpeg, music-tempo (npm), TypeScript, React.

---

## File map

| File | Action |
|------|--------|
| `lib/yt-beat.ts` | Create — pure helpers: URL validation, URL hashing, cleanup selection |
| `lib/yt-beat.test.ts` | Create — unit tests for the above |
| `app/api/yt-beat/route.ts` | Create — POST: download + BPM pipeline |
| `app/api/yt-audio/[id]/route.ts` | Create — GET: stream temp MP3 |
| `components/Game.tsx` | Modify — hold `activeBeat: Beat \| null` instead of `beatId: string \| null` |
| `components/Setup.tsx` | Modify — `onPlay` accepts `Beat`; add YouTube URL input section |

---

### Task 1: Pure utility functions in `lib/yt-beat.ts`

**Files:**
- Create: `lib/yt-beat.ts`
- Create: `lib/yt-beat.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/yt-beat.test.ts
import { isYouTubeUrl, hashUrl, selectFilesToDelete } from './yt-beat';

describe('isYouTubeUrl', () => {
  it('accepts youtube.com/watch URL', () => {
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
  });
  it('accepts youtu.be short link', () => {
    expect(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
  });
  it('rejects Vimeo URL', () => {
    expect(isYouTubeUrl('https://vimeo.com/123')).toBe(false);
  });
  it('rejects empty string', () => {
    expect(isYouTubeUrl('')).toBe(false);
  });
  it('rejects plain text', () => {
    expect(isYouTubeUrl('not a url')).toBe(false);
  });
});

describe('hashUrl', () => {
  it('returns exactly 12 lowercase hex chars', () => {
    const h = hashUrl('https://youtu.be/test');
    expect(h).toHaveLength(12);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });
  it('is deterministic', () => {
    expect(hashUrl('https://youtu.be/test')).toBe(hashUrl('https://youtu.be/test'));
  });
  it('differs for different URLs', () => {
    expect(hashUrl('https://youtu.be/aaa')).not.toBe(hashUrl('https://youtu.be/bbb'));
  });
});

describe('selectFilesToDelete', () => {
  it('returns empty array when at the limit', () => {
    expect(selectFilesToDelete(['a', 'b', 'c'], 3)).toEqual([]);
  });
  it('returns empty array when under limit', () => {
    expect(selectFilesToDelete(['a', 'b'], 3)).toEqual([]);
  });
  it('returns oldest files when over limit', () => {
    const files = ['old1.mp3', 'old2.mp3', 'keep1.mp3', 'keep2.mp3', 'keep3.mp3'];
    expect(selectFilesToDelete(files, 3)).toEqual(['old1.mp3', 'old2.mp3']);
  });
  it('returns single file when one over limit', () => {
    expect(selectFilesToDelete(['old.mp3', 'keep1.mp3', 'keep2.mp3', 'keep3.mp3'], 3))
      .toEqual(['old.mp3']);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest lib/yt-beat.test.ts
```
Expected: FAIL — "Cannot find module './yt-beat'"

- [ ] **Step 3: Implement `lib/yt-beat.ts`**

```ts
// hashUrl uses require('crypto') lazily so this file is safe to import in client components.
export function isYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com\/watch\?.*v=|youtu\.be\/)/.test(url.trim());
}

export function hashUrl(url: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require('crypto');
  return createHash('sha256').update(url.trim()).digest('hex').slice(0, 12);
}

// files must be sorted by mtime ascending (oldest first).
// Returns the subset that should be deleted to keep only keepN files.
export function selectFilesToDelete(files: string[], keepN: number): string[] {
  if (files.length <= keepN) return [];
  return files.slice(0, files.length - keepN);
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest lib/yt-beat.test.ts
```
Expected: PASS — 12 tests

- [ ] **Step 5: Commit**

```bash
git add lib/yt-beat.ts lib/yt-beat.test.ts
git commit -m "feat(yt-beat): pure utility functions with tests"
```

---

### Task 2: `POST /api/yt-beat` — download + BPM pipeline

**Files:**
- Create: `app/api/yt-beat/route.ts`

No unit tests (pure I/O); verified manually with curl after the dev server is running.

- [ ] **Step 1: Create `app/api/yt-beat/route.ts`**

```ts
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
      '-t', '60',               // analyse first 60 s only for speed
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Smoke-test with curl (dev server must be running: `npm run dev`)**

```bash
# Invalid URL → 400
curl -s -X POST http://localhost:3000/api/yt-beat \
  -H 'content-type: application/json' \
  -d '{"url":"https://vimeo.com/123"}' | jq
# Expected: {"error":"invalid-url"}

# Missing body → 400
curl -s -X POST http://localhost:3000/api/yt-beat \
  -H 'content-type: application/json' \
  -d '{}' | jq
# Expected: {"error":"invalid-url"}

# yt-dlp not installed → 500 ytdlp-not-found
# (only if yt-dlp is missing; skip this check if it's installed)
```

- [ ] **Step 4: Commit**

```bash
git add app/api/yt-beat/route.ts
git commit -m "feat(api): POST /api/yt-beat — yt-dlp download + BPM detection"
```

---

### Task 3: `GET /api/yt-audio/[id]` — stream temp MP3

**Files:**
- Create: `app/api/yt-audio/[id]/route.ts`

- [ ] **Step 1: Create the file**

```ts
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  // Only serve ids produced by hashUrl (12 lowercase hex chars)
  if (!/^[0-9a-f]{12}$/.test(id)) {
    return new Response('Not found', { status: 404 });
  }
  const filepath = join('/tmp', `rhyme-game-yt-${id}.mp3`);
  if (!existsSync(filepath)) {
    return new Response('Not found', { status: 404 });
  }
  const stat = statSync(filepath);
  const data = readFileSync(filepath);
  return new Response(data, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(stat.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Smoke-test with curl**

```bash
# Invalid id → 404
curl -I http://localhost:3000/api/yt-audio/notvalidhex
# Expected: HTTP 404

# After a successful POST /api/yt-beat, get the id from the response,
# then verify streaming:
# curl -I http://localhost:3000/api/yt-audio/<12-char-id>
# Expected: HTTP 200, Content-Type: audio/mpeg
```

- [ ] **Step 4: Commit**

```bash
git add app/api/yt-audio/
git commit -m "feat(api): GET /api/yt-audio/[id] — stream temp MP3"
```

---

### Task 4: Refactor `onPlay` to pass `Beat` directly

**Files:**
- Modify: `components/Game.tsx`
- Modify: `components/Setup.tsx`

Pure refactor — no new UI. Goal: `Setup` resolves a `Beat` before calling `onPlay`; `Game` holds `activeBeat: Beat | null` instead of `beatId: string | null`, dropping the `pickBeat` call inside `Game`.

- [ ] **Step 1: Update `components/Game.tsx`**

Replace the entire file with the updated version below. Key changes:
- `beatId` state → `activeBeat: Beat | null`
- Remove `const beat = pickBeat(beatId ?? undefined)` — use `activeBeat` directly
- `handlePlay(id, lang)` → `handlePlay(beat, lang)`
- `<Setup initialBeatId={activeBeat?.id ?? null} ...>`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BEATS } from '@/lib/beats';
import type { Beat } from '@/lib/beats';
import type { Bar } from '@/lib/flatten-bars';
import { DEFAULT_LANGUAGE, type LanguageId } from '@/lib/languages';
import { useBeat } from '@/hooks/useBeat';
import { useGameLoop } from '@/hooks/useGameLoop';
import { Setup } from './Setup';
import { WordGrid } from './WordGrid';
import { BouncingBall } from './BouncingBall';
import { EndScreen } from './EndScreen';

type Phase = 'setup' | 'loading' | 'playing' | 'ended';

export function Game() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('setup');
  const [activeBeat, setActiveBeat] = useState<Beat | null>(BEATS[0] ?? null);
  const [languageId, setLanguageId] = useState<LanguageId>(DEFAULT_LANGUAGE);
  const [bars, setBars] = useState<Bar[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const beatHandle = useBeat(activeBeat ?? undefined);

  const tick = useGameLoop({
    audio: phase === 'playing' ? beatHandle.audio : null,
    bpm: activeBeat?.bpm ?? 90,
    totalBars: bars.length,
    active: phase === 'playing',
    startOffset: activeBeat?.startOffset ?? 0,
    onEnd: () => {
      beatHandle.stop();
      setPhase('ended');
    },
  });

  useEffect(() => {
    if (phase !== 'loading' || !activeBeat) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/rhymes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ language: languageId }),
        });
        if (!res.ok) throw new Error('rhymes-failed');
        const json = await res.json();
        if (cancelled) return;
        setBars(json.bars);
        try {
          await beatHandle.play();
        } catch {
          throw new Error('audio-failed');
        }
        if (cancelled) return;
        setPhase('playing');
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error && err.message === 'audio-failed'
              ? "Couldn't play beat"
              : "Couldn't load rhymes"
          );
          setPhase('setup');
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  function handlePlay(beat: Beat, lang: LanguageId) {
    setActiveBeat(beat);
    setLanguageId(lang);
    setLoadError(null);
    setPhase('loading');
  }

  function quitToSetup() {
    beatHandle.stop();
    setPhase('setup');
  }

  if (phase === 'setup') {
    return (
      <>
        {loadError && (
          <div className="bg-rhyme-red/30 text-center py-2">{loadError}</div>
        )}
        <Setup
          initialBeatId={activeBeat?.id ?? null}
          initialLanguageId={languageId}
          onPlay={handlePlay}
          onLogout={logout}
        />
      </>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-xl">
        Loading…
      </div>
    );
  }

  if (phase === 'ended') {
    return (
      <EndScreen
        onPlayAgain={() => setPhase('loading')}
        onChangeBeat={() => setPhase('setup')}
      />
    );
  }

  // playing
  return (
    <main className="min-h-screen p-4 flex flex-col">
      <div className="flex justify-between mb-2">
        <button onClick={() => {
          if (confirm('End session?')) quitToSetup();
        }} aria-label="Quit" className="text-white/70 text-xl">←</button>
        <div className="text-white/60 text-sm">
          {activeBeat?.title} · {activeBeat?.bpm.toFixed(1)} BPM
        </div>
      </div>
      <BouncingBall x={tick.ballX} yDip={tick.ballYDip} />
      <div className="mt-4 mx-auto w-full max-w-md">
        <WordGrid bars={bars} activeRow={tick.currentBar} ballX={tick.ballX} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Update `components/Setup.tsx` — change `onPlay` signature only**

Change the Props type and the PLAY button handler. Do NOT add the YouTube UI yet (that is Task 5).

```tsx
'use client';

import { useEffect, useState } from 'react';
import { BEATS, pickBeat } from '@/lib/beats';
import type { Beat } from '@/lib/beats';
import { LANGUAGES, type LanguageId } from '@/lib/languages';
import { loadLanguage, saveLanguage } from '@/lib/language-storage';
import { BeatPicker } from './BeatPicker';
import { LanguagePicker } from './LanguagePicker';

type Props = {
  initialBeatId: string | null;
  initialLanguageId: LanguageId;
  onPlay: (beat: Beat, languageId: LanguageId) => void;
  onLogout: () => void;
};

export function Setup({ initialBeatId, initialLanguageId, onPlay, onLogout }: Props) {
  const [beatId, setBeatId] = useState<string | null>(initialBeatId ?? BEATS[0]?.id ?? null);
  const [languageId, setLanguageId] = useState<LanguageId>(initialLanguageId);
  const canPlay = beatId !== null;

  useEffect(() => {
    const resolved = loadLanguage();
    if (resolved !== languageId) setLanguageId(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function chooseLanguage(id: LanguageId) {
    setLanguageId(id);
    saveLanguage(id);
  }

  return (
    <main className="flex min-h-screen flex-col p-6">
      <div className="flex justify-end">
        <button onClick={onLogout} className="text-white/60 hover:text-white">Log out</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <h1 className="text-4xl font-extrabold">The Rhyme Game</h1>
        <button
          onClick={() => {
            const beat = beatId ? pickBeat(beatId) : undefined;
            if (beat) onPlay(beat, languageId);
          }}
          disabled={!canPlay}
          className="rounded-2xl bg-rhyme-yellow px-12 py-5 text-3xl font-extrabold text-bg disabled:opacity-50"
        >
          PLAY
        </button>
        <div className="w-full max-w-sm space-y-3">
          <BeatPicker beats={BEATS} selectedId={beatId} onChange={setBeatId} />
          <LanguagePicker
            languages={LANGUAGES}
            selectedId={languageId}
            onChange={chooseLanguage}
          />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles with no errors**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Smoke-test in browser**

Start `npm run dev`, open `http://localhost:3000`, pick a beat from the list, press PLAY. Verify the game starts. Verify "End session?" quit works.

- [ ] **Step 5: Commit**

```bash
git add components/Game.tsx components/Setup.tsx
git commit -m "refactor: onPlay passes Beat directly instead of beatId string"
```

---

### Task 5: YouTube URL input in `components/Setup.tsx`

**Files:**
- Modify: `components/Setup.tsx`

- [ ] **Step 1: Replace the full file with the version below**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { BEATS, pickBeat } from '@/lib/beats';
import type { Beat } from '@/lib/beats';
import { LANGUAGES, type LanguageId } from '@/lib/languages';
import { loadLanguage, saveLanguage } from '@/lib/language-storage';
import { isYouTubeUrl } from '@/lib/yt-beat';
import { BeatPicker } from './BeatPicker';
import { LanguagePicker } from './LanguagePicker';

type YtState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; beat: Beat; bpmFallback?: boolean }
  | { status: 'error'; message: string };

type Props = {
  initialBeatId: string | null;
  initialLanguageId: LanguageId;
  onPlay: (beat: Beat, languageId: LanguageId) => void;
  onLogout: () => void;
};

export function Setup({ initialBeatId, initialLanguageId, onPlay, onLogout }: Props) {
  const [beatId, setBeatId] = useState<string | null>(initialBeatId ?? BEATS[0]?.id ?? null);
  const [languageId, setLanguageId] = useState<LanguageId>(initialLanguageId);
  const [ytUrl, setYtUrl] = useState('');
  const [ytState, setYtState] = useState<YtState>({ status: 'idle' });

  useEffect(() => {
    const resolved = loadLanguage();
    if (resolved !== languageId) setLanguageId(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function chooseLanguage(id: LanguageId) {
    setLanguageId(id);
    saveLanguage(id);
  }

  // Picking from BeatPicker clears any loaded YT beat.
  function chooseBeat(id: string | null) {
    setBeatId(id);
    setYtUrl('');
    setYtState({ status: 'idle' });
  }

  async function loadYtBeat() {
    setYtState({ status: 'loading' });
    try {
      const res = await fetch('/api/yt-beat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: ytUrl }),
      });
      const json = await res.json();
      if (!res.ok) {
        const message =
          json.error === 'ytdlp-not-found' ? 'yt-dlp is not installed on this server' :
          json.error === 'invalid-url'      ? 'Not a valid YouTube URL' :
          json.error === 'download-failed'  ? `Download failed: ${json.detail ?? ''}` :
          'Failed to load beat';
        setYtState({ status: 'error', message });
        return;
      }
      const beat: Beat = {
        id: json.id,
        src: json.src,
        title: json.title,
        bpm: json.bpm,
        barsPerLoop: json.barsPerLoop,
        category: 'other',
      };
      // Loading a YT beat deselects the BeatPicker.
      setBeatId(null);
      setYtState({ status: 'loaded', beat, bpmFallback: json.bpmFallback });
    } catch {
      setYtState({ status: 'error', message: 'Network error' });
    }
  }

  // The beat that will be played: YT beat takes priority, then BeatPicker selection.
  const activeBeat: Beat | null =
    ytState.status === 'loaded' ? ytState.beat :
    beatId ? (pickBeat(beatId) ?? null) : null;

  const canLoad = ytState.status !== 'loading' && isYouTubeUrl(ytUrl);
  const canPlay = activeBeat !== null;

  return (
    <main className="flex min-h-screen flex-col p-6">
      <div className="flex justify-end">
        <button onClick={onLogout} className="text-white/60 hover:text-white">Log out</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <h1 className="text-4xl font-extrabold">The Rhyme Game</h1>
        <button
          onClick={() => activeBeat && onPlay(activeBeat, languageId)}
          disabled={!canPlay}
          className="rounded-2xl bg-rhyme-yellow px-12 py-5 text-3xl font-extrabold text-bg disabled:opacity-50"
        >
          PLAY
        </button>
        <div className="w-full max-w-sm space-y-3">
          <BeatPicker beats={BEATS} selectedId={beatId} onChange={chooseBeat} />

          <div className="space-y-1">
            {ytState.status === 'loaded' ? (
              <div className="flex items-center justify-between rounded-xl bg-white/10 px-3 py-2 text-sm">
                <span className="truncate">
                  {ytState.beat.title} · {ytState.beat.bpm} BPM
                  {ytState.bpmFallback && ' (BPM ~90, auto-detect failed)'}
                </span>
                <button
                  onClick={() => { setYtUrl(''); setYtState({ status: 'idle' }); }}
                  className="ml-2 shrink-0 text-white/60 hover:text-white"
                  aria-label="Clear YouTube beat"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="YouTube URL"
                  value={ytUrl}
                  onChange={e => {
                    setYtUrl(e.target.value);
                    setYtState({ status: 'idle' });
                  }}
                  className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm placeholder:text-white/40 outline-none"
                />
                <button
                  onClick={loadYtBeat}
                  disabled={!canLoad}
                  className="rounded-xl bg-white/20 px-3 py-2 text-sm disabled:opacity-40"
                >
                  {ytState.status === 'loading' ? '…' : 'Load'}
                </button>
              </div>
            )}
            {ytState.status === 'error' && (
              <p className="text-xs text-red-400">{ytState.message}</p>
            )}
          </div>

          <LanguagePicker
            languages={LANGUAGES}
            selectedId={languageId}
            onChange={chooseLanguage}
          />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```
Expected: all existing tests pass (no regressions)

- [ ] **Step 4: Manual end-to-end test in the browser**

Start `npm run dev`. Open `http://localhost:3000`.

Checklist:
- [ ] YouTube URL input appears below BeatPicker
- [ ] `Load` button is disabled when the input is empty
- [ ] `Load` button is disabled for a non-YouTube URL (e.g. `https://vimeo.com/123`)
- [ ] `Load` button becomes active when a valid YouTube URL is typed
- [ ] Clicking `Load` shows the `…` spinner and disables the input
- [ ] After loading, the pill shows `<title> · <bpm> BPM` and the BeatPicker has no selection
- [ ] PLAY starts the game with the YouTube audio
- [ ] Clicking ✕ on the pill clears it
- [ ] Picking a beat from BeatPicker while a YT beat is loaded clears the YT state

- [ ] **Step 5: Commit**

```bash
git add components/Setup.tsx
git commit -m "feat(ui): YouTube URL input in Setup screen"
```

---

## Prerequisites

Before starting implementation, verify `yt-dlp` is installed:

```bash
yt-dlp --version
# If not installed:
pip install yt-dlp
# or: sudo apt install yt-dlp
```
