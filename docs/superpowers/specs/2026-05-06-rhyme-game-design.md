# Римова Гра — Design Spec

**Date:** 2026-05-06
**Status:** Approved (pending spec review)

## Summary

A Ukrainian-language web clone of [The Rhyme Game](https://creative-rhythm.com/)'s Classic mode: a freestyle-rap scaffolding tool. A beat plays, a ball bounces left→right across the four cells of each row in time with the four beats of a bar; the rightmost cell shows a Ukrainian target word, and the user is meant to land the last syllable of their freestyled bar on that cell — i.e. close the bar with a word that rhymes with the target. Rhymes are grouped by ending (color-coded) and generated fresh per session by an LLM call to Claude.

The app is single-user-pool gated by a shared password (so it isn't open to the world / doesn't burn API credit).

## Goals

- Replicate the core gameplay of The Rhyme Game's Classic mode (bouncing ball + scrolling word grid + beat).
- Localize to Ukrainian: UI text, word list, rhyme grouping rules.
- Generate fresh rhyme content per session via Claude API (no static word list to maintain).
- Keep deployment trivial: one Next.js repo on Vercel, three env vars, no database.

## Non-goals (out of scope for v1)

- Voice input, speech recognition, or rhyme-quality scoring.
- Audio recording or playback of the user's freestyle.
- Multiple difficulty levels (single difficulty).
- Multiple themes or an "advanced setup" word-picker screen.
- Real user accounts — only the shared password.
- Custom user-supplied word lists or beats.
- Mobile native apps.
- Social or sharing features.
- Localization beyond Ukrainian.

## Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Hosting:** Vercel (free tier)
- **LLM:** Anthropic Claude API via `@anthropic-ai/sdk`
- **Audio:** HTML5 `<audio>` element (Web Audio is a possible later upgrade if drift becomes noticeable)
- **Animation:** `requestAnimationFrame`, timed against `audio.currentTime` for sync
- **Font:** Manrope via Google Fonts (good Cyrillic coverage, geometric sans)

## Architecture

```
                     ┌─────────────────┐
                     │  middleware.ts  │  ← rejects unauth requests except
                     └────────┬────────┘     /login and /api/login
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
       ▼                      ▼                      ▼
  /login (page)          / (game page)         /api/rhymes
  /api/login            (Setup → Game)         (calls Claude,
  (verifies pwd,                                returns groups JSON)
   sets cookie)
```

**Auth model:** A signed cookie (HMAC-SHA256 over a fixed payload + expiry, signed with `AUTH_SECRET`). Cookie is httpOnly, SameSite=Lax, expires in 30 days. No DB; no per-user state.

**Game model:** Stateless. Each session fetches a fresh batch of rhyme groups from `/api/rhymes`, runs the game loop in the browser, and discards everything when done.

## Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/login` | GET | public | Render password input form |
| `/api/login` | POST | public | Verify `APP_PASSWORD`, set cookie, redirect to `/` |
| `/` | GET | required | Game shell (Setup → Game → End) |
| `/api/rhymes` | POST | required | Server-side Claude call; returns rhyme groups JSON |
| `/api/logout` | POST | required | Clear cookie, redirect to `/login` |

## Components

```
components/
  Setup.tsx        # "ГРАТИ" button + BeatPicker; entry screen
  Game.tsx         # orchestrates play state: setup → playing → ended
  WordGrid.tsx     # the 4×N visible grid (active row highlighted)
  BouncingBall.tsx # the ball + motion trail
  BeatPicker.tsx   # ◀ track name (BPM) ▶
  EndScreen.tsx    # "Гарна робота! / Грати знову / Інший біт"

hooks/
  useGameLoop.ts   # RAF loop; reads audio.currentTime; emits {currentBeat, currentBar, ballX, activeRow}
  useBeat.ts       # owns the <audio> element; play/pause/seek; reports currentTime, duration

lib/
  auth.ts          # signCookie(payload), verifyCookie(value): HMAC-SHA256
  rhymes.ts        # callClaudeForGroups(): Claude client + tool-use schema; on failure → fallbackGroups
  fallback-groups.ts # ~12 hand-written Ukrainian rhyme groups (safety net)
  beats.ts         # static metadata for bundled beats: { id, src, title, bpm }
  flatten-bars.ts  # turn rhyme groups into a sequence of {word, color} bars

public/
  beats/           # 8–10 royalty-free instrumental .mp3 loops
```

## Auth flow

1. User hits `/`. Middleware sees no cookie → redirects to `/login`.
2. `/login` shows a single password input + submit.
3. POST to `/api/login`:
   - Compare submitted password to `APP_PASSWORD` env var (constant-time compare).
   - On match: set cookie `auth=<base64(payload)>.<base64(hmac(payload))>` where payload includes an expiry timestamp. httpOnly, Secure (in prod), SameSite=Lax, 30-day Max-Age.
   - On mismatch: return 401 with a generic message; render error in form.
4. On subsequent requests, middleware:
   - Read `auth` cookie.
   - Split payload + sig; recompute HMAC with `AUTH_SECRET`; constant-time compare.
   - Check expiry. If valid → pass through; otherwise clear cookie and redirect to `/login`.

## Rhyme generation

**Endpoint:** `POST /api/rhymes`

**Request body:** none (or `{ count?: number }`, default 10).

**Server logic:**
1. Construct a prompt asking Claude for `count` rhyme groups suitable for a beginner Ukrainian rhyme game.
2. Use Anthropic SDK tool-use with a strict JSON schema:
   ```ts
   {
     groups: Array<{
       ending: string,     // e.g. "-іт"
       words: string[]     // 3–4 common words sharing this ending
     }>
   }
   ```
3. Validate response: each group has ≥ 2 words, words are non-empty Ukrainian Cyrillic strings.
4. Assign colors round-robin across groups: `["yellow", "blue", "orange", "red"]` (cycles if more than 4 groups).
5. Return `{ groups }` to the client.
6. **On any failure** (network error, malformed JSON, validation fail): log the error, return the bundled fallback groups (always succeeds).

**Prompt sketch (server-side):**
> Generate {count} groups of common, beginner-friendly Ukrainian words that rhyme. Each group should share a stressed-vowel-onward ending. Each group should contain 3–4 words. Avoid obscure, archaic, or vulgar words. Prefer concrete nouns, common verbs, and adjectives a child or learner would know.

The exact prompt is in `lib/rhymes.ts` and can be tuned without redeploying logic.

## Game flow

```
[Setup screen]
  - "ГРАТИ" button (large, centered)
  - BeatPicker beneath it
  - "Вийти" link in top-right corner
        │
        │ click ГРАТИ
        ▼
[Loading]  ─── parallel: fetch /api/rhymes,  preload selected beat audio
        │
        ▼
[Playing]
  - Audio plays from t=0 (audio.currentTime reset to 0 if replaying)
  - RAF loop computes currentBeat from a sessionTime() that handles audio loop wraparound
  - Ball position + active row update each frame
  - Grid scrolls so active row sits at fixed visible y
  - "←" back button in top-left → confirms ("Завершити сесію?"), then stops audio and returns to Setup
        │
        │ when all bars consumed
        ▼
[End screen]
  - "Гарна робота!"
  - "Грати знову" → re-fetch rhymes, restart with the same beat
  - "Інший біт"   → return to Setup screen so user can pick a different beat
```

## Bar/grid construction

Given groups returned from API:

```ts
type Bar = { word: string; color: 'yellow' | 'blue' | 'orange' | 'red'; groupIndex: number };

function flattenBars(groups: Group[]): Bar[] {
  return groups.flatMap((g, i) =>
    g.words.map(w => ({ word: w, color: colors[i % 4], groupIndex: i }))
  );
}
```

Result: a flat sequence like `[{word:'кіт',color:yellow,gi:0}, {word:'літ',color:yellow,gi:0}, {word:'хата',color:blue,gi:1}, …]`. Each `Bar` becomes one row of the grid.

A typical session produces ~30 bars (10 groups × 3 words). At 90 BPM, one bar ≈ 2.67s, so a session runs ~80 seconds. The selected beat must loop seamlessly to cover this.

## Game loop & timing

The audio is short (typical loop is 8–16 bars; a session is ~30 bars) and we set `<audio loop>`, which means `audio.currentTime` resets to 0 on every loop. The game loop must track loop count to compute a monotonically increasing "session time".

```ts
function makeSessionTimer(audio: HTMLAudioElement) {
  let loopsCompleted = 0;
  let lastT = 0;
  audio.addEventListener('seeking', () => { lastT = 0; }); // user replay
  return () => {
    const t = audio.currentTime;
    if (t < lastT - 0.5) loopsCompleted++; // wrapped around
    lastT = t;
    return loopsCompleted * audio.duration + t;
  };
}

function tick(sessionTime: number, bpm: number, totalBars: number) {
  const beatsPerSecond = bpm / 60;
  const currentBeat = sessionTime * beatsPerSecond;
  const currentBar  = Math.floor(currentBeat / 4);
  const beatInBar   = currentBeat % 4;            // 0..4

  const ballX = beatInBar / 4;                    // 0..1, lerp across the 4 cells
  const activeRow = currentBar;
  // The user lands their rhyme as the ball reaches ballX = 1 (end of the bar).

  if (currentBar >= totalBars) endGame();
}
```

Timing is driven by `audio.currentTime` (via `sessionTime`), which means visuals stay in sync with audio even if the browser drops frames. The ball X-position is computed continuously (not snapped to the beat grid) — this gives smooth motion. Vertical position can dip slightly between beats to mimic a real bouncing ball (sine wave on `beatInBar` fractional part).

**BPM accuracy.** Each beat's `bpm` in `lib/beats.ts` is the source of truth for timing. MP3 loops from royalty-free libraries are often labeled "88 BPM" but actually run at 87.9 or 88.1, and over a 30-bar session that drifts by half a beat. The implementer must verify BPM by deriving it from the audio file's actual duration: `bpm = (loopBarsPerLoop × 4 × 60) / audio.duration`. If a loop is 16 bars and `audio.duration === 43.62s`, then `bpm = 64 × 60 / 43.62 = 88.03`. Use the derived value, not the labeled value.

## Visual design

- **Background:** deep navy `#0e1330`
- **Cells (empty):** translucent white `rgba(255,255,255,0.06)` with subtle inset border
- **Active cell highlight:** brighter background `rgba(255,255,255,0.18)`, soft outer glow
- **Rhyme group colors:**
  - `yellow`  `#ffd447` (wheat)
  - `blue`    `#3aa3ff` (cornflower)
  - `orange`  `#ff8a3c` (sunset)
  - `red`     `#e44d4d` (viburnum)
- **Word text:** white, bold, ~22pt, on the colored cell
- **Ball:** warm orange `#ff9d2a`, ~28px diameter, slight motion trail (a faded copy at the previous frame's position)
- **Font:** Manrope (Google Fonts), weights 400/600/800
- **Layout:** mobile-first, single column. Grid takes the middle 80% of viewport width. Footer holds beat info + a small play/pause icon.

## Bundled beats

8–10 royalty-free hip-hop instrumental loops in `public/beats/`. Sources: Pixabay (free commercial-use), FreePD, Free Music Archive (CC0 / CC-BY tracks).

`lib/beats.ts`:
```ts
export const beats = [
  { id: 'b1', src: '/beats/calm-bap.mp3',    title: 'Calm Bap',    bpm: 88.03, barsPerLoop: 16 },
  { id: 'b2', src: '/beats/cyber-drill.mp3', title: 'Cyber Drill', bpm: 95.00, barsPerLoop: 8  },
  // ... 8–10 total
] as const;
```

For each track:
- `barsPerLoop` is the musical length of the audio file (typical: 8 or 16).
- `bpm` is derived from the actual file duration (`bpm = barsPerLoop × 4 × 60 / duration`), not whatever the source labels it. Use a DAW or a quick `ffprobe` + arithmetic to fill these in. Wrong BPM → ball desyncs over the session.

**Open item:** if the user has preferred beats, they drop them in `public/beats/` and add metadata; otherwise the implementer picks 8–10 from royalty-free libraries.

## Error handling

| Failure | Behavior |
|---|---|
| `/api/rhymes` returns malformed JSON | Server falls back to `fallback-groups.ts` |
| Claude API error (network, rate limit, etc.) | Server falls back to `fallback-groups.ts` |
| Audio fails to load | Show error toast, return user to Setup; allow trying another beat |
| Cookie tampered or expired | Middleware clears cookie, redirects to `/login` |
| Wrong password | Login page shows generic "Неправильний пароль" |

## Environment variables

| Var | Purpose | Required |
|---|---|---|
| `APP_PASSWORD` | Shared password gate | yes |
| `AUTH_SECRET` | HMAC key for cookie signing (generate with `openssl rand -hex 32`) | yes |
| `ANTHROPIC_API_KEY` | Server-side Claude API key | yes |

## Testing strategy

- Unit tests for `flattenBars`, `auth.ts` (sign + verify roundtrip, expired cookie, tampered cookie).
- Integration test for `/api/rhymes` route: mocked Anthropic client returning malformed JSON → expects fallback.
- Manual smoke test: play through one full session, verify ball stays in sync with beat over 30 bars.

Heavy E2E or audio-sync automation is out of scope for v1.

## File-by-file deliverables

```
app/
  layout.tsx                         # font, global Tailwind, base background
  page.tsx                           # auth-gated; renders <Game />
  login/page.tsx                     # password form (client component)
  api/login/route.ts                 # POST handler; sets cookie
  api/logout/route.ts                # POST handler; clears cookie
  api/rhymes/route.ts                # POST handler; calls Claude
components/
  Setup.tsx
  Game.tsx
  WordGrid.tsx
  BouncingBall.tsx
  BeatPicker.tsx
  EndScreen.tsx
hooks/
  useGameLoop.ts
  useBeat.ts
lib/
  auth.ts
  rhymes.ts
  fallback-groups.ts
  beats.ts
  flatten-bars.ts
public/
  beats/<8–10 .mp3 files>
middleware.ts
tailwind.config.ts
next.config.mjs
package.json
tsconfig.json
.env.example
README.md
```
