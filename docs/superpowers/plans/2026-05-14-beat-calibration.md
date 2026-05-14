# Beat Calibration & Category System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add genre categories and start-offset calibration to the beats system, with a `/calibrate` dev page that auto-detects BPM, suggests category via Claude, and lets the user mark beat 1.

**Architecture:** `BeatCategory` and `startOffset?` are added to `lib/beats.ts`; `makeSessionTimer` gains a `startOffset` default param; a new `/calibrate` client page uses Web Audio API + `music-tempo` for BPM detection and calls a new `/api/analyze-beat` route for Claude category suggestion; `BeatPicker` gains category chip filtering.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, `music-tempo` npm package, Anthropic SDK (already installed), Vitest.

---

## File map

| File | Action | Purpose |
|---|---|---|
| `lib/beats.ts` | modify | Add `BeatCategory` type, `startOffset?` + `category` to `Beat`, update `click-90` |
| `lib/session-time.ts` | modify | Add `startOffset` param to `makeSessionTimer` |
| `lib/session-time.test.ts` | modify | Add `startOffset` tests |
| `hooks/useGameLoop.ts` | modify | Accept + pass `startOffset` to `makeSessionTimer` |
| `components/Game.tsx` | modify | Pass `beat.startOffset ?? 0` to `useGameLoop` |
| `components/BeatPicker.tsx` | modify | Add category chip row + filtered navigation |
| `app/calibrate/page.tsx` | create | Calibration UI client component |
| `app/api/analyze-beat/route.ts` | create | Claude category suggestion endpoint |
| `package.json` | modify | Add `music-tempo` |

---

## Task 1: Data model — add `BeatCategory` and update `Beat`

**Files:**
- Modify: `lib/beats.ts`

- [ ] **Step 1: Update `lib/beats.ts`**

Replace the entire file:

```ts
export type BeatCategory =
  | 'boom-bap'
  | 'trap'
  | 'jazz'
  | 'lo-fi'
  | 'drill'
  | 'other';

export type Beat = {
  id: string;
  src: string;
  title: string;
  bpm: number;
  barsPerLoop: number;
  startOffset?: number;  // seconds before beat 1; omit or 0 = file starts on beat 1
  category: BeatCategory;
};

export const BEATS: Beat[] = [
  {
    id: 'click-90',
    src: '/beats/click-90.wav',
    title: 'Click 90',
    bpm: 90,
    barsPerLoop: 8,
    category: 'other',
  },
];

export function pickBeat(id: string | undefined): Beat | undefined {
  if (!id) return BEATS[0];
  return BEATS.find((b) => b.id === id) ?? BEATS[0];
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. TypeScript will surface any consumers that need updating.

- [ ] **Step 3: Commit**

```bash
git add lib/beats.ts
git commit -m "feat(beats): add BeatCategory type and startOffset/category fields"
```

---

## Task 2: `makeSessionTimer` with `startOffset`

**Files:**
- Modify: `lib/session-time.ts`
- Modify: `lib/session-time.test.ts`

- [ ] **Step 1: Write failing tests**

Add these two tests to `lib/session-time.test.ts`, inside the existing `describe` block after the last test:

```ts
  it('holds session time at 0 during the silent prefix when startOffset is set', () => {
    const a = fakeAudio(0, 30);
    const sessionTime = makeSessionTimer(a, 0.5);
    a.currentTime = 0.3; // still in the silent prefix
    expect(sessionTime()).toBe(0); // clamped
  });

  it('counts from 0 once currentTime exceeds startOffset', () => {
    const a = fakeAudio(0, 30);
    const sessionTime = makeSessionTimer(a, 0.5);
    a.currentTime = 0.8;
    expect(sessionTime()).toBeCloseTo(0.3);
  });
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run lib/session-time.test.ts
```

Expected: 2 failures (function does not yet accept `startOffset`).

- [ ] **Step 3: Update `lib/session-time.ts`**

Replace the entire file:

```ts
export type AudioLike = { currentTime: number; duration: number };

