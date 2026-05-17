# Email-allowlist sign-in

Replaces the existing magic-link form on the login page with a passwordless "type your email and sign in" flow. The accepted-users list moves from the `ALLOWED_EMAILS` env var to a new `accepted` flag on the existing `waitlist` table, so the gate is the same one for both Google and email sign-in. The Resend provider and its env vars stay in place as dormant plumbing for a follow-up spec that adds an admin page + acceptance-email flow.

## Motivation

Two friction points in the current login:

1. **Magic-link friction.** The existing `<EmailSignInForm>` calls `signIn('resend', ...)` to send a sign-in link. For a closed-beta game where the only access cost is "be on a small allowlist," this is heavyweight: it adds a second device (the inbox), a second click (the link), and a second possible failure (email delivery). The operator wants to type-an-email-and-be-in, accepting the impersonation risk (anyone who knows an accepted email can sign in as them — fine for a game with no destructive admin actions).
2. **Two parallel access lists.** Accepted users live in `ALLOWED_EMAILS` (env var, requires redeploy to edit). Waitlist signups live in the `waitlist` table. There's no link between them, and promoting someone is a manual edit-env-and-redeploy step. The spec collapses these into one source of truth: the waitlist table with an `accepted` flag. Adding someone is then a single `UPDATE` — and in the follow-up spec, an admin-page button click.

## Goals

- A user can type their email on `/login`, click **Sign in**, and — if their email is in the waitlist with `accepted=true` — land on `/play` signed in.
- A user whose email is not accepted (whether unknown, or on the waitlist but pending) sees **"Your account isn't accepted yet"** and the form stays available for retry.
- Google sign-in continues to work and uses the same accepted-flag check (no more `ALLOWED_EMAILS`).
- The existing `<WaitlistForm>` (separate form, lower on the page) is unchanged — uninvited visitors still have a way to raise their hand.
- All current `ALLOWED_EMAILS` entries continue to work after deploy (one-time SQL backfill, then the env var is dropped).

## Non-goals

- **No admin page.** Promoting someone is `UPDATE waitlist SET accepted=true WHERE email='...'` in psql. Admin UI lands in a follow-up spec.
- **No acceptance email.** When the flag is flipped, no email is sent yet. Also a follow-up.
- **No password support.** Authentication is passwordless — if your email is accepted, typing it is enough. The impersonation tradeoff is accepted.
- **No 6-digit code or any email send from this flow.** The Resend provider stays in `auth.ts` but no UI path triggers it.
- **No new rate limiting.** Same posture as the existing waitlist endpoint.
- **No removal of `verification_token` table or `Resend` provider.** Both stay dormant for the follow-up.

## Architecture

The change has three layers:

1. **DB** — one new column on the `waitlist` table (`accepted boolean default false`). The waitlist becomes the canonical accepted-users list. NextAuth's user/account/session tables are unaffected.
2. **Auth wiring** — a new `Credentials` provider in `auth.ts` authorizes by querying the waitlist. The `signIn` callback for Google also checks the waitlist instead of `ALLOWED_EMAILS`. `auth.config.ts` shrinks to just the edge-safe pieces (Google provider stub, `authorized` callback, `pages`, `session`), because the DB lookups must not run on the Edge runtime that the middleware imports.
3. **UI** — `<EmailSignInForm>` is rewritten to call `signIn('credentials', { email })` instead of `signIn('resend', ...)`. Button label, microcopy, and error states change accordingly. The form is no longer gated by an `emailEnabled` flag — it always renders.

### Why Credentials + JWT

NextAuth's `Credentials` provider returns a user object from a custom `authorize()` callback and is the standard way to plug a non-OAuth, non-magic-link sign-in into NextAuth. The session strategy is already `'jwt'` (set in `auth.config.ts`), which is required for credentials sign-in (DB-backed sessions can't co-exist with the credentials flow under NextAuth v5's adapter model). No user row is written for credentials sign-in — the JWT itself carries the email, which is the only identity we need.

### Why move the `signIn` callback to `auth.ts`

`auth.config.ts` is imported by `middleware.ts`, which runs on the Edge runtime. The Edge runtime can't open Postgres connections (the `pg` driver requires Node's `net` module). The current `signIn` callback in `auth.config.ts` is sync and reads only env vars, so it's edge-safe — but once it has to `await isEmailAccepted(...)`, it must live in the Node-runtime file (`auth.ts`). `auth.config.ts` keeps only the `authorized` callback (which middleware actually uses), `pages`, `session`, and the Google provider stub.

## Components

### `lib/accepted-emails.ts` (new)

Exports `isEmailAccepted(email: string | null | undefined): Promise<boolean>`. Returns `false` for null/undefined/empty input without hitting the DB. Otherwise runs `SELECT 1 FROM waitlist WHERE email=$1 AND accepted=true LIMIT 1` against the shared pool. Returns `true` iff a row is returned. Catches errors, logs via `console.warn`, and returns `false` (fail-closed — a DB hiccup must not silently grant access).

