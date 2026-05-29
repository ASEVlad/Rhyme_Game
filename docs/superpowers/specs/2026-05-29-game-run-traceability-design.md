# Game-Run Traceability (Audit Log)

**Date:** 2026-05-29
**Status:** Approved design

## Goal

Add a full audit log of every game run: **who** played, **which track** (beat),
**with what options** (language / difficulty / rhyme scheme), and **what rhymes**
were generated. Serves both rhyme-quality debugging and usage analysis from one
log, plus a protected admin page to browse recent runs.

## Background

A "run" today:

1. Setup screen — user picks a beat (local or YouTube), language, difficulty, and
   rhyme scheme.
2. `handlePlay(beat, lang, difficulty, scheme)` → loading phase
   ([hooks/useGamePhases.ts](../../../hooks/useGamePhases.ts)).
3. Loading effect POSTs to `/api/rhymes` with `{ language, difficultyId, schemeId,
   count, exclude }` and receives `RhymeBlock[]` (arrays of 4 end-words) generated
   by Gemini via `fetchRhymeBlocks` ([lib/rhymes.ts](../../../lib/rhymes.ts)).
4. Blocks are flattened into bars and the beat plays.

Key facts that shape the design:

- Every run is authenticated. `/play`, `/yt`, `/calibrate` are login-gated in
  [middleware.ts](../../../middleware.ts), so the session is always present.
- Identity key is **email, not user id.** [auth.config.ts](../../../auth.config.ts)
  uses `session: { strategy: 'jwt' }` with no callback surfacing `session.user.id`,
  and the Credentials provider ([auth.ts](../../../auth.ts)) returns `{ id: email }`
  without persisting a `users` row — so a FK to `users(id)` would fail and silently
  drop the audit row. `session.user.email` is guaranteed for both providers (the
  Google `signIn` callback rejects emailless logins). The app is already email-keyed
  (waitlist, accepted-emails), so we key the audit on email too.
- `/api/rhymes` does **not** currently know which beat is playing — it only
  receives the options. Capturing "which track" requires the client to send beat
  metadata.
- Local beats omit the `source` field ([lib/beats.ts](../../../lib/beats.ts)
  declares `source?: 'youtube'`); only YT-downloaded beats set it. Missing source
  is normalized to `'local'`.
- `fetchRhymeBlocks` silently falls back to canned blocks when Gemini fails or no
  key is set. Whether a run used the fallback is the single most useful
  rhyme-quality signal, so it must be captured.
- DB access uses `pool` from [lib/db.ts](../../../lib/db.ts) with a best-effort
  pattern (`if (!pool) return; try { ... } catch { warn }`), as in
  [lib/accepted-emails.ts](../../../lib/accepted-emails.ts).

## Chosen approach

Log **inside `/api/rhymes`** (server-authoritative, single round-trip). The client
adds beat metadata to the existing POST body; the route reads `auth()` for the
user and performs a best-effort insert after generating the blocks.

Rejected alternatives:

- **Separate `/api/runs` endpoint, client-reported** — captures the exact rendered
  bars but adds a second request, duplicates option data, and is spoofable/droppable.
- **Pure server, no client change** — not viable; beat identity isn't available
  server-side without the client sending it.

Accepted tradeoff: we log the **generated** block set, not the exact bars left on
screen after client-side sampling/slicing. Acceptable for an audit log; rendered-bar
fidelity can be added later if ever needed.

## Data model

New table, added to [scripts/db-schema.sql](../../../scripts/db-schema.sql) and
applied on prod:

```sql
CREATE TABLE game_runs (
  id            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  user_email    TEXT,            -- identity key (see Background); nullable for robustness
  beat_id       TEXT,
  beat_title    TEXT,
  beat_bpm      REAL,
  beat_category TEXT,
  beat_source   TEXT,            -- 'local' | 'youtube'
  language      TEXT NOT NULL,
  difficulty    TEXT NOT NULL,
  scheme        TEXT NOT NULL,
  block_count   INTEGER,
  used_fallback BOOLEAN,         -- true = canned blocks (Gemini failed / no key)
  blocks        JSONB NOT NULL,  -- the generated RhymeBlock[] — "what rhymes"
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
CREATE INDEX game_runs_created_at_idx ON game_runs (created_at DESC);
CREATE INDEX game_runs_user_email_idx ON game_runs (user_email);
```

- One row **per generation call**. `playAgain` re-fetches rhymes, so it logs a new
  row — the natural grain ("a run" = "a generation").
- No FK to `users` — email is the identity (see Background). Join on email if the
  `users` row is ever needed. `user_email` is nullable so a logging insert never
  fails on a missing email (best-effort); in practice it is always present.
- `blocks` is stored as-is; a run is small, JSONB is fine.

