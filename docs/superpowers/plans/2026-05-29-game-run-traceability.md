# Game-Run Traceability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Log every game run (who played, which beat, with what options, and the generated rhymes) to Postgres, and expose a protected admin page to browse recent runs.

**Architecture:** Best-effort server-side logging inside `POST /api/rhymes` — the one place that already has the run options and generates the rhymes. The client adds beat metadata to the existing request; the route reads `auth()` for the user's email and inserts a row into a new `game_runs` table. Reading is via an `ADMIN_EMAILS`-gated server component at `/admin/runs`. Identity is keyed on email (not user id), because the app uses JWT sessions and a Credentials provider that never persists a `users` row.

**Tech Stack:** Next.js 14 (App Router, route handlers), NextAuth v5 (`auth()`), Postgres via `pg` (`lib/db.ts` pool), Vitest.

**Spec:** [docs/superpowers/specs/2026-05-29-game-run-traceability-design.md](../specs/2026-05-29-game-run-traceability-design.md)

---

## File Structure

- **Create** `lib/admin.ts` — `isAdmin(email)` env-based gate. One responsibility: admin authorization.
- **Create** `lib/admin.test.ts` — unit tests for `isAdmin`.
- **Create** `lib/game-runs.ts` — `GameRunRecord` type + `logGameRun(record)` best-effort insert. One responsibility: persisting a run.
- **Create** `lib/game-runs.test.ts` — unit tests for `logGameRun`.
- **Create** `app/api/rhymes/route.test.ts` — tests that the route logs a run.
- **Create** `app/admin/runs/page.tsx` — admin-only server component listing recent runs.
- **Modify** `scripts/db-schema.sql` — add `game_runs` table + indexes.
- **Modify** `lib/rhymes.ts` — `fetchRhymeBlocks` returns `{ blocks, usedFallback }`.
- **Modify** `lib/rhymes.test.ts` — update for the new return shape.
- **Modify** `app/api/rhymes/route.ts` — parse beat, read `auth()`, call `logGameRun`.
- **Modify** `hooks/useGamePhases.ts` — send beat metadata in the `/api/rhymes` POST body.
- **Modify** `middleware.ts` + `auth.config.ts` — add `/admin` to the protected-prefix lists.

---

## Task 1: Add the `game_runs` table to the schema

**Files:**
- Modify: `scripts/db-schema.sql` (append after the `waitlist` table, currently ends at line 51)

- [ ] **Step 1: Append the table definition**

Add to the end of `scripts/db-schema.sql`:

```sql

CREATE TABLE game_runs (
  id            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  user_email    TEXT,
  beat_id       TEXT,
  beat_title    TEXT,
  beat_bpm      REAL,
  beat_category TEXT,
  beat_source   TEXT,            -- 'local' | 'youtube'
  language      TEXT NOT NULL,
  difficulty    TEXT NOT NULL,
  scheme        TEXT NOT NULL,
  block_count   INTEGER,
  used_fallback BOOLEAN,
  blocks        JSONB NOT NULL,  -- the generated RhymeBlock[]
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
CREATE INDEX game_runs_created_at_idx ON game_runs (created_at DESC);
CREATE INDEX game_runs_user_email_idx ON game_runs (user_email);
```

- [ ] **Step 2: Verify the file parses as expected**

Run: `grep -c "CREATE TABLE game_runs" scripts/db-schema.sql`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add scripts/db-schema.sql
git commit -m "feat(db): add game_runs audit table"
```

---

## Task 2: `lib/admin.ts` — admin email gate

**Files:**
- Create: `lib/admin.ts`
- Test: `lib/admin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/admin.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { isAdmin } from './admin';

const ORIGINAL = process.env.ADMIN_EMAILS;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = ORIGINAL;
});

