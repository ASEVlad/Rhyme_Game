# YouTube Beat Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Downloaded YouTube beats appear in BeatPicker alongside static beats, with LLM-generated clean titles, inline genre detection, and a "YouTube" filter chip; catalog persists as `public/beats/yt-catalog.json`.

**Architecture:** The route writes every new YT beat into a JSON catalog file immediately after download; Setup fetches that file on mount and merges it with the static BEATS array; BeatPicker grows a `'youtube'` pseudo-category chip that filters by `source` field rather than `category`. The `.txt` title sidecar is replaced entirely by the catalog; KEEP_N raised to 200.

**Tech Stack:** Next.js 14 App Router, TypeScript, React, Anthropic SDK (claude-haiku-4-5-20251001), vitest

---

## File Map

| File | Change |
|------|--------|
| `lib/beats.ts` | Add `source?: 'youtube'` to `Beat` type |
| `.gitignore` | Add `public/beats/yt-catalog.json` |
| `components/BeatPicker.tsx` | `availableCategories` returns `Array<BeatCategory \| 'youtube'>`, `activeCat` type extended, filter handles `'youtube'` |
| `components/BeatPicker.test.tsx` | Add tests for YouTube chip and filter behaviour |
| `components/Setup.tsx` | Fetch `yt-catalog.json` on mount, merge with BEATS, re-fetch after `loadYtBeat` |
| `app/api/yt-beat/route.ts` | Add early-return on catalog hit, description fetch, inline genre+title LLM calls, catalog read/write/cleanup; remove `.txt` sidecar |

---

## Task 1: Beat type + .gitignore

**Files:**
- Modify: `lib/beats.ts:9-17`
- Modify: `.gitignore`

- [ ] **Step 1: Add `source` field to Beat type**

Open `lib/beats.ts`. Replace the `Beat` type (lines 9–17):

```ts
export type Beat = {
  id: string;
  src: string;
  title: string;
  bpm: number;
  barsPerLoop: number;
  startOffset?: number;  // seconds before beat 1; omit or 0 = file starts on beat 1
  category: BeatCategory;
  source?: 'youtube';    // present only for YT-downloaded beats
};
```

No other changes to `lib/beats.ts` — `BEATS`, `pickBeat` stay identical.

- [ ] **Step 2: Add catalog file to .gitignore**

Append to `.gitignore`:

```
public/beats/yt-catalog.json
```

The existing lines `public/beats/yt-*.mp3` and `public/beats/yt-*.txt` stay.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors (the new optional field is backward-compatible with all existing Beat literals).

- [ ] **Step 4: Commit**

```bash
git add lib/beats.ts .gitignore
git commit -m "feat: add source field to Beat type, gitignore yt-catalog.json"
```

---

## Task 2: BeatPicker YouTube chip

**Files:**
- Modify: `components/BeatPicker.tsx`
- Modify: `components/BeatPicker.test.tsx`

- [ ] **Step 1: Write failing tests for YouTube chip**

Open `components/BeatPicker.test.tsx`. Add the following tests **after** the existing `describe('availableCategories', ...)` block:

```ts
// --- Task 2 additions ---

const ytBeat: Beat = {
  id: 'yt-abc',
  src: '/beats/yt-abc.mp3',
  title: 'Dark Vibes',
  bpm: 90,
  barsPerLoop: 64,
  category: 'boom-bap',
  source: 'youtube',
};

describe('availableCategories with YouTube beats', () => {
  it('appends youtube chip when any beat has source === youtube', () => {
    const result = availableCategories([boomBap, ytBeat]);
    expect(result).toContain('youtube');
    expect(result[result.length - 1]).toBe('youtube');
  });

  it('does not append youtube chip when no beat has source', () => {
    const result = availableCategories([boomBap, trap]);
    expect(result).not.toContain('youtube');
  });

  it('includes the genre category of a YT beat as well as youtube', () => {
    // ytBeat has category 'boom-bap' and source 'youtube'; both chips should appear
    const result = availableCategories([ytBeat]);
    expect(result).toContain('boom-bap');
    expect(result).toContain('youtube');
  });

  it('returns youtube only once even with multiple YT beats', () => {
    const ytBeat2: Beat = { ...ytBeat, id: 'yt-def', category: 'trap' };
    const result = availableCategories([ytBeat, ytBeat2]);
    expect(result.filter(c => c === 'youtube')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run components/BeatPicker.test.tsx`
Expected: 4 new tests FAIL because `availableCategories` still returns `BeatCategory[]` and doesn't know about `source`.

- [ ] **Step 3: Update `availableCategories` signature and implementation**

In `components/BeatPicker.tsx`, replace the `availableCategories` function (lines 13–20):

```ts
export function availableCategories(beats: Beat[]): Array<BeatCategory | 'youtube'> {
  const cats = Array.from(new Set(beats.map(b => b.category))) as Array<BeatCategory | 'youtube'>;
  if (beats.some(b => b.source === 'youtube')) cats.push('youtube');
  return cats;
}
```

- [ ] **Step 4: Extend `activeCat` state type and filter logic**

In `components/BeatPicker.tsx`, update `BeatPicker`:

Replace the `activeCat` state line (currently `BeatCategory | 'all'`):

```ts
const [activeCat, setActiveCat] = useState<BeatCategory | 'youtube' | 'all'>('all');
```

Replace the `rawFiltered` line:

```ts
const rawFiltered =
  activeCat === 'all'     ? beats :
  activeCat === 'youtube' ? beats.filter(b => b.source === 'youtube') :
                            beats.filter(b => b.category === activeCat);
```

Replace the `handleCatChange` function body:

