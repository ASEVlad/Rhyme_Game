# Login page polish & waitlist signup

Replaces the dev-only magic-link form on the login flow with a public waitlist signup that notifies the operator on every new email, while fixing two smaller login-page paper cuts (clickable header logo, removal of the dev login UI).

## Motivation

The login page is the front door for invited beta users, but two issues bleed credibility:

1. The `THE RHYME GAME` wordmark in the top nav is plain text — visitors expect to click it home, and there is no other obvious way back to the landing page from the auth card.
2. The dev-only credentials form ("Dev login (no Google/Resend needed)") is gated by `process.env.NODE_ENV === 'development'`, which is correct in principle but makes the source noisy and means the production page still ships the divider/spacing that surrounds the block in dev.

Meanwhile, uninvited visitors land on the `ClosedBeta` page and hit a dead end — "ask your friend for an invite link." That is fine messaging, but every one of those visitors is a lead the operator never hears about. The magic-link form on the invited login page is also dead weight: invited users sign in with Google, the magic-link path only exists because NextAuth's Resend provider was wired up early.

Repurposing that magic-link footprint as a waitlist signup, and adding the same form to the closed-beta page, gives uninvited visitors a way to raise their hand and gives the operator a notification stream for triaging access.

## Goals

- The wordmark in the top nav links to `/` on both the login page and the closed-beta page.
- The dev credentials form and the `Credentials` provider that powers it are removed entirely.
- Uninvited visitors (closed-beta page) can submit their email to a waitlist.
- Invited visitors (login page) can also submit their email to a waitlist (in place of the old magic-link form). Anyone with the `/login` URL — including people who land there from a shared link without an invite cookie set, or who arrive while the invite header check is still loading — should have a clear next step that isn't a dead-end Google button.
- Every successful waitlist submission stores the email in Postgres and sends a notification email to the operator.
- Duplicate submissions are idempotent — neither error nor double-notification.

## Non-goals

- No admin UI for browsing the waitlist. Operator reads notifications and/or queries the DB.
- No confirmation email to the joiner. In-page success message is enough.
- No additional fields beyond email. Form stays single-input.
- No rate limiting on `POST /api/waitlist` in this iteration. Public endpoint risk is acknowledged but out of scope.
- No replacement for the closed-beta "ask your friend for an invite link" copy. Waitlist form is additive.

## Architecture

Two flat layers:

- A shared `<WaitlistForm>` client component renders the email input and handles UI state (`idle | loading | sent | error`). It POSTs to `/api/waitlist` and renders a success message in place of the form when done.
- A `POST /api/waitlist` route handler validates the email, inserts into a new `waitlist` table via the shared Postgres pool, and sends a notification email to the operator via Resend's REST API. DB write is the source of truth; email failure is logged but does not fail the request.

The Postgres pool currently lives inside `auth.ts`. It moves to `lib/db.ts` so both auth and the waitlist route share one pool. NextAuth still owns the schema for users/accounts/sessions/verification_tokens; the new `waitlist` table is appended to `scripts/db-schema.sql`.

A `<LoginNav>` component absorbs the duplicated top-nav markup (wordmark + border-bottom) so the clickable-logo change is made once and both the invited and closed-beta paths get it.

## Components

### `lib/db.ts` (new)

Exports a singleton `pool` — `new pg.Pool({ connectionString: process.env.POSTGRES_URL })` if the env var is set, otherwise `undefined`. Replaces the inline pool in `auth.ts`.

What it does: gives every server-side caller (auth adapter, waitlist route, future API routes) a single connection pool.
How to use it: `import { pool } from '@/lib/db'`. Callers must handle `pool === undefined` (no DB configured).
Depends on: `pg`, `POSTGRES_URL` env.

### `app/login/login-nav.tsx` (new)

Server component (no client-side state). Renders the top nav bar with `THE RHYME GAME` wrapped in `<Link href="/">`. Hover state adds `opacity-80` for affordance.