What it does: single source of truth for "is this email allowed to sign in?"
How to use it: `await isEmailAccepted(user.email)` from the Google `signIn` callback or from the credentials `authorize()`.
Depends on: `pool` from `lib/db`, the `waitlist` table.

### `auth.ts` (modified)

Adds two things to the existing config:

1. A `Credentials` provider whose `authorize({ email })` calls `isEmailAccepted(email)` and returns `{ id: email, email, name: null }` on success or `null` on rejection. Validates `email` is a non-empty string ≤ 254 chars matching the same regex used by the waitlist route (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) before hitting the DB — invalid input returns `null` without a DB roundtrip.
2. A `signIn` callback: for `account?.provider === 'google'`, calls `isEmailAccepted(user.email)`. For `account?.provider === 'credentials'`, returns `true` — already authorized by `authorize()`, and per NextAuth v5 the `signIn` callback is only invoked when `authorize()` already returned a user. Returning `false` triggers NextAuth's `AccessDenied` redirect, which the login page already handles via the `?error=` query string.

The `Resend` provider line stays in `auth.ts` untouched.

### `auth.config.ts` (modified — shrinks)

Removes `isEmailAllowed` and the `signIn` callback. Keeps `authorized`, `pages`, `session`, and the Google provider stub. The file is now purely edge-safe — no DB, no async callbacks.

### `app/login/email-signin-form.tsx` (rewritten)

Same React structure as today, but:

- Label microcopy: **"Sign in with your email"** stays (still accurate).
- Submit button label: **"Sign in"** (was "Send sign-in link"). Pending label: **"Signing in…"**.
- On submit, calls `signIn('credentials', { email, redirect: false, callbackUrl: '/play' })`.
- On `result?.ok && !result?.error`: triggers `window.location.assign(result.url ?? '/play')` (NextAuth's credentials sign-in doesn't auto-redirect when `redirect: false`).
- On `result?.error` (any error code): shows **"Your account isn't accepted yet"** in the existing red error slot. The form stays mounted for retry.
- The success-message branch ("Check your inbox…") is **deleted** — there's nothing to check for any more.

What it does: collects an email, calls NextAuth credentials sign-in, and either redirects to `/play` or shows the rejection message.
How to use it: `<EmailSignInForm />` — no props.
Depends on: `signIn` from `next-auth/react`.

### `app/login/login-content.tsx` (modified)

The `{emailEnabled && (<><EmailSignInForm /><divider/></>)}` block becomes unconditional:

```tsx
<EmailSignInForm />
<div className="…or…" />
<button onClick={() => signIn('google', { callbackUrl: '/play' })}>…</button>
```

The `or` divider between the email form and Google stays — it now separates two sign-in methods, both of which actually work.

### `app/login/page.tsx` (modified)

The `emailEnabled` computation is **deleted**. The `<LoginContent emailEnabled={emailEnabled} />` prop is removed.

### `scripts/db-schema.sql` (modified)

The `CREATE TABLE waitlist (...)` block gains the column:

```sql
CREATE TABLE waitlist (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL UNIQUE,
  accepted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);
```

The schema file is the canonical fresh-install script. Existing production DBs need the migration applied separately (see *Rollout* below).

### `auth.config.test.ts` (deleted)

The only thing it tests is `isEmailAllowed`, which is being deleted. Coverage of the new `authorized` callback (the only thing left in `auth.config.ts`) isn't worth adding — it's a 3-line route prefix check that's exercised by every protected-route test we already have.

## Data flow — sign-in attempt

1. User types email into `<EmailSignInForm>` and clicks **Sign in**.
2. Form sets `status = 'loading'`, calls `signIn('credentials', { email, redirect: false, callbackUrl: '/play' })`.
3. NextAuth's credentials handler invokes `authorize({ email })` in `auth.ts`.
4. `authorize` validates email shape, then calls `isEmailAccepted(email)`.
5. `isEmailAccepted` runs `SELECT 1 FROM waitlist WHERE email=$1 AND accepted=true LIMIT 1`.
   - Row returned → returns `true` → `authorize` returns the user object → NextAuth issues a JWT → returns `{ ok: true, url: '/play' }`.
   - No row → returns `false` → `authorize` returns `null` → NextAuth returns `{ ok: false, error: 'CredentialsSignin' }`.
   - DB throws → logs warning, returns `false` → same as no-row.
6. The form inspects the result:
   - `result.ok && !result.error` → `window.location.assign('/play')`.
   - Otherwise → status becomes `'error'`, shows "Your account isn't accepted yet".

## Data flow — Google sign-in (changed)

1. User clicks **Continue with Google**, completes Google OAuth.
2. NextAuth invokes the `signIn` callback in `auth.ts` with the Google user.
3. Callback calls `isEmailAccepted(user.email)`.
   - `true` → returns `true` → user is signed in, redirected to `/play`.
   - `false` → returns `false` → NextAuth redirects to `/login?error=AccessDenied`. The existing OAuth error banner in `login-content.tsx` already shows "This account isn't on the access list" for that error code.

