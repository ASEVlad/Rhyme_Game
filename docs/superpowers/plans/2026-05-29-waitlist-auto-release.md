# Waitlist Auto-Release & Open Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A daily cron accepts the N oldest pending waitlisters and emails each "you're in," until a single env flag opens registration to everyone.

**Architecture:** A tested pure-ish core (`lib/release-waitlist.ts`) does email-then-accept per row; a bearer-protected `nodejs` API route invokes it; a systemd timer pokes the route daily; a one-branch change in the sign-in gate (`lib/decide-signin.ts`) honours `REGISTRATION_OPEN`.

**Tech Stack:** Next.js 14 app-router route handlers, `pg` Pool (`lib/db`), Resend HTTP API, NextAuth v5, vitest (node env, `globals: true`, `@` → repo root), systemd on the VPS.

**Spec:** [docs/superpowers/specs/2026-05-29-waitlist-auto-release-design.md](../specs/2026-05-29-waitlist-auto-release-design.md)

---

## File Structure

- **Create** `lib/accept-notify.ts` — `sendAcceptedEmail(email): Promise<boolean>`, Resend send for the "you're in" mail.
- **Create** `lib/release-waitlist.ts` — `releaseWaitlistBatch(limit): Promise<ReleaseResult>`, the tested core.
- **Create** `app/api/cron/release-waitlist/route.ts` — bearer-checked `POST` trigger.
- **Create** `lib/decide-signin.ts` — `decideSignIn` extracted from `auth.ts` (so the gate is unit-testable) plus the new `REGISTRATION_OPEN` branch.
- **Modify** `auth.ts` — import `decideSignIn` from the new module; drop the now-unused inline copy and its imports.
- **Modify** `.env.example` — document `CRON_SECRET`, `WAITLIST_DAILY_BATCH`, `REGISTRATION_OPEN`.
- **Create** `deploy/rhyme-release.service`, `deploy/rhyme-release.timer` — version-controlled systemd units.
- **Create** tests: `tests/accept-notify.test.ts`, `tests/release-waitlist.test.ts`, `tests/cron-release-route.test.ts`, `tests/decide-signin.test.ts`.

No DB migration: `waitlist.accepted` and `waitlist.created_at` already exist.

---

## Task 1: Acceptance email helper