What it does: provides the shared header used on both the login page and the closed-beta page.
How to use it: `<LoginNav />` at the top of the page's `<main>`.
Depends on: `next/link`.

### `app/login/waitlist-form.tsx` (new)

Client component. Owns local state `email` and `status`. On submit POSTs `{ email }` to `/api/waitlist`. Renders the same email input + gradient button as the current magic-link form; in `status === 'sent'` it replaces the form with `"You're on the list — we'll be in touch."`

What it does: collects an email and forwards it to the waitlist API, showing success/error inline.
How to use it: `<WaitlistForm label="Get notified when we open up" />` — the `label` prop is the small caption above the input so it can be customized per page.
Depends on: `fetch`, `/api/waitlist`.

### `app/api/waitlist/route.ts` (new)

`POST` handler. Reads `{ email }` from JSON body, validates that it's a string ≤ 254 chars matching `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (254 is the RFC 5321 path limit — enough for any real address, short enough that the DB and notify path can't be abused with megabyte payloads). Inserts into `waitlist` with `INSERT ... ON CONFLICT (email) DO NOTHING RETURNING id`. If a row was returned (fresh signup), calls `notifyWaitlistJoin(email)`. If the conflict swallowed the insert (already on the list), skips the notify. Returns `{ ok: true }` either way — the joiner sees the same success message.

What it does: persists waitlist signups and triggers the operator notification.
How to use it: `fetch('/api/waitlist', { method: 'POST', body: JSON.stringify({ email }) })`.
Depends on: `lib/db`, `lib/waitlist-notify`.

### `lib/waitlist-notify.ts` (new)

Exports `notifyWaitlistJoin(email: string): Promise<void>`. If `WAITLIST_NOTIFY_EMAIL` and `AUTH_RESEND_KEY` are both set, POSTs to `https://api.resend.com/emails` with a plain-text body. Otherwise no-ops (dev environments without Resend keep working). Catches and logs errors via `console.warn` so a failed send never bubbles into the API response.

What it does: sends the operator a notification email; no-ops cleanly when not configured.
How to use it: `await notifyWaitlistJoin('user@example.com')`.
Depends on: `EMAIL_FROM`, `WAITLIST_NOTIFY_EMAIL`, `AUTH_RESEND_KEY` env vars.

## Data flow

1. Visitor lands on `/login`. Middleware sets the invite-state header (existing behavior).
2. `page.tsx` renders either `LoginContent` (invited) or `ClosedBeta` (not invited). Both render `<LoginNav />` at the top.
3. Visitor types email into `<WaitlistForm>` and submits.
4. Form sets `status = 'loading'`, POSTs to `/api/waitlist`.
5. Route validates the email format. If invalid, returns `400 { error: 'invalid_email' }` and the form shows the error state.
6. Route inserts into `waitlist` via the shared pool. If `POSTGRES_URL` is unset, returns `503`.
7. Route checks the `RETURNING id` rowcount. If a fresh row was created, calls `notifyWaitlistJoin(email)`. If the email was already on the list (conflict), skips the notify so the operator isn't paged for re-submissions. Email send happens fire-and-await but its outcome does not affect the response — the DB write is the commitment.
8. Route returns `{ ok: true }`. Form switches to `status = 'sent'` and renders the success message.

## Database schema

Appended to `scripts/db-schema.sql`:

```sql
CREATE TABLE waitlist (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
```

Unique index on `email` makes `ON CONFLICT (email) DO NOTHING` cheap and gives idempotency for free. `created_at` lets the operator see signup order without joining tables.

## Environment

New env var:

- `WAITLIST_NOTIFY_EMAIL` — operator address that receives signup notifications. Optional; if unset, signups still persist but no email is sent (useful for local dev).

Existing env vars reused:

- `POSTGRES_URL` — already required by auth; now also required for waitlist persistence.
- `EMAIL_FROM` — `from` address on the notification email (same value the magic-link provider used).
- `AUTH_RESEND_KEY` — Resend API key (set automatically by the NextAuth Resend provider; the notify helper reads the same one).