describe('isAdmin', () => {
  it('returns true for an email in the comma-separated list', () => {
    process.env.ADMIN_EMAILS = 'a@x.com,b@y.com';
    expect(isAdmin('b@y.com')).toBe(true);
  });

  it('is case-insensitive and trims surrounding whitespace', () => {
    process.env.ADMIN_EMAILS = '  Admin@Example.com , other@x.com ';
    expect(isAdmin('admin@example.com')).toBe(true);
  });

  it('returns false for an email not in the list', () => {
    process.env.ADMIN_EMAILS = 'a@x.com';
    expect(isAdmin('intruder@x.com')).toBe(false);
  });

  it('returns false when ADMIN_EMAILS is empty or unset', () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdmin('a@x.com')).toBe(false);
    process.env.ADMIN_EMAILS = '';
    expect(isAdmin('a@x.com')).toBe(false);
  });

  it('returns false for null / undefined / empty email', () => {
    process.env.ADMIN_EMAILS = 'a@x.com';
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
    expect(isAdmin('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/admin.test.ts`
Expected: FAIL — `Failed to resolve import "./admin"` (file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `lib/admin.ts`:

```ts
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/admin.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/admin.ts lib/admin.test.ts
git commit -m "feat(admin): add ADMIN_EMAILS-based isAdmin gate"
```

---

## Task 3: `lib/game-runs.ts` — best-effort run logging

**Files:**
- Create: `lib/game-runs.ts`
- Test: `lib/game-runs.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/game-runs.test.ts` (mirrors the DB-mock pattern in `lib/accepted-emails.test.ts`):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  pool: { query: vi.fn() },
}));

import { pool } from '@/lib/db';
import { logGameRun, type GameRunRecord } from './game-runs';

const mockQuery = (pool as unknown as { query: ReturnType<typeof vi.fn> }).query;

const sample: GameRunRecord = {
  userEmail: 'tester@example.com',
  beat: { id: 'criminal', title: 'Criminal', bpm: 95, category: 'boom-bap', source: 'local' },
  language: 'en',
  difficulty: 'beginner',
  scheme: 'AABB',
  blockCount: 2,
  usedFallback: false,
  blocks: [{ words: ['day', 'way', 'play', 'say'] }],
};

describe('logGameRun', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('inserts a row with the run fields and serialized blocks', async () => {
    mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
    await logGameRun(sample);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('INSERT INTO game_runs');
    expect(params).toEqual([
      'tester@example.com',
      'criminal', 'Criminal', 95, 'boom-bap', 'local',
      'en', 'beginner', 'AABB',
      2, false,
      JSON.stringify(sample.blocks),
    ]);
  });

  it('stores nulls for a missing beat', async () => {
    mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
    await logGameRun({ ...sample, beat: null });
    const params = mockQuery.mock.calls[0][1];
    expect(params.slice(1, 6)).toEqual([null, null, null, null, null]);
  });

  it('never throws and warns when the query fails', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));
    await expect(logGameRun(sample)).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the pool is undefined', async () => {
    vi.resetModules();
    vi.doMock('@/lib/db', () => ({ pool: undefined }));
    const { logGameRun: logNoPool } = await import('./game-runs');
    await expect(logNoPool(sample)).resolves.toBeUndefined();
    vi.doUnmock('@/lib/db');
    vi.resetModules();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/game-runs.test.ts`
Expected: FAIL — `Failed to resolve import "./game-runs"`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/game-runs.ts`:

```ts
import { pool } from '@/lib/db';
import type { RhymeBlock } from '@/lib/fallback-groups';

export type GameRunRecord = {
  userEmail: string | null;
  beat: {
    id: string | null;
    title: string | null;
    bpm: number | null;
    category: string | null;
    source: 'local' | 'youtube';
  } | null;
  language: string;
  difficulty: string;
  scheme: string;
  blockCount: number;
  usedFallback: boolean;
  blocks: RhymeBlock[];
};

export async function logGameRun(record: GameRunRecord): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO game_runs
         (user_email, beat_id, beat_title, beat_bpm, beat_category, beat_source,
          language, difficulty, scheme, block_count, used_fallback, blocks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        record.userEmail,
        record.beat?.id ?? null,
        record.beat?.title ?? null,
        record.beat?.bpm ?? null,
        record.beat?.category ?? null,
        record.beat?.source ?? null,
        record.language,
        record.difficulty,
        record.scheme,
        record.blockCount,
        record.usedFallback,
        JSON.stringify(record.blocks),
      ],
    );
  } catch (err) {
    console.warn('[game-runs] log failed:', err);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/game-runs.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/game-runs.ts lib/game-runs.test.ts
git commit -m "feat(game-runs): add best-effort logGameRun insert"
```

---

## Task 4: Change `fetchRhymeBlocks` to return `{ blocks, usedFallback }`

**Files:**
- Modify: `lib/rhymes.ts:96-114`
- Modify: `lib/rhymes.test.ts` (6 return-reading assertions)
- Modify: `app/api/rhymes/route.ts:39` (destructure only — logging added in Task 5)

- [ ] **Step 1: Update the failing tests first**

In `lib/rhymes.test.ts`, change the six tests that read the return value. Each currently binds `const blocks = await fetchRhymeBlocks(...)`; change to destructure and assert `usedFallback`.

Test 1 — replace:

```ts
  it('returns blocks from a successful tool-use response', async () => {
    const generate = mockGenerate('good');
    const blocks = await fetchRhymeBlocks({ generate, language: 'uk' });
    expect(blocks).toEqual([
      { words: ['кіт', 'літ', 'піт', 'цвіт'] },
      { words: ['хата', 'лата', 'вата', 'плата'] },
    ]);
  });
```

with:

```ts
  it('returns blocks from a successful tool-use response', async () => {
    const generate = mockGenerate('good');
    const { blocks, usedFallback } = await fetchRhymeBlocks({ generate, language: 'uk' });
    expect(blocks).toEqual([
      { words: ['кіт', 'літ', 'піт', 'цвіт'] },
      { words: ['хата', 'лата', 'вата', 'плата'] },
    ]);
    expect(usedFallback).toBe(false);
  });
```

Test 2 — replace:

```ts
  it('falls back to fallback blocks when the generator throws', async () => {
    const blocks = await fetchRhymeBlocks({
      generate: mockGenerate('throws'),
      language: 'de',
      schemeId: 'AABB',
    });
    expect(blocks).toEqual(buildFallbackBlocks('de', getRhymeScheme('AABB'), 8));
  });
```

with:

```ts
  it('falls back to fallback blocks when the generator throws', async () => {
    const { blocks, usedFallback } = await fetchRhymeBlocks({
      generate: mockGenerate('throws'),
      language: 'de',
      schemeId: 'AABB',
    });
    expect(blocks).toEqual(buildFallbackBlocks('de', getRhymeScheme('AABB'), 8));
    expect(usedFallback).toBe(true);
  });
```

Test 3 — replace:

```ts
  it('falls back when the generator returns no tool call', async () => {
    const blocks = await fetchRhymeBlocks({
      generate: mockGenerate('malformed'),
      language: 'pl',
      schemeId: 'AABB',
    });
    expect(blocks).toEqual(buildFallbackBlocks('pl', getRhymeScheme('AABB'), 8));
  });
```

with:

```ts
  it('falls back when the generator returns no tool call', async () => {
    const { blocks, usedFallback } = await fetchRhymeBlocks({
      generate: mockGenerate('malformed'),
      language: 'pl',
      schemeId: 'AABB',
    });
    expect(blocks).toEqual(buildFallbackBlocks('pl', getRhymeScheme('AABB'), 8));
    expect(usedFallback).toBe(true);
  });
```

Test 4 — replace:

```ts
  it('falls back when blocks array is empty', async () => {
    const blocks = await fetchRhymeBlocks({
      generate: mockGenerate('empty'),
      language: 'en',
      schemeId: 'AABB',
    });
    expect(blocks).toEqual(buildFallbackBlocks('en', getRhymeScheme('AABB'), 8));
  });
```

with:

```ts
  it('falls back when blocks array is empty', async () => {
    const { blocks, usedFallback } = await fetchRhymeBlocks({
      generate: mockGenerate('empty'),
      language: 'en',
      schemeId: 'AABB',
    });
    expect(blocks).toEqual(buildFallbackBlocks('en', getRhymeScheme('AABB'), 8));
    expect(usedFallback).toBe(true);
  });
```

Test 5 — replace:

```ts
  it('falls back to fallback blocks when the generator yields null', async () => {
    const blocks = await fetchRhymeBlocks({
      generate: async () => null,
      language: 'es',
      schemeId: 'AABB',
    });
    expect(blocks).toEqual(buildFallbackBlocks('es', getRhymeScheme('AABB'), 8));
  });
```

with:

```ts
  it('falls back to fallback blocks when the generator yields null', async () => {
    const { blocks, usedFallback } = await fetchRhymeBlocks({
      generate: async () => null,
      language: 'es',
      schemeId: 'AABB',
    });
    expect(blocks).toEqual(buildFallbackBlocks('es', getRhymeScheme('AABB'), 8));
    expect(usedFallback).toBe(true);
  });
```

Test 6 — replace:

```ts
  it('defaults to uk when language is missing or unknown', async () => {
    const blocks = await fetchRhymeBlocks({ generate: async () => null });
    expect(blocks).toEqual(buildFallbackBlocks('uk', getRhymeScheme('AABB'), 8));
  });
```

with:

```ts
  it('defaults to uk when language is missing or unknown', async () => {
    const { blocks, usedFallback } = await fetchRhymeBlocks({ generate: async () => null });
    expect(blocks).toEqual(buildFallbackBlocks('uk', getRhymeScheme('AABB'), 8));
    expect(usedFallback).toBe(true);
  });
```

(The other `fetchRhymeBlocks` calls in this file read only `generate.mock.calls`, not the return value — leave them unchanged.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/rhymes.test.ts`
Expected: FAIL — the six destructured tests get `blocks: undefined` / `usedFallback: undefined` because `fetchRhymeBlocks` still returns an array.

- [ ] **Step 3: Update the implementation**

In `lib/rhymes.ts`, replace the whole `fetchRhymeBlocks` function (lines 96-114) with:

```ts
export type FetchResult = { blocks: RhymeBlock[]; usedFallback: boolean };

export async function fetchRhymeBlocks(opts: FetchOpts = {}): Promise<FetchResult> {
  const difficulty = getDifficulty(opts.difficultyId);
  const scheme = getRhymeScheme(opts.schemeId);
  const count = opts.count ?? scheme.blockCount;
  const lang = getLanguage(opts.language);
  const fallback = (): FetchResult => ({
    blocks: buildFallbackBlocks(lang.id, scheme, count),
    usedFallback: true,
  });
  const generate = opts.generate ?? defaultGenerator;
  try {
    const tool = buildTool(lang);
    const prompt = buildPrompt(lang, count, scheme, difficulty.promptHint, opts.exclude);
    const temperature = 0.4 + Math.random() * 0.4;
    const input = await generate({ prompt, tool, temperature });
    const parsed = parseBlocks(input, scheme.pattern);
    return parsed ? { blocks: parsed, usedFallback: false } : fallback();
  } catch (err) {
    console.error('[rhymes] fetch failed, using fallback', err);
    return fallback();
  }
}
```

`RhymeBlock` is already imported at the top of the file (line 1).

- [ ] **Step 4: Update the route's consumption (keep behavior identical)**

In `app/api/rhymes/route.ts`, change line 39 from:

```ts
  const blocks = await fetchRhymeBlocks({
```

to:

```ts
  const { blocks } = await fetchRhymeBlocks({
```

(The `return NextResponse.json({ blocks });` on line 46 is unchanged.)

- [ ] **Step 5: Run tests and typecheck to verify all pass**

Run: `npx vitest run lib/rhymes.test.ts && npx tsc --noEmit`
Expected: PASS (all rhymes tests green) and no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/rhymes.ts lib/rhymes.test.ts app/api/rhymes/route.ts
git commit -m "refactor(rhymes): return usedFallback flag from fetchRhymeBlocks"
```

---

## Task 5: Log the run inside `POST /api/rhymes`

**Files:**
- Modify: `app/api/rhymes/route.ts` (full rewrite below)
- Create: `app/api/rhymes/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/api/rhymes/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/auth', () => ({
  auth: vi.fn(async () => ({ user: { email: 'tester@example.com' } })),
}));
vi.mock('@/lib/game-runs', () => ({ logGameRun: vi.fn(async () => {}) }));
vi.mock('@/lib/rhymes', () => ({
  fetchRhymeBlocks: vi.fn(async () => ({
    blocks: [{ words: ['a', 'b', 'c', 'd'] }],
    usedFallback: false,
  })),
}));

import { POST } from './route';
import { logGameRun } from '@/lib/game-runs';

const mockLog = logGameRun as unknown as ReturnType<typeof vi.fn>;

function postReq(body: unknown) {
  return new Request('http://localhost/api/rhymes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/rhymes logging', () => {
  beforeEach(() => {
    mockLog.mockClear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('logs the run with email, options, and beat (source defaults to local)', async () => {
    const res = await POST(postReq({
      language: 'en',
      difficultyId: 'beginner',
      schemeId: 'AABB',
      beat: { id: 'criminal', title: 'Criminal', bpm: 95, category: 'boom-bap' },
    }));
    expect(res.status).toBe(200);
    expect(mockLog).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledWith(expect.objectContaining({
      userEmail: 'tester@example.com',
      language: 'en',
      difficulty: 'beginner',
      scheme: 'AABB',
      usedFallback: false,
      blockCount: 1,
      beat: expect.objectContaining({ id: 'criminal', source: 'local' }),
    }));
  });

  it('logs beat=null when no beat is provided', async () => {
    await POST(postReq({ language: 'en' }));
    expect(mockLog).toHaveBeenCalledWith(expect.objectContaining({ beat: null }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/rhymes/route.test.ts`
Expected: FAIL — `logGameRun` is never called (the route doesn't log yet); `toHaveBeenCalledTimes(1)` fails with 0 calls.

- [ ] **Step 3: Rewrite the route to parse the beat and log the run**

Replace the entire contents of `app/api/rhymes/route.ts` with:

```ts
import { NextResponse } from 'next/server';
import { fetchRhymeBlocks } from '@/lib/rhymes';
import { getGeminiKeys } from '@/lib/gemini';
import { getLanguage } from '@/lib/languages';
import type { RhymeExclusion } from '@/lib/languages';
import { getDifficulty } from '@/lib/difficulties';
import { getRhymeScheme } from '@/lib/rhyme-schemes';
import { auth } from '@/auth';
import { logGameRun, type GameRunRecord } from '@/lib/game-runs';

export const runtime = 'nodejs';
export const maxDuration = 30;

function parseBeat(raw: unknown): GameRunRecord['beat'] {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  return {
    id: typeof b.id === 'string' ? b.id.slice(0, 200) : null,
    title: typeof b.title === 'string' ? b.title.slice(0, 300) : null,
    bpm: typeof b.bpm === 'number' && Number.isFinite(b.bpm) ? b.bpm : null,
    category: typeof b.category === 'string' ? b.category.slice(0, 50) : null,
    source: b.source === 'youtube' ? 'youtube' : 'local',
  };
}

export async function POST(request: Request) {
  let rawLanguage: string | null = null;
  let rawDifficultyId: string | null = null;
  let rawSchemeId: string | null = null;
  let exclude: RhymeExclusion = { words: [], endings: [] };
  let count: number | undefined;
  let beat: GameRunRecord['beat'] = null;
  try {
    const body = await request.json();
    if (body && typeof body.language === 'string') rawLanguage = body.language;
    if (body && typeof body.difficultyId === 'string') rawDifficultyId = body.difficultyId;
    if (body && typeof body.schemeId === 'string') rawSchemeId = body.schemeId;
    if (Array.isArray(body?.exclude?.words)) {
      exclude.words = body.exclude.words
        .filter((w: unknown) => typeof w === 'string')
        .slice(0, 60);
    }
    if (typeof body?.count === 'number' && Number.isFinite(body.count)) {
      count = Math.max(1, Math.min(50, Math.floor(body.count)));
    }
    beat = parseBeat(body?.beat);
  } catch {
    // No body or malformed JSON — use defaults.
  }
  const lang = getLanguage(rawLanguage);
  const difficulty = getDifficulty(rawDifficultyId);
  const scheme = getRhymeScheme(rawSchemeId);

  if (!getGeminiKeys().length) {
    console.warn('[rhymes] no GEMINI_API_KEY set — using fallback blocks');
  }
  const { blocks, usedFallback } = await fetchRhymeBlocks({
    language: lang.id,
    exclude,
    difficultyId: difficulty.id,
    schemeId: scheme.id,
    count,
  });

  const session = await auth();
  await logGameRun({
    userEmail: session?.user?.email ?? null,
    beat,
    language: lang.id,
    difficulty: difficulty.id,
    scheme: scheme.id,
    blockCount: blocks.length,
    usedFallback,
    blocks,
  });

  return NextResponse.json({ blocks });
}
```

- [ ] **Step 4: Run test and typecheck to verify they pass**

Run: `npx vitest run app/api/rhymes/route.test.ts && npx tsc --noEmit`
Expected: PASS (2 tests) and no type errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/rhymes/route.ts app/api/rhymes/route.test.ts
git commit -m "feat(rhymes): log each run to game_runs via /api/rhymes"
```

---

## Task 6: Send beat metadata from the client

**Files:**
- Modify: `hooks/useGamePhases.ts:81-94` (the `/api/rhymes` fetch body)

- [ ] **Step 1: Add the beat to the POST body**

In `hooks/useGamePhases.ts`, the loading effect already guards `if (phase !== 'loading' || !activeBeat) return;` (line 69), so `activeBeat` is non-null here. Change the fetch body from:

```ts
          body: JSON.stringify({
            language: languageId,
            difficultyId,
            schemeId,
            count: plan.count,
            exclude: {
              words: usedWordsRef.current,
              endings: [],
            },
          }),
```

to:

```ts
          body: JSON.stringify({
            language: languageId,
            difficultyId,
            schemeId,
            count: plan.count,
            exclude: {
              words: usedWordsRef.current,
              endings: [],
            },
            beat: {
              id: activeBeat.id,
              title: activeBeat.title,
              bpm: activeBeat.bpm,
              category: activeBeat.category,
              source: activeBeat.source ?? 'local',
            },
          }),
```

- [ ] **Step 2: Typecheck and run the full suite (no regressions)**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add hooks/useGamePhases.ts
git commit -m "feat(game): send beat metadata to /api/rhymes for audit log"
```

---

## Task 7: Admin page at `/admin/runs`

**Files:**
- Create: `app/admin/runs/page.tsx`

- [ ] **Step 1: Create the admin server component**

Create `app/admin/runs/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RunRow = {
  id: string;
  user_email: string | null;
  beat_title: string | null;
  beat_source: string | null;
  beat_bpm: number | null;
  language: string;
  difficulty: string;
  scheme: string;
  used_fallback: boolean | null;
  blocks: { words: string[] }[];
  created_at: string;
};

async function recentRuns(): Promise<RunRow[]> {
  if (!pool) return [];
  try {
    const { rows } = await pool.query<RunRow>(
      `SELECT id, user_email, beat_title, beat_source, beat_bpm,
              language, difficulty, scheme, used_fallback, blocks, created_at
         FROM game_runs
         ORDER BY created_at DESC
         LIMIT 100`,
    );
    return rows;
  } catch {
    return [];
  }
}

function summarizeBlocks(blocks: { words: string[] }[]): string {
  return blocks
    .map(b => b.words.filter(Boolean).join(' / '))
    .join('  |  ');
}

export default async function AdminRunsPage() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) redirect('/login');

  const runs = await recentRuns();

  return (
    <main className="min-h-screen bg-[#060c14] text-white/90 p-6">
      <h1 className="text-xl mb-4">Game runs (latest {runs.length})</h1>
      {runs.length === 0 ? (
        <p className="text-white/50">No runs recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-white/50 border-b border-white/10">
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Beat</th>
                <th className="py-2 pr-4">Lang</th>
                <th className="py-2 pr-4">Diff</th>
                <th className="py-2 pr-4">Scheme</th>
                <th className="py-2 pr-4">Fallback</th>
                <th className="py-2 pr-4">Rhymes</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => (
                <tr key={r.id} className="border-b border-white/5 align-top">
                  <td className="py-2 pr-4 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{r.user_email ?? '—'}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {r.beat_title ?? '—'}
                    {r.beat_source ? ` (${r.beat_source})` : ''}
                    {r.beat_bpm != null ? ` · ${r.beat_bpm} BPM` : ''}
                  </td>
                  <td className="py-2 pr-4">{r.language}</td>
                  <td className="py-2 pr-4">{r.difficulty}</td>
                  <td className="py-2 pr-4">{r.scheme}</td>
                  <td className="py-2 pr-4">{r.used_fallback ? 'yes' : 'no'}</td>
                  <td className="py-2 pr-4 text-white/70">{summarizeBlocks(r.blocks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/runs/page.tsx
git commit -m "feat(admin): add /admin/runs page listing recent game runs"
```

---

## Task 8: Gate `/admin` at the edge

**Files:**
- Modify: `middleware.ts:8`
- Modify: `auth.config.ts:10-12`

The codebase keeps two parallel protected-prefix lists (one in `middleware.ts`, one in the `authorized` callback in `auth.config.ts`). Keep them in sync — add `/admin` to both. The page's own `isAdmin` check is the real authorization gate; these edits only redirect unauthenticated visitors to `/login`.

- [ ] **Step 1: Add `/admin` to the middleware prefix list**

In `middleware.ts`, change line 8 from:

```ts
const PROTECTED_PREFIXES = ['/play', '/yt', '/calibrate'];
```

to:

```ts
const PROTECTED_PREFIXES = ['/play', '/yt', '/calibrate', '/admin'];
```

- [ ] **Step 2: Add `/admin` to the authorized-callback prefix list**

In `auth.config.ts`, change the `isProtected` array (lines 10-12) from:

```ts
      const isProtected = ['/play', '/yt', '/calibrate'].some(p =>
        nextUrl.pathname.startsWith(p)
      );
```

to:

```ts
      const isProtected = ['/play', '/yt', '/calibrate', '/admin'].some(p =>
        nextUrl.pathname.startsWith(p)
      );
```

- [ ] **Step 3: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts auth.config.ts
git commit -m "feat(admin): require auth for /admin at the edge"
```

---

## Task 9: Deployment (manual — run during release, not part of the build)

**Files:** none (operational steps on prod, per the prod-deploy / prod-db-access notes).

- [ ] **Step 1: Create the table on prod Postgres**

SSH to prod and run the `game_runs` DDL from Task 1 (the table is also in `scripts/db-schema.sql` as the canonical schema). Verify:

Run (on prod): `\d game_runs`
Expected: the table and its two indexes exist.

- [ ] **Step 2: Set `ADMIN_EMAILS` in the deploy-owned `.env`**

Add `ADMIN_EMAILS=kvochkinvlad@gmail.com` (comma-separate additional admins) to `~/rhyme-game/.env`, then restart the service (`sudo systemctl restart rhyme-game`).

- [ ] **Step 3: Smoke-test**

Play one round, then load `/admin/runs` as an admin and confirm the run appears with its beat, options, and rhymes. Confirm a non-admin (or logged-out) visitor is redirected to `/login`.

---

## Self-Review

**Spec coverage:**
- `game_runs` table → Task 1. ✓
- Log inside `/api/rhymes`, server-authoritative, best-effort → Tasks 3 + 5. ✓
- Client sends beat metadata → Task 6. ✓
- `fetchRhymeBlocks` returns `usedFallback` → Task 4. ✓
- Email identity (no `user_id` FK) → Task 3 type + Task 5 `session?.user?.email`. ✓
- `beat_source` defaults to `'local'` → `parseBeat` (Task 5) + client `?? 'local'` (Task 6). ✓
- `lib/admin.ts` `isAdmin` via `ADMIN_EMAILS` → Task 2. ✓
- `/admin/runs` admin page → Task 7. ✓
- `/admin` protected in middleware → Task 8 (both prefix lists). ✓
- Error handling (never throws / never blocks) → `logGameRun` try-catch + `if (!pool) return` (Task 3). ✓
- Tests: game-runs, admin, rhymes shape, route logging → Tasks 2, 3, 4, 5. ✓
- Deployment (apply schema, set `ADMIN_EMAILS`) → Task 9. ✓

**Placeholder scan:** No TBD/TODO/"handle errors appropriately"; every code step shows full code.

**Type consistency:** `GameRunRecord` (defined Task 3) is imported and used identically in Task 5; `beat` shape (`id/title/bpm/category/source`) matches across `parseBeat`, the client body, and the type. `FetchResult` `{ blocks, usedFallback }` is produced in Task 4 and destructured in Task 5. SQL column list in the Task 3 insert matches the Task 1 table definition (12 columns, 12 params) and the Task 7 SELECT.
