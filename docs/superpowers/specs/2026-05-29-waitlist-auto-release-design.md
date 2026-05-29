# Waitlist auto-release & open registration

Drains the waitlist automatically: a scheduled job accepts the N oldest pending signups each day and emails each one "you're in," until the operator flips a single flag that opens registration to everyone. Fulfils the "acceptance email" follow-up deferred by the email-allowlist spec ([2026-05-17-email-allowlist-signin-design.md](2026-05-17-email-allowlist-signin-design.md)), replacing its proposed admin page with a cron-driven drain plus a kill-switch for going fully open.

## Motivation

Registration has been frozen since 2026-05-18: there are 5 registered users, all from May 17–18, while the waitlist has grown to ~190 pending signups and is accelerating (~60/day). Two gaps cause this:

1. **No way in for the backlog.** Accepting someone today means a manual `UPDATE waitlist SET accepted=true`, and `notifyWaitlistJoin` emails the *operator*, not the user — so an accepted person is never told they can enter. The backlog can only grow.
2. **No controlled ramp.** The LLM backend runs on Gemini's free tier, whose rate caps are load-bearing (see the multi-key rotation + fallback in `lib/gemini.ts`). Letting ~190 active users in at once risks exhausting quota and degrading the experience for everyone.

The fix: a daily drip that accepts a bounded batch and notifies each user, plus a flag to switch to fully-open once capacity allows.

## Goals

- A scheduled job accepts the **N oldest pending** waitlist rows per run (oldest-first = fair queue) and emails each accepted user an invitation to sign in.
- An accepted user is **never silently accepted**: a row is flipped to `accepted=true` only after its acceptance email is successfully handed to Resend. Failed sends leave the row pending for the next run.
- The operator can flip a single env flag (`REGISTRATION_OPEN=true`) to (a) let every valid email sign in directly and (b) have the next job run drain the *entire* remaining backlog in one pass.
- Batch size and schedule are operator-tunable without code changes (env var + restart).
- The release core is unit-tested (ordering, email-then-accept invariant, failure handling) without requiring a live DB.

## Non-goals

- **No admin web page.** The trigger is a systemd timer hitting a protected endpoint; manual releases are a single `curl`.
- **No per-user unsubscribe / email preferences.** The acceptance email is transactional, sent once.
- **No change to the sign-in mechanics.** Google OAuth + the email Credentials flow are unchanged; this spec only changes *who the gate lets through* and *who gets told*.
- **No retry/bounce tracking beyond "leave it pending."** A hard-bouncing address is simply retried each run and logged; a failure cap is left for later (YAGNI).
- **No removal of `notifyWaitlistJoin`** (the operator-notification on new signups stays as-is).

## Architecture

Four layers, each independently testable:

1. **Config (env)** — three new vars in `/home/deploy/rhyme-game/.env`:
   - `CRON_SECRET` — bearer token the timer presents; the endpoint rejects anything else.
   - `WAITLIST_DAILY_BATCH` — integer, default `20`. Candidates accepted per gated run.
   - `REGISTRATION_OPEN` — `"true"` opens the gate to all and makes a run drain everything.
2. **Release core — `lib/release-waitlist.ts`** — pure-ish logic, the unit-tested heart.
3. **Trigger — `app/api/cron/release-waitlist/route.ts`** — thin HTTP wrapper: auth, decide the limit, call the core, return a summary.
4. **Notification — `lib/accept-notify.ts`** — Resend send for the "you're in" email.

Plus a one-line gate change in `auth.ts` and a systemd `.service` + `.timer` pair on the VPS.

### Release core — `lib/release-waitlist.ts`

```ts
export interface ReleaseResult { accepted: string[]; failed: string[]; remaining: number; }
export async function releaseWaitlistBatch(limit: number): Promise<ReleaseResult>;
```

Behavior:
1. If `pool` is undefined, return `{ accepted: [], failed: [], remaining: 0 }` (no-DB safety, mirrors existing helpers).
2. Select up to `limit` rows where `accepted=false`, ordered `created_at ASC`, `email` projected.
3. For each candidate **in order**: call `sendAcceptedEmail(email)`. On success, `UPDATE waitlist SET accepted=true WHERE email=$1` and push to `accepted`. On failure, log and push to `failed` (row stays pending).
4. Recompute `remaining = count(*) WHERE accepted=false` and return.

The email-then-flip ordering enforces the invariant **accepted ⇒ notified**. Acceptance is per-row (not a single bulk `UPDATE`) precisely so a failed send can leave exactly that row pending. `limit` may be a large sentinel (e.g. `Number.MAX_SAFE_INTEGER`) to mean "all remaining."

### Trigger — `app/api/cron/release-waitlist/route.ts`

- `POST` handler (no body needed).
- **Auth:** require `Authorization: Bearer <CRON_SECRET>`; if `CRON_SECRET` is unset or the header mismatches → `401`. (Constant-time compare not required — the secret is high-entropy and the endpoint is localhost-only, but reject early.)
- **No DB:** if `pool` is undefined → `503`.
- **Limit:** `REGISTRATION_OPEN==="true"` → drain all; else → `parseInt(WAITLIST_DAILY_BATCH ?? "20")`.
- Call `releaseWaitlistBatch(limit)`; respond `200` with `{ accepted: number, failed: number, remaining: number }` (counts, not raw emails, to keep PII out of timer logs).