## UI placement

**LoginContent** — the existing magic-link `<form>` block (currently `app/login/login-content.tsx:198-227`) is replaced with `<WaitlistForm label="Not invited yet? Join the waitlist." />`. The `or` divider above it stays — it now separates Google sign-in from the waitlist signup. The dev-login block (`app/login/login-content.tsx:152-196`) and its surrounding `or magic link` divider are deleted.

**ClosedBeta** — the existing copy ("Closed beta" heading + "ask your friend for an invite link") stays. Below it: a thin `border-t` divider, then `<WaitlistForm label="Get notified when we open up" />`. The "Back to home" link remains at the bottom.

Both pages now render `<LoginNav />` instead of their inline nav markup.

## Error handling

- **Invalid email format** — API returns `400 { error: 'invalid_email' }`. Form shows `"That doesn't look like a valid email."`
- **DB unavailable (`POSTGRES_URL` unset)** — API returns `503 { error: 'unavailable' }`. Form shows generic `"Something went wrong — try again."` and logs to console.
- **DB error** — API returns `500`. Same generic form message. Operator sees the error in server logs.
- **Resend send failure** — Logged via `console.warn` inside `notifyWaitlistJoin`. API response is unaffected — the DB row already committed.
- **Duplicate email** — `ON CONFLICT (email) DO NOTHING RETURNING id` returns no rows. The API skips the notify (so the operator isn't re-paged for someone already on the list) and still returns `{ ok: true }` with the same success message — the joiner can't tell whether this was their first submission or their fifth, which is correct: from their perspective, they're on the list either way.

## Auth config cleanup

The `Credentials` provider and `devCredentials` array in `auth.ts:4,11-23,32` exist solely to power the dev-login form being removed. They are deleted along with the form. `auth.ts` ends up importing only `NextAuth`, `PostgresAdapter`, the pool (now from `lib/db`), and `authConfig`.

## Testing

- **`app/login/login-content.test.tsx`** — update existing assertions: the page no longer shows the "Sign in (dev)" button or its caption; the waitlist input still uses the `your@email.com` placeholder but the submit button text is now `Join waitlist`.
- **`app/login/waitlist-form.test.tsx`** (new) — mock `fetch`. Cover three scenarios: idle → loading → sent (success), idle → error (400 response), and that submitting with an empty input is prevented by the `required` attribute on the input.
- **`app/login/closed-beta.test.tsx`** (new) — assert the existing copy still renders and the waitlist form is present.
- **`app/api/waitlist/route.test.ts`** — deferred. The repo has no existing API route tests; introducing the pattern (mocking `pg.Pool`, calling the handler as a function with a `Request`) is its own design decision and out of scope for this iteration. The route's logic is thin enough that the unit tests on `waitlist-notify` plus the form-level tests cover the integration surface.
- **`lib/waitlist-notify.test.ts`** (new) — mock `fetch`; assert the Resend request body when all env vars are set, and assert no fetch is made when `WAITLIST_NOTIFY_EMAIL` is unset.

## Out of scope / follow-ups

- Removing the NextAuth `Resend` provider from `auth.config.ts`. After this change no UI calls `signIn('resend', ...)`, but removing the provider also means dropping the adapter-gating filter in `auth.ts` (`providers.filter(p => p.type !== 'email')`). Leaving the wiring intact keeps the door open for a future "send me a link instead" option without re-plumbing auth. The notify path in this design uses Resend's REST API directly, so it doesn't depend on the NextAuth provider either way.
- Rate limiting and CAPTCHA on `/api/waitlist`.
- Admin UI for browsing/exporting the waitlist.
- Promoting a waitlist row into `ALLOWED_EMAILS` (currently still an env-var list).
- Confirmation email to the joiner.
- Webhook notification (Slack/Discord) as an alternative to email.