## Components

### `lib/game-runs.ts` (new)

```ts
export type GameRunRecord = {
  userEmail: string | null;
  beat: { id, title, bpm, category, source } | null;  // all fields optional/nullable
  language: string;
  difficulty: string;
  scheme: string;
  blockCount: number;
  usedFallback: boolean;
  blocks: RhymeBlock[];
};

export async function logGameRun(record: GameRunRecord): Promise<void>;
```

- Mirrors [lib/accepted-emails.ts](../../../lib/accepted-emails.ts): `if (!pool)
  return; try { INSERT ... } catch (err) { console.warn(...) }`.
- Never throws. Parameterized insert; `blocks` passed as `JSON.stringify(...)` into
  the JSONB column.

### `lib/rhymes.ts` (modified)

- Change `fetchRhymeBlocks` to return `{ blocks: RhymeBlock[]; usedFallback: boolean }`
  instead of `RhymeBlock[]`. `usedFallback` is true on both the parse-failure path
  (`parsed ?? fallback()`) and the catch path.
- Only caller is the rhymes route (+ tests), so the contract change is contained.

### `app/api/rhymes/route.ts` (modified)

- Parse optional beat fields from the body: `beat.id`, `beat.title`, `beat.bpm`,
  `beat.category`, `beat.source` — validate types, bound string lengths, ignore
  anything malformed (store null). Normalize a missing `beat.source` to `'local'`.
- After `fetchRhymeBlocks`, call `auth()` and read `session?.user?.email`.
- Call `logGameRun(...)`, awaited but wrapped so it can never break or noticeably
  delay the rhymes response (the insert is a single indexed write on a long-running
  Node server).
- Continues to return `{ blocks }` to the client (response shape unchanged).

### `hooks/useGamePhases.ts` (modified)

- In the loading effect, add `beat: { id, title, bpm, category, source }` to the
  `/api/rhymes` POST body, sourced from `activeBeat`.

### `lib/admin.ts` (new)

```ts
export function isAdmin(email: string | null | undefined): boolean;
```

- Reads `ADMIN_EMAILS` env (comma-separated). Case-insensitive, whitespace-trimmed.
  Empty/unset env → no admins. Matches the env-config style (INVITE_CODE, Gemini
  keys). Set in prod's deploy-owned `.env`.

### `app/admin/runs/page.tsx` (new)

- Server component. `const session = await auth();` → if `!isAdmin(session?.user?.email)`,
  `redirect('/login')`.
- Query the latest ~100 rows (`ORDER BY created_at DESC LIMIT 100`).
- Render a table: time · email · beat (title / source / bpm) · language /
  difficulty / scheme · fallback? · the rhyme blocks.
- Degrades to a "no data" state when `pool` is absent.

### `middleware.ts` (modified)

- Add `/admin` to `PROTECTED_PREFIXES` for defense-in-depth (login required at the
  edge; `isAdmin` enforced in the page).

## Access control

Two layers for `/admin`:

1. Middleware redirects unauthenticated users to `/login`.
2. The page enforces `isAdmin(session.user.email)` and redirects non-admins.

`ADMIN_EMAILS` chosen over a new `users.role` column to avoid a schema/migration
change and match existing env-based config.

## Error handling

Logging is fully best-effort and must never affect gameplay:

- `logGameRun` never throws; failures are `console.warn`-ed only.
- Missing/invalid beat fields → stored as null; options + rhymes still logged.
- No `POSTGRES_URL` (pool undefined) → log is a no-op; admin page shows "no data".
- The rhymes response is returned regardless of logging outcome.

## Testing

- `lib/game-runs.test.ts` — builds the correct parameterized insert; no-throw when
  pool is missing (mocked pool); `blocks` serialized correctly.
- `lib/admin.test.ts` — `isAdmin` parsing: comma list, surrounding whitespace,
  case-insensitivity, empty/unset env → false.
- `lib/rhymes.test.ts` — update existing tests for the `{ blocks, usedFallback }`
  shape; assert `usedFallback === true` on the fallback path and `false` on success.
- `app/api/rhymes/route` — posting with beat fields triggers a `logGameRun` call
  (mocked); existing behavior (returns `{ blocks }`) preserved.

(Admin page is a server component; gating logic is covered by `lib/admin.test.ts`
rather than an RSC render test.)

## Deployment notes

- Apply the `game_runs` table to prod Postgres (the table is added to
  `scripts/db-schema.sql`, the canonical schema).
- Set `ADMIN_EMAILS` in prod's deploy-owned `.env`.
- No new dependencies.

## Out of scope (YAGNI)

- Capturing the exact on-screen bars (vs generated blocks).
- Retention / cleanup policy for old rows.
- CSV/JSON export tooling.
- A `users.role` column.