### Notification — `lib/accept-notify.ts`

```ts
export async function sendAcceptedEmail(email: string): Promise<boolean>;
```

- Reads `AUTH_RESEND_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_SITE_URL` (default `https://rhymefor.fun`).
- If key or from missing → return `false` (caller leaves row pending).
- `POST https://api.resend.com/emails` with subject "You're in — start rhyming 🎤" and a short body linking to `${SITE_URL}/login`. Return `res.ok`.
- Mirrors the existing `lib/waitlist-notify.ts` structure (same fetch + error-logging shape).

### Gate change — `auth.ts` `decideSignIn`

Add one branch at the very top:

```ts
if (process.env.REGISTRATION_OPEN === 'true') {
  await upsertWaitlist(email, true); // record + mark accepted for bookkeeping
  return true;
}
```

Everything below (invite cookie → `isEmailAccepted` → waitlist-pending) is unchanged and only runs while the flag is off.

### Schedule — systemd (VPS)

- `rhyme-release.service` (`Type=oneshot`): `ExecStart=/usr/bin/curl -fsS -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://127.0.0.1:3000/api/cron/release-waitlist`, with `EnvironmentFile=/home/deploy/rhyme-game/.env` so `CRON_SECRET` resolves.
- `rhyme-release.timer`: `OnCalendar=*-*-* 09:00:00` (server is UTC+02), `Persistent=true` so a missed run (reboot) fires on next boot.
- Installed once with sudo (operator runs the provided commands); thereafter `journalctl -u rhyme-release` shows each run's summary.

## Data flow

```
systemd timer (daily 09:00)
  └─ curl -H "Bearer CRON_SECRET" → POST /api/cron/release-waitlist
       ├─ auth check (401 on mismatch) · DB check (503 if no pool)
       ├─ limit = REGISTRATION_OPEN ? ALL : WAITLIST_DAILY_BATCH
       └─ releaseWaitlistBatch(limit)
            ├─ SELECT oldest `limit` WHERE accepted=false ORDER BY created_at
            └─ per row: sendAcceptedEmail() ─success→ UPDATE accepted=true
                                            └fail→ leave pending, log
       └─ 200 { accepted, failed, remaining }

later: operator sets REGISTRATION_OPEN=true + restart
  ├─ decideSignIn accepts every valid email directly
  └─ next timer run drains the entire remaining backlog
```

## Error handling

- **Bad/absent secret** → `401`, no DB touched.
- **No DB pool** → `503` from route; core returns empty result.
- **Resend failure for a row** → that row stays `accepted=false`, logged via `console.warn`; retried next run. Other rows in the batch are unaffected (independent per-row try/catch).
- **Partial batch** → response reports `accepted` + `failed` separately so a spike in `failed` is visible in logs.
- **Timer fires while app is down** → `curl` fails, systemd logs non-zero exit; `Persistent=true` + next daily run self-heals (no state lost — nothing was accepted).
- **Resend free-tier cap (100 emails/day)** → if a single run tries to email more than the cap (most likely the `REGISTRATION_OPEN` drain-all on a large backlog), sends past the limit return non-OK and those rows stay pending — the email-then-accept invariant turns this into automatic spillover to the next daily run. No special handling needed. In practice the daily `WAITLIST_DAILY_BATCH=20` drip keeps the backlog small before open-up, so the final drain is well under the cap.

## Testing (vitest)

- `releaseWaitlistBatch`: with a mocked `pool.query` and mocked `sendAcceptedEmail` —
  - selects oldest-first and respects `limit`;
  - flips `accepted=true` only for rows whose email send returned `true`;
  - a failed send leaves that row out of `accepted`, in `failed`, and issues no `UPDATE` for it;
  - returns correct `remaining`.
- Route: returns `401` with no/incorrect bearer; `503` when pool is undefined; passes the open-vs-batch limit through correctly (mock the core).
- `sendAcceptedEmail`: returns `false` when `AUTH_RESEND_KEY`/`EMAIL_FROM` unset (no fetch attempted).

## Operational runbook

- **Start the drain:** set `CRON_SECRET`, `WAITLIST_DAILY_BATCH=20` in `.env`, install the timer, restart. Watch `journalctl -u rhyme-release -f`.
- **Tune the rate:** edit `WAITLIST_DAILY_BATCH`, `systemctl restart rhyme-game`. Watch Gemini quota headroom.
- **Manual release now:** `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/release-waitlist`.
- **Go fully open:** set `REGISTRATION_OPEN=true`, restart. The next timer run clears the backlog; new visitors sign in directly. The timer can then be disabled (`systemctl disable --now rhyme-release.timer`).
- **Measure conversion:** `users.created_at` (true registration) vs `waitlist.created_at` (gate-hit) — the gap per cohort is acceptance→sign-in lag.
