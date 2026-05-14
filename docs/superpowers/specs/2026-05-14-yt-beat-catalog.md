# YouTube Beat Catalog Design

## Goal

Downloaded YouTube beats appear in the BeatPicker alongside static beats, with LLM-generated clean titles, LLM-detected genre categories, and a "YouTube" source chip for filtering. Catalog persists across restarts as a static JSON file.

## Data model

`Beat` in `lib/beats.ts` gains one optional field:

```ts
export type Beat = {
  id: string;
  src: string;
  title: string;
  bpm: number;
  barsPerLoop: number;
  startOffset?: number;
  category: BeatCategory;
  source?: 'youtube';   // present only for YT-downloaded beats
};
```

`BeatCategory` is unchanged — `'youtube'` is not a category. Genre chips (boom-bap, trap, etc.) work across both static and YT beats. The "YouTube" chip is separate, filtering by `source`.

## Catalog file

`public/beats/yt-catalog.json` — JSON array of `Beat` objects (with `source: 'youtube'`), sorted newest-first. Written and maintained exclusively by `POST /api/yt-beat`. Served as a plain static file; no new API endpoint needed.

```json
[
  {
    "id": "9f86d081884c",
    "src": "/beats/yt-9f86d081884c.mp3",
    "title": "Dark Boom Bap",
    "bpm": 90.1,
    "barsPerLoop": 64,
    "category": "boom-bap",
    "source": "youtube"
  }
]
```

If the file does not exist, Setup treats it as an empty array (graceful 404).

## `/api/yt-beat` pipeline changes

After BPM detection, three steps run before writing to the catalog:

### 1. Fetch YouTube metadata

Extend the existing `yt-dlp --print title` call to also fetch the description:

```bash
yt-dlp --print "%(title)s" --print "%(description)s" --no-download --no-playlist <url>
```

stdout is two lines: title on line 1, description on line 2 (may be multi-line; take first 500 chars total). Falls back to `('YouTube Beat', '')` on error.

### 2. Genre detection (inline)

Call Claude Haiku directly in the route (no HTTP round-trip to `/api/analyze-beat`) using the existing `beat_category` tool pattern:

- Input: `{ title: rawYtTitle, bpm }`
- Prompt: same as `analyze-beat` — "Given a beat titled X with BPM Y, suggest the most likely genre category."
- On error: fallback to `'other'`

### 3. Title generation (new)

Call Claude Haiku with a `beat_title` tool:

```ts
const TITLE_TOOL = {
  name: 'beat_title',
  description: 'Return a short clean title for a rap beat.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '2–5 words, no SEO filler' },
    },
    required: ['title'],
  },
};
```

Prompt:
```
Clean up this YouTube beat title into 2–5 words. 
Strip: FREE, SOLD, year numbers, "Type Beat", "Instrumental", "Rap Beats", pipe-separated suffixes, bracketed tags.
Keep: artist names (J Cole, Kendrick), mood words (dark, chill), genre words (boom bap, trap, jazz).
If the description adds useful mood/vibe info, use it.

YouTube title: {rawTitle}
Description (first 500 chars): {description}
BPM: {bpm}  Genre: {genre}
```

- `max_tokens: 30`
- On error: fall back to `rawTitle.slice(0, 80)` (same behaviour as before)

### 4. Catalog update

After a successful download (or on cache hit):

1. Read `yt-catalog.json` (empty array if missing).
2. Remove any existing entry with the same `id` (idempotent re-download).
3. Prepend the new Beat entry.
4. If length > 200: remove the last entries beyond 200; delete their `.mp3` and `.txt` files from disk.
5. Write the updated array back to `yt-catalog.json`.

Cleanup of the old `KEEP_N = 20` file-only logic is removed; catalog is now the source of truth for which files to keep.

## BeatPicker changes

`availableCategories` currently returns chip labels from `beat.category` values. Extend it to also return a `'youtube'` pseudo-category when any beat has `source === 'youtube'`:

```ts
export function availableCategories(beats: Beat[]): Array<BeatCategory | 'youtube'> {
  const cats = Array.from(new Set(beats.map(b => b.category))) as Array<BeatCategory | 'youtube'>;
  if (beats.some(b => b.source === 'youtube')) cats.push('youtube');
  return cats;
}
```

Filtering logic:
- `activeCat === 'youtube'` → show beats where `source === 'youtube'`
- Any other category → show beats where `category === activeCat` (includes YT beats with that genre)

BeatPicker's internal `activeCat` state changes type from `BeatCategory | 'all'` to `BeatCategory | 'youtube' | 'all'`. The chip label renders as `"YouTube"` (capitalised). `selectedId` and `onChange` props are unchanged.

## Setup changes

Add a `useEffect` to fetch `/beats/yt-catalog.json` on mount and merge with static `BEATS`:

```ts
const [ytBeats, setYtBeats] = useState<Beat[]>([]);

useEffect(() => {
  fetch('/beats/yt-catalog.json')
    .then(r => r.ok ? r.json() : [])
    .then(setYtBeats)
    .catch(() => {});
}, []);

const allBeats = [...BEATS, ...ytBeats];
```

Pass `allBeats` to `<BeatPicker>` instead of `BEATS`.

When a YT beat loads from the URL input, it is already in the catalog (the API just wrote it), so the catalog fetch would need to be re-triggered. Handle this by re-fetching the catalog after a successful `loadYtBeat` call.

## Files touched

| File | Change |
|------|--------|
| `lib/beats.ts` | Add `source?: 'youtube'` to `Beat` type |
| `app/api/yt-beat/route.ts` | Add description fetch, inline genre + title LLM calls, catalog read/write/cleanup |
| `components/BeatPicker.tsx` | Extend `availableCategories` + filter logic for `'youtube'` pseudo-chip |
| `components/BeatPicker.test.tsx` | Add tests for YouTube chip behaviour |
| `components/Setup.tsx` | Fetch `yt-catalog.json`, merge with BEATS, re-fetch after YT load |
| `public/beats/yt-catalog.json` | Created at runtime (not committed) |
| `.gitignore` | Add `public/beats/yt-catalog.json` |
