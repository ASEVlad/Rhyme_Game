# YouTube Beat Integration Design

## Goal

Let a player paste a YouTube URL in the Setup screen and use that video's audio as a beat, with BPM auto-detected server-side.

## Architecture

### Server: `/api/yt-beat` (POST)

Accepts `{ url: string }`. Pipeline:

1. Validate URL is a recognisable YouTube link (regex, not network call).
2. Derive a stable `id` by hashing the URL (first 12 chars of SHA-256 hex).
3. If `/tmp/rhyme-game-yt-<id>.mp3` already exists, skip download (cache hit).
4. Otherwise run `yt-dlp --extract-audio --audio-format mp3 --audio-quality 5 -o <path> <url>` via `execFileSync` with an array of arguments (no shell, handles special chars).
5. Detect BPM: decode first 60 s via `ffmpeg -t 60 -f f32le -ar 22050 -ac 1`, feed to `music-tempo`, apply halving correction (same logic as `scripts/calibrate-beats.mjs`).
6. If BPM detection throws, fall back to 90 and include `bpmFallback: true` in the response.
7. Compute `barsPerLoop` = nearest of [4, 8, 16, 32, 64] to `bpm * duration / 240`.
8. Cleanup: after a successful new download, delete all `/tmp/rhyme-game-yt-*.mp3` files except the 3 most-recently modified.
9. Return `{ id, title, bpm, barsPerLoop, bpmFallback?, src: '/api/yt-audio/<id>', category: 'other' }`. (`category` satisfies the `Beat` type; always `'other'` for YT tracks.)

Error responses:
- `400 { error: 'invalid-url' }` — not a YouTube URL
- `500 { error: 'ytdlp-not-found' }` — yt-dlp not on PATH
- `500 { error: 'download-failed', detail: string }` — yt-dlp exited non-zero
- `500 { error: 'bpm-detection-failed' }` — only if fallback is also impossible (should not happen)

### Server: `/api/yt-audio/[id]` (GET)

Reads `/tmp/rhyme-game-yt-<id>.mp3`. Returns the file as `audio/mpeg` with `Content-Length` and `Accept-Ranges: bytes` so the browser can seek and loop. Returns 404 if the file is not present (evicted).

### Client: Setup screen

Below the BeatPicker, add a YouTube URL section:

```
[ YouTube URL input field         ] [Load]
```

States:
- **Idle** — empty input, Load button disabled.
- **Loading** — spinner, input and Load disabled, "Downloading & analysing beat…" text.
- **Loaded** — input replaced by a pill showing `"<title> · <bpm> BPM"` with an ✕ to clear. If `bpmFallback` is true, pill also shows `"(BPM ~90, auto-detect failed)"`.
- **Error** — red text under the input describing what went wrong.

Mutual exclusivity: picking a beat from BeatPicker clears any loaded YT beat. Loading a YT beat deselects the BeatPicker selection (sets it to null).

### Game integration: `onPlay` signature change

Currently `Setup` passes `beatId: string` to `Game`, which resolves it via `pickBeat`. YouTube beats are not in the static array.

Change: `onPlay(beat: Beat, languageId: LanguageId)` — Setup resolves the Beat before calling it. `Game` holds `beat: Beat | null` instead of `beatId: string | null`. `pickBeat` is no longer called inside `Game`.

## Files touched

| File | Change |
|------|--------|
| `app/api/yt-beat/route.ts` | New — download + BPM pipeline |
| `app/api/yt-audio/[id]/route.ts` | New — file streaming |
| `components/Setup.tsx` | Add YT URL input, wire onPlay change |
| `components/Game.tsx` | Accept `Beat` directly, drop `pickBeat` call |
| `lib/beats.ts` | No change |

## Constraints

- `yt-dlp` must be installed on the server (`pip install yt-dlp` or system package).
- `ffmpeg` and `music-tempo` (npm) are already present.
- Both API routes run in the Node.js runtime (`export const runtime = 'nodejs'`).
- No auth changes needed — existing HMAC cookie covers these routes.
- The `/tmp` temp files are not committed to git.