**Files:**
- Create: `lib/accept-notify.ts`
- Test: `tests/accept-notify.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/accept-notify.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendAcceptedEmail } from '@/lib/accept-notify';

describe('sendAcceptedEmail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('AUTH_RESEND_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM', 'noreply@rhymefor.fun');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://rhymefor.fun');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('returns false and does not call fetch when the key is missing', async () => {
    vi.stubEnv('AUTH_RESEND_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendAcceptedEmail('a@b.com')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns true when Resend responds ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendAcceptedEmail('a@b.com')).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    const body = JSON.parse(init.body);
    expect(body.to).toBe('a@b.com');
    expect(body.text).toContain('https://rhymefor.fun/login');
  });

  it('returns false when Resend responds non-ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('rate limited'),
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendAcceptedEmail('a@b.com')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/accept-notify.test.ts`
Expected: FAIL — cannot resolve `@/lib/accept-notify` (module does not exist).

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/accept-notify.ts
export async function sendAcceptedEmail(email: string): Promise<boolean> {
  const apiKey = process.env.AUTH_RESEND_KEY;
  const from = process.env.EMAIL_FROM;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rhymefor.fun';
  if (!apiKey || !from) return false;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: "You're in — start rhyming",
        text: `You're off the Rhyme Game waitlist! Sign in here: ${siteUrl}/login`,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '<no body>');
      console.warn(`[accept-notify] Resend returned ${res.status}: ${detail}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[accept-notify] failed to send acceptance email:', err);
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/accept-notify.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/accept-notify.ts tests/accept-notify.test.ts
git commit -m "feat(waitlist): acceptance email helper via Resend"
```

---

## Task 2: Release core

**Files:**
- Create: `lib/release-waitlist.ts`
- Test: `tests/release-waitlist.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/release-waitlist.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { query, sendAcceptedEmail } = vi.hoisted(() => ({
  query: vi.fn(),
  sendAcceptedEmail: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ pool: { query } }));
vi.mock('@/lib/accept-notify', () => ({ sendAcceptedEmail }));

import { releaseWaitlistBatch } from '@/lib/release-waitlist';

beforeEach(() => {
  query.mockReset();
  sendAcceptedEmail.mockReset();
});

it('selects oldest-first up to the limit', async () => {
  query
    .mockResolvedValueOnce({ rows: [] }) // SELECT (empty)
    .mockResolvedValueOnce({ rows: [{ count: 0 }] }); // remaining count
  await releaseWaitlistBatch(5);
  const [sql, params] = query.mock.calls[0];
  expect(sql).toContain('accepted = false');
  expect(sql).toContain('ORDER BY created_at ASC');
  expect(params).toEqual([5]);
});

it('emails then flips accepted only on send success', async () => {
  query
    .mockResolvedValueOnce({ rows: [{ email: 'a@b.com' }, { email: 'c@d.com' }] }) // SELECT
    .mockResolvedValueOnce({ rows: [] }) // UPDATE a
    .mockResolvedValueOnce({ rows: [] }) // UPDATE c
    .mockResolvedValueOnce({ rows: [{ count: 3 }] }); // remaining
  sendAcceptedEmail.mockResolvedValue(true);

  const result = await releaseWaitlistBatch(10);

  expect(result.accepted).toEqual(['a@b.com', 'c@d.com']);
  expect(result.failed).toEqual([]);
  expect(result.remaining).toBe(3);
  // 1 SELECT + 2 UPDATE + 1 count = 4 queries
  expect(query).toHaveBeenCalledTimes(4);
  expect(query.mock.calls[1][0]).toContain('UPDATE waitlist SET accepted = true');
  expect(query.mock.calls[1][1]).toEqual(['a@b.com']);
});

it('leaves a row pending (no UPDATE) when its email fails', async () => {
  query
    .mockResolvedValueOnce({ rows: [{ email: 'good@b.com' }, { email: 'bad@b.com' }] }) // SELECT
    .mockResolvedValueOnce({ rows: [] }) // UPDATE good
    .mockResolvedValueOnce({ rows: [{ count: 1 }] }); // remaining
  sendAcceptedEmail.mockImplementation((e: string) => Promise.resolve(e === 'good@b.com'));

  const result = await releaseWaitlistBatch(10);

  expect(result.accepted).toEqual(['good@b.com']);
  expect(result.failed).toEqual(['bad@b.com']);
  // Only ONE UPDATE happened (for good@b.com), so 1 SELECT + 1 UPDATE + 1 count = 3
  expect(query).toHaveBeenCalledTimes(3);
});

it('returns empty when the pool is undefined', async () => {
  vi.resetModules();
  vi.doMock('@/lib/db', () => ({ pool: undefined }));
  const mod = await import('@/lib/release-waitlist');
  expect(await mod.releaseWaitlistBatch(10)).toEqual({
    accepted: [],
    failed: [],
    remaining: 0,
  });
  vi.doUnmock('@/lib/db');
  vi.resetModules();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/release-waitlist.test.ts`
Expected: FAIL — cannot resolve `@/lib/release-waitlist`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/release-waitlist.ts
import { pool } from '@/lib/db';
import { sendAcceptedEmail } from '@/lib/accept-notify';

export interface ReleaseResult {
  accepted: string[];
  failed: string[];
  remaining: number;
}

export async function releaseWaitlistBatch(limit: number): Promise<ReleaseResult> {
  const accepted: string[] = [];
  const failed: string[] = [];
  if (!pool) return { accepted, failed, remaining: 0 };

  const { rows } = await pool.query<{ email: string }>(
    `SELECT email FROM waitlist
     WHERE accepted = false
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit],
  );

  for (const { email } of rows) {
    const sent = await sendAcceptedEmail(email);
    if (!sent) {
      failed.push(email);
      continue;
    }
    await pool.query(`UPDATE waitlist SET accepted = true WHERE email = $1`, [email]);
    accepted.push(email);
  }

  const { rows: countRows } = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM waitlist WHERE accepted = false`,
  );
  const remaining = Number(countRows[0]?.count ?? 0);

  return { accepted, failed, remaining };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/release-waitlist.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/release-waitlist.ts tests/release-waitlist.test.ts
git commit -m "feat(waitlist): release core with email-then-accept invariant"
```

---

## Task 3: Cron trigger route

**Files:**
- Create: `app/api/cron/release-waitlist/route.ts`
- Test: `tests/cron-release-route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/cron-release-route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { releaseWaitlistBatch } = vi.hoisted(() => ({ releaseWaitlistBatch: vi.fn() }));
vi.mock('@/lib/release-waitlist', () => ({ releaseWaitlistBatch }));
vi.mock('@/lib/db', () => ({ pool: {} }));

import { POST } from '@/app/api/cron/release-waitlist/route';

const post = (headers: Record<string, string> = {}) =>
  POST(new Request('http://localhost/api/cron/release-waitlist', { method: 'POST', headers }));

beforeEach(() => {
  releaseWaitlistBatch.mockReset();
  releaseWaitlistBatch.mockResolvedValue({ accepted: ['a@b.com'], failed: [], remaining: 7 });
  vi.stubEnv('CRON_SECRET', 'topsecret');
  vi.stubEnv('WAITLIST_DAILY_BATCH', '20');
  vi.stubEnv('REGISTRATION_OPEN', '');
});
afterEach(() => vi.unstubAllEnvs());

it('401s without a bearer header and never runs the batch', async () => {
  const res = await post();
  expect(res.status).toBe(401);
  expect(releaseWaitlistBatch).not.toHaveBeenCalled();
});

it('401s on a wrong bearer token', async () => {
  const res = await post({ authorization: 'Bearer nope' });
  expect(res.status).toBe(401);
});

it('401s when CRON_SECRET is unset (fail closed)', async () => {
  vi.stubEnv('CRON_SECRET', '');
  const res = await post({ authorization: 'Bearer topsecret' });
  expect(res.status).toBe(401);
});

it('accepts a batch of WAITLIST_DAILY_BATCH when registration is closed', async () => {
  const res = await post({ authorization: 'Bearer topsecret' });
  expect(res.status).toBe(200);
  expect(releaseWaitlistBatch).toHaveBeenCalledWith(20);
  expect(await res.json()).toEqual({ accepted: 1, failed: 0, remaining: 7 });
});

it('drains everything when REGISTRATION_OPEN=true', async () => {
  vi.stubEnv('REGISTRATION_OPEN', 'true');
  await post({ authorization: 'Bearer topsecret' });
  expect(releaseWaitlistBatch).toHaveBeenCalledWith(Number.MAX_SAFE_INTEGER);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cron-release-route.test.ts`
Expected: FAIL — cannot resolve `@/app/api/cron/release-waitlist/route`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/api/cron/release-waitlist/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { releaseWaitlistBatch } from '@/lib/release-waitlist';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!pool) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  const open = process.env.REGISTRATION_OPEN === 'true';
  const limit = open
    ? Number.MAX_SAFE_INTEGER
    : Number.parseInt(process.env.WAITLIST_DAILY_BATCH ?? '20', 10) || 20;

  const { accepted, failed, remaining } = await releaseWaitlistBatch(limit);
  return NextResponse.json({
    accepted: accepted.length,
    failed: failed.length,
    remaining,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/cron-release-route.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/release-waitlist/route.ts tests/cron-release-route.test.ts
git commit -m "feat(waitlist): bearer-protected cron release endpoint"
```

---

## Task 4: Extract the sign-in gate and add the open-registration branch

**Why extract:** `decideSignIn` currently lives inside `auth.ts`, which instantiates NextAuth at import time — importing it in a test is heavy and env-dependent. Moving the pure decision logic to `lib/decide-signin.ts` makes the gate unit-testable and is where the `REGISTRATION_OPEN` branch belongs.

**Files:**
- Create: `lib/decide-signin.ts`
- Test: `tests/decide-signin.test.ts`
- Modify: `auth.ts` (remove inline `decideSignIn` + its now-unused imports; import the new module)

- [ ] **Step 1: Write the failing test**

```ts
// tests/decide-signin.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { isEmailAccepted, upsertWaitlist, isInviteCookieValid, notifyWaitlistJoin } = vi.hoisted(() => ({
  isEmailAccepted: vi.fn(),
  upsertWaitlist: vi.fn(),
  isInviteCookieValid: vi.fn(),
  notifyWaitlistJoin: vi.fn(),
}));
vi.mock('@/lib/accepted-emails', () => ({ isEmailAccepted, upsertWaitlist }));
vi.mock('@/lib/invite', () => ({ isInviteCookieValid }));
vi.mock('@/lib/waitlist-notify', () => ({ notifyWaitlistJoin }));

import { decideSignIn } from '@/lib/decide-signin';

beforeEach(() => {
  isEmailAccepted.mockReset();
  upsertWaitlist.mockReset().mockResolvedValue(false);
  isInviteCookieValid.mockReset().mockReturnValue(false);
  notifyWaitlistJoin.mockReset();
  vi.stubEnv('REGISTRATION_OPEN', '');
});
afterEach(() => vi.unstubAllEnvs());

it('accepts everyone and skips the gate checks when REGISTRATION_OPEN=true', async () => {
  vi.stubEnv('REGISTRATION_OPEN', 'true');
  expect(await decideSignIn('open@b.com')).toBe(true);
  expect(upsertWaitlist).toHaveBeenCalledWith('open@b.com', true);
  expect(isInviteCookieValid).not.toHaveBeenCalled();
  expect(isEmailAccepted).not.toHaveBeenCalled();
});

it('accepts when the invite cookie is valid (flag off)', async () => {
  isInviteCookieValid.mockReturnValue(true);
  expect(await decideSignIn('invited@b.com')).toBe(true);
  expect(upsertWaitlist).toHaveBeenCalledWith('invited@b.com', true);
});

it('accepts an already-accepted email (flag off)', async () => {
  isEmailAccepted.mockResolvedValue(true);
  expect(await decideSignIn('member@b.com')).toBe(true);
});

it('waitlists and rejects an unknown email (flag off)', async () => {
  isEmailAccepted.mockResolvedValue(false);
  expect(await decideSignIn('stranger@b.com')).toBe(false);
  expect(upsertWaitlist).toHaveBeenCalledWith('stranger@b.com', false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/decide-signin.test.ts`
Expected: FAIL — cannot resolve `@/lib/decide-signin`.

- [ ] **Step 3: Create `lib/decide-signin.ts`**

```ts
// lib/decide-signin.ts
import { isEmailAccepted, upsertWaitlist } from '@/lib/accepted-emails';
import { isInviteCookieValid } from '@/lib/invite';
import { notifyWaitlistJoin } from '@/lib/waitlist-notify';

export async function decideSignIn(email: string): Promise<boolean> {
  if (process.env.REGISTRATION_OPEN === 'true') {
    await upsertWaitlist(email, true);
    return true;
  }
  if (isInviteCookieValid()) {
    const inserted = await upsertWaitlist(email, true);
    if (inserted) await notifyWaitlistJoin(email);
    return true;
  }
  if (await isEmailAccepted(email)) {
    return true;
  }
  const inserted = await upsertWaitlist(email, false);
  if (inserted) await notifyWaitlistJoin(email);
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/decide-signin.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Rewire `auth.ts` to use the extracted module**

In `auth.ts`, delete the inline `decideSignIn` function (lines defining `async function decideSignIn(...) { ... }`) and the three imports it solely used. Replace this block:

```ts
import { isEmailAccepted, upsertWaitlist } from './lib/accepted-emails';
import { isInviteCookieValid } from './lib/invite';
import { notifyWaitlistJoin } from './lib/waitlist-notify';
```

with:

```ts
import { decideSignIn } from './lib/decide-signin';
```

Then delete the entire `async function decideSignIn(email: string): Promise<boolean> { ... }` definition (the call sites in `authorize` and the Google `signIn` callback stay unchanged — they still call `decideSignIn(email)`).

- [ ] **Step 6: Verify the whole suite still passes and types check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no type errors. (`tsc` confirms `auth.ts` no longer references the removed imports and resolves `decideSignIn` from the new module.)

- [ ] **Step 7: Commit**

```bash
git add lib/decide-signin.ts tests/decide-signin.test.ts auth.ts
git commit -m "feat(auth): extract decideSignIn + REGISTRATION_OPEN branch"
```

---

## Task 5: Document the new env vars

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Append the new vars after the `POSTGRES_URL` block**

Add to `.env.example`:

```bash
# --- Waitlist auto-release (docs/superpowers/specs/2026-05-29-waitlist-auto-release-design.md) ---
# Shared secret the systemd timer presents to POST /api/cron/release-waitlist.
# Generate with: openssl rand -hex 32. The endpoint is internet-facing, so this
# token is the ONLY thing protecting it. The route fails closed if this is unset.
CRON_SECRET=
# How many oldest pending waitlisters each cron run accepts + emails. Default 20.
WAITLIST_DAILY_BATCH=20
# Set to "true" to open registration to everyone: decideSignIn then accepts every
# valid email, and the next cron run drains the entire remaining backlog.
REGISTRATION_OPEN=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(env): document waitlist auto-release vars"
```

---

## Task 6: Version-controlled systemd units

**Files:**
- Create: `deploy/rhyme-release.service`
- Create: `deploy/rhyme-release.timer`

- [ ] **Step 1: Create the service unit**

```ini
# deploy/rhyme-release.service
[Unit]
Description=Rhyme Game - release a batch of waitlisted users
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
EnvironmentFile=/home/deploy/rhyme-game/.env
ExecStart=/usr/bin/curl -fsS -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://127.0.0.1:3000/api/cron/release-waitlist
```

- [ ] **Step 2: Create the timer unit**

```ini
# deploy/rhyme-release.timer
[Unit]
Description=Rhyme Game - daily waitlist release

[Timer]
OnCalendar=*-*-* 09:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

- [ ] **Step 3: Commit**

```bash
git add deploy/rhyme-release.service deploy/rhyme-release.timer
git commit -m "chore(deploy): systemd units for daily waitlist release"
```

---

## Task 7: Full verification

- [ ] **Step 1: Run the entire test suite**

Run: `npx vitest run`
Expected: PASS — all suites green, including the four new test files.

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; Next build succeeds and lists `/api/cron/release-waitlist` among the routes.

- [ ] **Step 3: Commit any incidental fixes (only if Steps 1–2 required changes)**

```bash
git add -A
git commit -m "fix(waitlist): resolve type/build issues from verification"
```

---

## Task 8: Production rollout (operator runs sudo steps)

> Not code — a runbook. The `deploy` user has passwordless sudo only for `systemctl`; copying unit files into `/etc/systemd/system` needs an interactive sudo, so the operator runs these. The endpoint goes live with the next `scripts/deploy.sh`.

- [ ] **Step 1: Set the secret + batch size in the prod env**

```bash
ssh deploy@213.199.45.75
cd ~/rhyme-game
# Append the secret + batch size (REGISTRATION_OPEN stays unset for now):
printf 'CRON_SECRET=%s\nWAITLIST_DAILY_BATCH=20\n' "$(openssl rand -hex 32)" >> .env
chmod 600 .env
```

- [ ] **Step 2: Deploy the new code**

From the laptop: `./scripts/deploy.sh` (builds, ships, restarts `rhyme-game`).

- [ ] **Step 3: Smoke-test the endpoint manually (one small batch)**

```bash
ssh deploy@213.199.45.75 'cd ~/rhyme-game && set -a && . ./.env && set +a && \
  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/release-waitlist'
```
Expected JSON: `{"accepted":20,"failed":0,"remaining":<~170>}`. Confirm a test recipient actually received the email. Then verify a 401 with no header:
```bash
ssh deploy@213.199.45.75 'curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:3000/api/cron/release-waitlist'
```
Expected: `401`.

- [ ] **Step 4: Install the timer (sudo)**

```bash
scp deploy/rhyme-release.service deploy/rhyme-release.timer deploy@213.199.45.75:/tmp/
ssh -t deploy@213.199.45.75 '
  sudo cp /tmp/rhyme-release.service /tmp/rhyme-release.timer /etc/systemd/system/ &&
  sudo systemctl daemon-reload &&
  sudo systemctl enable --now rhyme-release.timer &&
  systemctl list-timers rhyme-release.timer'
```
Expected: the timer is listed with a NEXT firing at the upcoming 09:00.

- [ ] **Step 5: Confirm the drain over the following days**

`journalctl -u rhyme-release -n 20` after a run shows the curl exit 0. Track progress with the existing query:
```bash
ssh deploy@213.199.45.75 'cd ~/rhyme-game && set -a && . ./.env && set +a && \
  psql "$POSTGRES_URL" -c "SELECT created_at::date AS day, count(*) FROM users GROUP BY day ORDER BY day;"'
```

- [ ] **Step 6: Going fully open (later, when capacity allows)**

```bash
ssh deploy@213.199.45.75 "cd ~/rhyme-game && echo 'REGISTRATION_OPEN=true' >> .env"
# from laptop: ./scripts/deploy.sh   (or: ssh -t deploy@... 'sudo systemctl restart rhyme-game')
```
The next timer run drains the entire backlog (spilling over days if it exceeds Resend's 100/day cap). Once `remaining` hits 0, disable the timer:
```bash
ssh -t deploy@213.199.45.75 'sudo systemctl disable --now rhyme-release.timer'
```

---

## Self-Review

**Spec coverage:**
- Email-then-accept invariant → Task 2 (test + impl). ✓
- `accepted ⇒ notified` / failed send leaves row pending → Task 2 test 3. ✓
- Oldest-first fairness + limit → Task 2 test 1. ✓
- Bearer auth, 401 fail-closed, 503 no-pool, batch-vs-drain-all limit → Task 3. ✓
- `runtime = 'nodejs'` (Edge-runtime fix from spec self-review) → Task 3 impl. ✓
- Acceptance email via Resend, returns boolean, false when unconfigured → Task 1. ✓
- `REGISTRATION_OPEN` gate branch, accept-all + skip checks → Task 4. ✓
- Three env vars documented → Task 5. ✓
- systemd `.service` + `.timer`, `Persistent=true`, internet-facing secret → Tasks 6 & 8. ✓
- Open-up flow + backlog drain + Resend-cap spillover → Task 8 Step 6. ✓
- Conversion measurement (`users.created_at` vs `waitlist.created_at`) → Task 8 Step 5. ✓
- No DB migration needed (columns exist) → noted in File Structure. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code; every command has expected output. ✓

**Type consistency:** `ReleaseResult { accepted: string[]; failed: string[]; remaining: number }` defined in Task 2 and consumed identically in Task 3 (mapped to counts). `releaseWaitlistBatch(limit: number)` signature matches both call sites. `sendAcceptedEmail(email): Promise<boolean>` from Task 1 used in Task 2. `decideSignIn(email): Promise<boolean>` from Task 4 matches the call sites left in `auth.ts`. ✓