```ts
function handleCatChange(cat: BeatCategory | 'youtube' | 'all') {
  setActiveCat(cat);
  const newFiltered =
    cat === 'all'     ? beats :
    cat === 'youtube' ? beats.filter(b => b.source === 'youtube') :
                        beats.filter(b => b.category === cat);
  if (newFiltered.length > 0 && !newFiltered.find(b => b.id === selectedId)) {
    onChange(newFiltered[0].id);
  }
}
```

Replace the chip render label: the chip for `'youtube'` must display `"YouTube"` (capital Y). Update the `{cats.map(cat => ...)}` chip label:

```tsx
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
    {cat === 'youtube' ? 'YouTube' : cat}
  </button>
))}
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `npx vitest run components/BeatPicker.test.tsx`
Expected: all tests PASS (original 5 plus 4 new = 9 passing).

- [ ] **Step 6: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/BeatPicker.tsx components/BeatPicker.test.tsx
git commit -m "feat: BeatPicker YouTube chip and filter"
```

---

## Task 3: Setup catalog merge

**Files:**
- Modify: `components/Setup.tsx`

- [ ] **Step 1: Add ytBeats state and catalog fetch effect**

In `components/Setup.tsx`, add `ytBeats` state and a `useEffect` to fetch the catalog. Insert after the existing `useState` declarations (after line 33 `const [ytState, setYtState] = ...`):

```ts
const [ytBeats, setYtBeats] = useState<Beat[]>([]);

const fetchCatalog = () => {
  fetch('/beats/yt-catalog.json')
    .then(r => r.ok ? r.json() : [])
    .then((data: Beat[]) => setYtBeats(data))
    .catch(() => {});
};

useEffect(() => {
  fetchCatalog();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 2: Merge ytBeats into allBeats and pass to BeatPicker**

Add `allBeats` constant (insert just before the `return` statement):

```ts
const allBeats = [...BEATS, ...ytBeats];
```

Replace the `<BeatPicker beats={BEATS} ...>` prop (line 110):

```tsx
<BeatPicker beats={allBeats} selectedId={beatId} onChange={chooseBeat} />
```

- [ ] **Step 3: Re-fetch catalog after successful YT load**

In the `loadYtBeat` function, after `setYtState({ status: 'loaded', beat, bpmFallback: json.bpmFallback });` (currently the last statement in the try block), add:

```ts
fetchCatalog();
```

So the end of the try block looks like:

```ts
setBeatId(null);
setYtState({ status: 'loaded', beat, bpmFallback: json.bpmFallback });
fetchCatalog();
```

- [ ] **Step 4: Update Beat construction in loadYtBeat to include source**

The Beat built from the API response should include `source: 'youtube'` since the route now returns it. Replace the beat construction in `loadYtBeat`:

```ts
const beat: Beat = {
  id: json.id,
  src: json.src,
  title: json.title,
  bpm: json.bpm,
  barsPerLoop: json.barsPerLoop,
  category: json.category ?? 'other',
  ...(json.source === 'youtube' && { source: 'youtube' as const }),
};
```

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add components/Setup.tsx
git commit -m "feat: Setup fetches yt-catalog.json and merges into BeatPicker"
```

---

## Task 4: Route catalog pipeline

This task replaces the entire `app/api/yt-beat/route.ts`. It:
- Adds `readCatalog` / `writeCatalog` helpers
- Adds inline `detectGenre` and `generateTitle` async functions using Anthropic SDK
- Replaces the `yt-dlp --print title` call with a `--print %(title)s --print %(description)s` call
- Adds early-return when ID already in catalog
- Writes/prepends to catalog after download
- Removes `titlePath()` and the `.txt` sidecar read/write
- Removes the old `cleanupOldBeats()` file-scan function
- Raises `KEEP_N` to `200`

**Files:**
- Modify: `app/api/yt-beat/route.ts`

- [ ] **Step 1: Replace route.ts with the full new implementation**

Write the complete file `app/api/yt-beat/route.ts`:

```ts
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
      max_tokens: 30,
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
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: all tests pass (route unit tests in `lib/yt-beat.test.ts` + BeatPicker tests all green).

- [ ] **Step 4: Commit**

```bash
git add app/api/yt-beat/route.ts
git commit -m "feat: yt-beat catalog pipeline with LLM title+genre, early return, KEEP_N=200"
```

---

## Task 5: End-to-end smoke test

No code changes — verify the full feature works in the browser.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (port 3000)

- [ ] **Step 2: Verify catalog fetch on load**

Open `http://localhost:3000`. Open browser DevTools → Network tab. Filter for `yt-catalog.json`. Confirm a GET request fires on page load and returns either `200` with a JSON array or `404` (graceful — no console error).

- [ ] **Step 3: Submit a YouTube URL**

Paste a valid YouTube beat URL into the URL input. Click Load. Confirm:
- Spinner appears, button shows "…"
- After completion, the loaded pill shows `<LLM title> · <BPM> BPM`
- The BeatPicker now includes the newly downloaded beat

- [ ] **Step 4: Confirm YouTube chip appears**

After a YT beat loads, verify the BeatPicker shows a "YouTube" chip. Click it. Confirm only YT beats are shown.

- [ ] **Step 5: Submit the same URL a second time**

Paste the same URL again, click Load. Confirm it returns immediately (catalog cache hit, no re-download).

- [ ] **Step 6: Verify catalog file written**

Check `public/beats/yt-catalog.json` exists and contains the downloaded beat with `"source": "youtube"`, an LLM-generated title, and a genre category other than (or possibly) `"other"`.

- [ ] **Step 7: Reload the page**

Refresh `http://localhost:3000`. Confirm the YT beat still appears in BeatPicker (catalog loaded from disk on mount).