No UI change is needed for the Google path — only the backing check moves from env var to DB.

## Rollout

Production currently has accepted users in `ALLOWED_EMAILS`. The cutover happens in this order:

1. **Deploy code** — `accepted` column added by editing `scripts/db-schema.sql`, but the column doesn't exist on prod yet. Add it manually before restart:
   ```sql
   ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS accepted BOOLEAN NOT NULL DEFAULT false;
   ```
2. **Backfill from env var** — for each email currently in the prod `ALLOWED_EMAILS`:
   ```sql
   INSERT INTO waitlist (email, accepted) VALUES ('...', true)
     ON CONFLICT (email) DO UPDATE SET accepted = true;
   ```
3. **Verify** — sign in with one of the backfilled emails, confirm the new flow works end-to-end.
4. **Drop the env var** — remove `ALLOWED_EMAILS` from prod env. The code no longer reads it.

Order matters: step 2 must precede the restart, otherwise existing users can't sign in. If the operator wants zero-downtime safety, they can do step 1 + 2 against prod *before* deploying the code — the new column is harmless to existing reads, and the `accepted=true` rows are also harmless to the current code (which doesn't query them).

Rollback: revert the code deploy. The `accepted` column can stay (unused by old code). The env-var entries should be restored from the operator's records if they were already removed in step 4.

## Error handling

- **Empty email** — `<form>` `required` attribute blocks submit on the client. The `authorize` server-side check still rejects empty strings as a defense in depth.
- **Malformed email** — `authorize` rejects without a DB roundtrip. UI shows the rejection message (same as not-accepted) — no separate "invalid email" branch, since the user typed gibberish either way and the next step is the same: try again.
- **DB unreachable / pool not configured** — `isEmailAccepted` catches and returns `false`. UI shows the rejection message. The operator sees the `console.warn` in the service logs.
- **NextAuth credentials throws** — `signIn` returns a rejected promise; the form's `catch` block sets `status = 'error'` and shows the same rejection message. (Currently the form has a separate "Something went wrong" message for the `catch` path. That's removed — for the user's purposes, "you couldn't sign in" is a single state.)
- **Google account whose email isn't accepted** — existing `AccessDenied` flow (already shows "This account isn't on the access list"). No change.

## Testing

- **`lib/accepted-emails.test.ts`** (new) — mock `pool.query`. Cases:
  1. `accepted=true` row exists → returns `true`.
  2. row exists but `accepted=false` → returns `false`.
  3. no row → returns `false`.
  4. `pool.query` rejects → returns `false` and `console.warn` is called once.
  5. `pool` is undefined (no `POSTGRES_URL`) → returns `false` without querying.
  6. null / undefined / empty-string input → returns `false` without querying.
- **`auth.config.test.ts`** — deleted (see *Components*).
- **`app/login/email-signin-form.test.tsx`** — rewritten. Mock `signIn`. Cover:
  - Renders input, label ("Sign in with your email"), and button ("Sign in").
  - Input is `required`.
  - Submit disabled until input has text.
  - Successful `signIn('credentials', { ok: true })` triggers `window.location.assign('/play')`. Mock `window.location` for assertion.
  - `signIn` returns `{ error: 'CredentialsSignin' }` → shows "Your account isn't accepted yet", form still rendered.
  - `signIn` rejects → same rejection message.
  - Pending state shows "Signing in…" and disables the button.
  - Editing the input after a rejection clears the error microcopy (same behavior as today).
- **`app/login/login-content.test.tsx`** — minor update: `<EmailSignInForm>` is always rendered now, so any test that relied on it being hidden when `emailEnabled=false` needs to be removed or repurposed.

## Environment

Removed:
- `ALLOWED_EMAILS` — deleted from `.env.example`, deleted from prod env after backfill.

Unchanged:
- `POSTGRES_URL` — required (already was).
- `AUTH_RESEND_KEY`, `EMAIL_FROM` — kept for the follow-up spec's acceptance email. Stays in `.env.example` with a comment noting it's currently unused by the UI but reserved.

No new env vars.

## Out of scope / follow-ups (spec 2)

- Admin page at `/admin/waitlist` (list view, accept action).
- `ADMIN_EMAILS` env var + middleware gate for `/admin/*`.
- `POST /api/admin/waitlist/accept` endpoint that sets `accepted=true` and sends an acceptance email via the Resend SDK.
- `lib/accept-notify.ts` — sends "you're in" email to the newly accepted user.
- Removing the `Resend` provider and `verification_token` table if spec 2 also concludes magic-link is permanently gone.
- An "Unaccept" / "Revoke" action and audit trail.
- Rate limiting on the credentials sign-in endpoint (anyone can probe email addresses for accepted-ness — a real concern but proportional to a closed beta with ~10 users).