export function makeSessionTimer(audio: AudioLike, startOffset = 0): () => number {
  let loops = 0;
  let lastT = audio.currentTime;
  return () => {
    const t = audio.currentTime;
    // Treat a drop of more than half a second as a wraparound; smaller drops are jitter.
    if (t < lastT - 0.5) loops += 1;
    lastT = t;
    const dur = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    return Math.max(0, loops * dur + t - startOffset);
  };
}
```

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: all 6 `session-time` tests pass, all other tests unchanged.

- [ ] **Step 5: Commit**

```bash
git add lib/session-time.ts lib/session-time.test.ts
git commit -m "feat(session-time): add startOffset param to makeSessionTimer"
```

---

## Task 3: Thread `startOffset` through the game loop

**Files:**
- Modify: `hooks/useGameLoop.ts` (lines 13–20)
- Modify: `components/Game.tsx` (lines 26–35)

- [ ] **Step 1: Update `useGameLoop` args and pass `startOffset` to `makeSessionTimer`**

In `hooks/useGameLoop.ts`, change the args type and the `makeSessionTimer` call:

```ts
export function useGameLoop(args: {
  audio: HTMLAudioElement | null;
  bpm: number;
  totalBars: number;
  active: boolean;
  onEnd: () => void;
  startOffset?: number;
}): GameTick {
  const { audio, bpm, totalBars, active, onEnd, startOffset = 0 } = args;
```

And change the `makeSessionTimer` call inside the effect (currently `makeSessionTimer(audio)`) to:

```ts
const sessionTime = makeSessionTimer(audio, startOffset);
```

- [ ] **Step 2: Pass `startOffset` from `Game.tsx`**

In `components/Game.tsx`, update the `useGameLoop` call to include `startOffset`:

```ts
  const tick = useGameLoop({
    audio: phase === 'playing' ? beatHandle.audio : null,
    bpm: beat?.bpm ?? 90,
    totalBars: bars.length,
    active: phase === 'playing',
    startOffset: beat?.startOffset ?? 0,
    onEnd: () => {
      beatHandle.stop();
      setPhase('ended');
    },
  });
```

- [ ] **Step 3: Type-check and run tests**

```bash
npx tsc --noEmit && npx vitest run
```

Expected: no type errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add hooks/useGameLoop.ts components/Game.tsx
git commit -m "feat(game): thread startOffset through useGameLoop into makeSessionTimer"
```

---

## Task 4: BeatPicker category chips

**Files:**
- Modify: `components/BeatPicker.tsx`

- [ ] **Step 1: Rewrite `BeatPicker.tsx`**

Replace the entire file:

```tsx
'use client';

import { useState } from 'react';
import type { Beat, BeatCategory } from '@/lib/beats';

type Props = {
  beats: Beat[];
  selectedId: string | null;
  onChange: (id: string) => void;
};

// Derives ordered unique categories present in the beats array.
function availableCategories(beats: Beat[]): BeatCategory[] {
  const seen = new Set<BeatCategory>();
  const result: BeatCategory[] = [];
  for (const b of beats) {
    if (!seen.has(b.category)) { seen.add(b.category); result.push(b.category); }
  }
  return result;
}

export function BeatPicker({ beats, selectedId, onChange }: Props) {
  const [activeCat, setActiveCat] = useState<BeatCategory | 'all'>('all');

  if (beats.length === 0) {
    return <div className="text-white/60 text-center">Біти ще не додано</div>;
  }

  const cats = availableCategories(beats);
  const filtered = activeCat === 'all' ? beats : beats.filter(b => b.category === activeCat);

  function handleCatChange(cat: BeatCategory | 'all') {
    setActiveCat(cat);
    const newFiltered = cat === 'all' ? beats : beats.filter(b => b.category === cat);
    if (newFiltered.length > 0 && !newFiltered.find(b => b.id === selectedId)) {
      onChange(newFiltered[0].id);
    }
  }

  const idx = Math.max(0, filtered.findIndex(b => b.id === selectedId));
  const current = filtered[idx] ?? filtered[0];
  const prev = () => onChange(filtered[(idx - 1 + filtered.length) % filtered.length].id);
  const next = () => onChange(filtered[(idx + 1) % filtered.length].id);

  return (
    <div className="flex flex-col gap-2">
      {cats.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleCatChange('all')}
            className={[
              'rounded-full px-3 py-1 text-xs font-bold',
              activeCat === 'all'
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-white/40',
            ].join(' ')}
          >
            All
          </button>
          {cats.map(cat => (
            <button
              key={cat}
              onClick={() => handleCatChange(cat)}
              className={[
                'rounded-full px-3 py-1 text-xs font-bold',
                activeCat === cat
                  ? 'bg-rhyme-yellow/20 text-rhyme-yellow border border-rhyme-yellow'
                  : 'bg-white/5 text-white/40',
              ].join(' ')}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-3">
        <button onClick={prev} aria-label="Попередній біт"
                className="h-10 w-10 rounded-full bg-white/10 text-xl">◀</button>
        <div className="text-center">
          <div className="font-bold">{current.title}</div>
          <div className="text-white/60 text-sm">
            {Number.isInteger(current.bpm) ? current.bpm : current.bpm.toFixed(1)} BPM
          </div>
        </div>
        <button onClick={next} aria-label="Наступний біт"
                className="h-10 w-10 rounded-full bg-white/10 text-xl">▶</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify chips are hidden when only one category**

The chip row only renders when `cats.length > 1`. With only `click-90` (category `'other'`), the picker looks identical to before — no regression.

- [ ] **Step 4: Commit**

```bash
git add components/BeatPicker.tsx
git commit -m "feat(beat-picker): add category chip filter row"
```

---

## Task 5: Install `music-tempo`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm install music-tempo
```

- [ ] **Step 2: Verify types are available**

```bash
npx tsc --noEmit
```

`music-tempo` ships its own types. If `tsc` reports `Could not find a declaration file for module 'music-tempo'`, create `music-tempo.d.ts` in the project root:

```ts
declare module 'music-tempo' {
  export default class MusicTempo {
    constructor(audioData: Float32Array, options?: Record<string, unknown>);
    tempo: number;
    beats: number[];
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add music-tempo for client-side BPM detection"
```

---

## Task 6: `/api/analyze-beat` route

**Files:**
- Create: `app/api/analyze-beat/route.ts`

- [ ] **Step 1: Create the route**

```ts
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
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const now = Date.now();
  const recent = (callsByIp.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= MAX_CALLS) {
    return NextResponse.json({ category: 'other' }, { status: 429 });
  }
  callsByIp.set(ip, [...recent, now]);

  const body = await req.json().catch(() => ({}));
  const { bpm, title } = body as { bpm?: unknown; title?: unknown };
  if (typeof bpm !== 'number' || typeof title !== 'string') {
    return NextResponse.json({ category: 'other' });
  }

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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/analyze-beat/route.ts
git commit -m "feat(api): add /api/analyze-beat Claude category suggestion endpoint"
```

---

## Task 7: Calibration page

**Files:**
- Create: `app/calibrate/page.tsx`

- [ ] **Step 1: Create `app/calibrate/page.tsx`**

```tsx
'use client';

import { useRef, useState } from 'react';
import type { BeatCategory } from '@/lib/beats';

const CATEGORIES: BeatCategory[] = ['boom-bap', 'trap', 'jazz', 'lo-fi', 'drill', 'other'];

export default function CalibratePage() {
  const [path, setPath] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bpm, setBpm] = useState<number | null>(null);
  const [category, setCategory] = useState<BeatCategory>('other');
  const [startOffset, setStartOffset] = useState(0);
  const [taps, setTaps] = useState<number[]>([]);
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function handleLoad() {
    if (!path) return;
    setLoaded(false);
    setLoading(true);
    setBpm(null);
    setTaps([]);
    setStartOffset(0);

    const src = '/' + path;
    const stem = path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'beat';
    setId(stem);
    setTitle(stem.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

    // Playback — HTMLAudioElement for loop play + currentTime reads
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(src);
    audio.loop = true;
    audio.play().catch(() => {});
    audioRef.current = audio;

    // Analysis — fetch → decodeAudioData → music-tempo (parallel to playback)
    try {
      const res = await fetch(src);
      const arrayBuffer = await res.arrayBuffer();
      const audioCtx = new AudioContext();
      const buffer = await audioCtx.decodeAudioData(arrayBuffer);
      // Dynamic import keeps music-tempo out of the main game bundle
      const MusicTempo = (await import('music-tempo')).default;
      const mt = new MusicTempo(buffer.getChannelData(0));
      const detectedBpm = Math.round(mt.tempo * 10) / 10;
      setBpm(detectedBpm);

      // Claude category suggestion
      const catRes = await fetch('/api/analyze-beat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bpm: detectedBpm, title: stem }),
      });
      if (catRes.ok) {
        const { category: suggested } = await catRes.json();
        if (CATEGORIES.includes(suggested)) setCategory(suggested);
      }
    } catch (e) {
      console.error('[calibrate] analysis failed', e);
    }

    setLoading(false);
    setLoaded(true);
  }

  function handleTap() {
    const now = Date.now();
    setTaps(prev => {
      const next = [...prev, now];
      if (next.length >= 2) {
        const intervals = next.slice(1).map((t, i) => t - next[i]);
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        setBpm(Math.round((60_000 / avg) * 10) / 10);
      }
      return next;
    });
  }

  function handleMark() {
    const t = audioRef.current?.currentTime ?? 0;
    setStartOffset(Math.round(t * 1000) / 1000);
  }

  const output = loaded && bpm !== null
    ? `{
  id: '${id}',
  src: '/${path}',
  title: '${title}',
  bpm: ${bpm},
  barsPerLoop: /* fill in */,
  startOffset: ${startOffset},
  category: '${category}',
},`
    : null;

  return (
    <main className="min-h-screen p-6 max-w-lg mx-auto space-y-8">
      <h1 className="text-2xl font-extrabold">Beat Calibration</h1>

      {/* Step 1 — Load */}
      <section className="space-y-2">
        <p className="text-sm text-white/50">Step 1 — enter path relative to <code>public/</code></p>
        <div className="flex gap-2">
          <input
            value={path}
            onChange={e => setPath(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLoad()}
            placeholder="beats/my-beat.mp3"
            className="flex-1 rounded-xl bg-white/10 px-4 py-2 text-sm outline-none focus:bg-white/15"
          />
          <button
            onClick={handleLoad}
            disabled={!path || loading}
            className="rounded-xl bg-rhyme-yellow text-bg px-4 py-2 font-bold text-sm disabled:opacity-50"
          >
            {loading ? '...' : 'Load'}
          </button>
        </div>
      </section>

      {loaded && (
        <>
          {/* Editable id / title */}
          <section className="flex gap-3">
            <div className="flex-1 space-y-1">
              <p className="text-xs text-white/40">ID</p>
              <input value={id} onChange={e => setId(e.target.value)}
                className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-xs text-white/40">Title</p>
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm outline-none" />
            </div>
          </section>

          {/* Step 2 — BPM */}
          <section className="space-y-3">
            <p className="text-sm text-white/50">
              Step 2 — BPM{bpm !== null ? `: ${bpm}` : ' — detecting…'}
            </p>
            <div className="flex items-center gap-4">
              <button onClick={handleTap}
                className="rounded-xl bg-rhyme-orange px-6 py-3 font-bold text-lg">
                TAP
              </button>
              <span className="text-sm text-white/40">
                {taps.length} tap{taps.length !== 1 ? 's' : ''}
                {taps.length > 0 && (
                  <button onClick={() => setTaps([])} className="ml-2 underline">reset</button>
                )}
              </span>
            </div>
          </section>

          {/* Step 3 — Category */}
          <section className="space-y-3">
            <p className="text-sm text-white/50">Step 3 — Category (Claude suggestion applied)</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={[
                    'rounded-full px-4 py-1 text-sm font-bold border',
                    category === cat
                      ? 'bg-rhyme-yellow/20 border-rhyme-yellow text-rhyme-yellow'
                      : 'bg-white/5 border-transparent text-white/40',
                  ].join(' ')}
                >
                  {cat}
                </button>
              ))}
            </div>
          </section>

          {/* Step 4 — Mark beat 1 */}
          <section className="space-y-3">
            <p className="text-sm text-white/50">
              Step 4 — Mark beat 1 (current offset: {startOffset}s)
            </p>
            <button onClick={handleMark}
              className="rounded-xl bg-rhyme-blue px-6 py-3 font-bold">
              ▼ MARK BEAT 1
            </button>
          </section>

          {/* Step 5 — Output */}
          {output && (
            <section className="space-y-2">
              <p className="text-sm text-white/50">Step 5 — Copy to <code>lib/beats.ts</code></p>
              <pre className="rounded-xl bg-black/40 p-4 text-xs text-green-300 overflow-auto whitespace-pre">
                {output}
              </pre>
              <button
                onClick={() => navigator.clipboard.writeText(output)}
                className="rounded-lg bg-white/10 px-4 py-2 text-sm"
              >
                Copy to clipboard
              </button>
            </section>
          )}
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If `music-tempo` types are missing, the `d.ts` from Task 5 resolves it.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass (calibration page has no unit tests — it is tested manually).

- [ ] **Step 4: Smoke test manually**

1. Start dev server: `npm run dev`
2. Log in, then navigate to `http://localhost:3000/calibrate`
3. Enter `beats/click-90.wav` and click Load
4. Verify BPM auto-fills (~90) and category suggestion appears
5. Click TAP 8+ times to beat — verify BPM updates
6. Click MARK BEAT 1 — verify offset shows
7. Verify the output block appears and Copy works
8. Paste the entry into `lib/beats.ts` BEATS array and verify the game plays without errors

- [ ] **Step 5: Commit**

```bash
git add app/calibrate/page.tsx
git commit -m "feat(calibrate): add beat calibration page with BPM detection and Claude category suggestion"
```
