# Invite link as sign-in pass

Reframes the `INVITE_CODE` mechanism: instead of gating *visibility* of `/login` behind an invite-code cookie, the cookie becomes a *self-onboarding token* that auto-accepts the visitor's email on first sign-in. `/login` is always publicly visible. Sign-in attempts without the invite cookie create a pending waitlist row for the operator to review manually.

## Motivation

Today's setup has a usability mismatch. The operator's intent (from the prior brainstorm) was:

> The invite link is a key — anyone with it can sign in immediately. Without it, you can browse the landing page and see the login form, but sign-in fails until I manually accept your email.

What's actually wired up does the opposite: the cookie gates whether you can *see* `/login` at all (via the closed-beta page), but it does nothing for the *sign-in* check itself, which is still purely `waitlist.accepted=true`. So the operator hitting the landing page's **Get started** button without ever having visited the invite URL gets a dead-end closed-beta page, even though there's no actual security boundary at that layer.

This spec realigns the implementation with the operator's mental model.

## Goals

- `/login` is publicly visible. Anyone can land on it, see the form, type an email, click Sign in.
- Visiting `/login?invite=<INVITE_CODE>` continues to set the existing `rhyme-invite` cookie (90-day Max-Age). The cookie's *meaning* changes from "permission to view" to "permission to sign in immediately".
- Sign-in flow (both Credentials/email and Google) executes this decision chain in order:
  1. **Validate email shape.** Cheap reject for malformed input.
  2. **Invite cookie valid?** → upsert into `waitlist` with `accepted=true` → succeed. (Visitor becomes a persistent accepted user; the cookie is no longer needed from their next session.)
  3. **Already in waitlist with `accepted=true`?** → succeed.
  4. **Otherwise** → upsert into `waitlist` with `accepted=false` (pending) → reject. UI shows the existing "Your account isn't accepted yet" message (Credentials) or "This account isn't on the access list" banner (Google).
- The standalone `<WaitlistForm>` in the auth card stays as a discoverable alternative; the sign-in flow now also accumulates the waitlist queue silently from rejection attempts.

## Non-goals

- No admin UI for accepting pending entries. Operator still flips the flag with `UPDATE waitlist SET accepted=true WHERE email=...` in psql. (Admin page remains its own follow-up spec.)
- No rate limiting on either sign-in endpoint, even though both now write to the DB on every attempt. Same posture as the existing waitlist endpoint.
- No abuse mitigation for the invite-link impersonation case (anyone with the link can sign in as any email). The operator has accepted this tradeoff: don't share the link publicly.
- No change to LoadingScreen, EndScreen, or any other route.
- No change to the operator's existing accepted row (`kvochkinvlad@gmail.com`).
- No new env vars.
- No DB migration. The `accepted` column already exists.

## Architecture

The change has three concentric layers:

1. **Middleware** loses the closed-beta-rewrite branch. It still detects and stores the invite cookie on `?invite=<code>` match, and still does the existing `auth()` work (protected-route redirects, logged-in-user-on-`/login` redirect to `/play`). That's all middleware needs to do — visibility decisions move out of it.

2. **`lib/invite.ts`** simplifies. `decideInvite()` keeps the `'pass'` (no env code OR cookie/query matches) and `'set'` (query code matches) verdicts and drops the `'closed'` verdict. A new sibling function `isInviteCookieValid()` reads `cookies()` from `next/headers` server-side and returns `true` iff a `rhyme-invite` cookie's value equals `process.env.INVITE_CODE` (and `INVITE_CODE` is non-empty).

3. **`auth.ts`** unifies the Credentials `authorize()` and the Google `signIn()` callback around a single new helper, `decideSignIn(email)`, that runs the four-step chain above. Both call sites stay thin — they validate inputs, invoke `decideSignIn`, and translate the result into the provider-appropriate return value (`{ id, email, name } | null` for Credentials; `true | false` for Google).

The fail-closed semantics from the previous design carry through: any DB error in the invite or waitlist helpers logs and returns the "treat as not-invited / not-accepted" outcome.

### Why a shared `decideSignIn`

Today the Credentials and Google paths repeat the same `isEmailAccepted` check. With the new logic adding two more conditional branches (invite-cookie path, pending upsert), inlining them in both places duplicates the logic and risks them drifting. A pure function `decideSignIn(email): Promise<{ allow: true } | { allow: false }>` that owns the chain is testable in isolation and keeps the provider callbacks one-liners.

## Components

### `lib/invite.ts` (modified)

Removes the `'closed'` variant of `InviteDecision`. The function signature becomes:

```typescript
export type InviteDecision =
  | { kind: 'pass' }
  | { kind: 'set'; code: string };

export function decideInvite(input: InviteInput): InviteDecision {
  if (input.queryCode && input.queryCode === input.envCode) {
    return { kind: 'set', code: input.envCode };
  }
  return { kind: 'pass' };
}
```

Note: with `INVITE_CODE` unset, `envCode` is `undefined` and `queryCode` can't match, so `'pass'` is returned — the same outcome as today's no-env-code branch.

Adds a new export:

```typescript
import { cookies } from 'next/headers';

export function isInviteCookieValid(): boolean {
  const env = process.env.INVITE_CODE;
  if (!env) return false;
  try {
    const cookie = cookies().get('rhyme-invite')?.value;
    return cookie === env;
  } catch {
    // cookies() throws if called outside a request scope (e.g. build).
    return false;
  }
}
```

What it does: tells the auth layer whether the current request's cookie carries the active invite code.
How to use it: `if (isInviteCookieValid()) { /* auto-accept */ }` inside any Node-runtime server callback.
Depends on: `next/headers`, `INVITE_CODE` env var.

### `lib/accepted-emails.ts` (modified)

Adds:

```typescript
export async function upsertWaitlist(
  email: string,
  accepted: boolean,
): Promise<void> {
  if (!email || !pool) return;
  try {
    await pool.query(
      `INSERT INTO waitlist (email, accepted) VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET accepted = EXCLUDED.accepted`,
      [email, accepted],
    );
  } catch (err) {
    console.warn('[accepted-emails] upsert failed:', err);
  }
}
```

Behaviour:
- Fresh email → inserted with the given `accepted` flag.
- Existing pending row + `accepted=true` → flips to accepted.
- Existing accepted row + `accepted=false` → flips to pending (revokes). This is intentional: it means a stale failed sign-in attempt from a previously-accepted user could downgrade them. The mitigation is the call-site order in `decideSignIn` (see below) — the pending upsert is only reached after the accepted check fails.

`isEmailAccepted` is unchanged.

### `auth.ts` (modified)

Adds a single private helper:

```typescript
async function decideSignIn(email: string): Promise<boolean> {
  if (isInviteCookieValid()) {
    await upsertWaitlist(email, true);
    return true;
  }
  if (await isEmailAccepted(email)) {
    return true;
  }
  await upsertWaitlist(email, false);
  return false;
}
```

The `Credentials.authorize()` callback becomes:

```typescript
async authorize(credentials) {
  const email = credentials?.email;
  if (typeof email !== 'string') return null;
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) return null;
  if (!(await decideSignIn(email))) return null;
  return { id: email, email, name: null };
},
```

The `signIn` callback for Google becomes:

```typescript
async signIn({ user, account }) {
  if (account?.provider === 'credentials') return true;
  if (account?.provider === 'google') {
    if (!user.email) return false;
    if (user.email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(user.email)) return false;
    return decideSignIn(user.email);
  }
  // Any other provider (including the registered-but-unused 'resend') is denied.
  return false;
},
```

`EMAIL_RE` and `MAX_EMAIL_LENGTH` stay where they are (still duplicated in `app/api/waitlist/route.ts` — out of scope for this spec).

### `middleware.ts` (modified)

The `if (path === '/login')` branch shrinks: it still handles the invite-cookie-set-from-query case and the logged-in-user redirect, but drops the closed-beta rewrite:

```typescript
if (path === '/login') {
  if (isLoggedIn) {
    return NextResponse.redirect(new URL('/play', nextUrl));
  }

  const decision = decideInvite({
    envCode: process.env.INVITE_CODE,
    queryCode: nextUrl.searchParams.get('invite') ?? undefined,
  });

  if (decision.kind === 'set') {
    const cleanUrl = new URL('/login', nextUrl);
    const res = NextResponse.redirect(cleanUrl, 307);
    res.cookies.set('rhyme-invite', decision.code, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 90 * 24 * 60 * 60,
    });
    return res;
  }
  // decision.kind === 'pass': fall through, render the login form normally.
}
```

Note: `decideInvite`'s `cookieCode` parameter is no longer consulted at the middleware layer (the cookie's value is now checked at sign-in time in `auth.ts`). The argument can be removed from `InviteInput` to keep the API honest.

### `app/login/page.tsx` (modified)

Drops the closed-beta branch entirely:

```typescript
import { Suspense } from 'react';
import { LoginContent } from './login-content';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
```

The `headers()` read, the `INVITE_STATE_HEADER` constants, and the `<ClosedBeta />` import all go.

### Files deleted

- `app/login/closed-beta.tsx`
- `app/login/closed-beta.test.tsx`

Their existence was tied to the closed-beta wall, which is gone.

### Files unchanged

- `app/login/login-content.tsx` — already shows the right messages for `error=AccessDenied` and the rejected-credentials state.
- `app/login/email-signin-form.tsx` — unchanged; the form still calls `signIn('credentials', {...})` and the same "Your account isn't accepted yet" copy is shown on rejection.
- `app/login/waitlist-form.tsx` — stays. It's still a discoverable signup path. Future spec may consolidate.
- `scripts/db-schema.sql` — no schema change.

## Data flow — credentials sign-in attempt (the four cases)

1. **Email accepted, no cookie.** `isEmailAccepted` returns true → `decideSignIn` returns true → `authorize` returns the user → JWT issued → `/play`.
2. **Email accepted, cookie present.** `isInviteCookieValid` returns true → `upsertWaitlist(email, true)` (no-op since already accepted) → `decideSignIn` returns true → success. Slightly wasteful query but not wrong; the alternative (check accepted first) makes the invite-path more expensive for the common case.
3. **Email unknown, cookie present.** `isInviteCookieValid` returns true → `upsertWaitlist(email, true)` (inserts new accepted row) → success. From their next session, the cookie is no longer needed.
4. **Email unknown, no cookie.** Neither branch matches → `upsertWaitlist(email, false)` (inserts pending row) → return false → UI shows "Your account isn't accepted yet". Operator now sees a new row in `waitlist` and can decide to accept.

Operator's accept action remains the same SQL:
```sql
UPDATE waitlist SET accepted = true WHERE email = '...';
```

## Data flow — Google sign-in attempt

Identical to credentials, except the email comes from the OAuth provider rather than user-typed input, and the rejection mapping is NextAuth's `AccessDenied` redirect (which the `login-content.tsx` `oauthError` handler already renders as "This account isn't on the access list").

## Side effects to name

- **Waitlist row creation is a write per failed sign-in attempt.** Spam-clicking the Sign in button with random emails creates rows. Acceptable for closed beta scale; revisit when sign-in attempts exceed a few per day.
- **Cookie acts as a one-time accepted-list grant.** Once auto-accepted, the user is independent of the cookie. So a single shared invite link, in the wrong hands, can flood the accepted-list. Operator controls exposure of the link.
- **Existing pending row, sign-in via invite cookie → upgrades to accepted.** This is the intended onramp.
- **Operator's existing accepted row is preserved.** The upsert never downgrades an accepted row through the invite path (the invite path always sets `accepted=true`); it can only downgrade through the rejected path, which is unreachable for accepted emails because the accepted-check short-circuits.

## Error handling

- **`isInviteCookieValid` errors** are impossible (`cookies()` and string compare don't throw in this context). If they ever did, the function returns false (treat as not invited).
- **`upsertWaitlist` errors** are caught, logged via `console.warn`, and return void. Sign-in continues with the next condition.
- **`isEmailAccepted` errors** stay as-is (fail-closed, return false).
- **Email validation rejection** (malformed input from credentials side) returns `null` without any DB write — no junk rows for typos.

## Testing

- **`lib/invite.test.ts`** (modified) — remove all `'closed'` assertions; the simplified `decideInvite` has two cases only. Add a test that `decideInvite({envCode:'x', queryCode:'x'})` returns `{kind:'set', code:'x'}` and that `decideInvite({envCode:'x', queryCode:'y'})` returns `{kind:'pass'}`.
- **`lib/invite.test.ts`** also gets coverage for `isInviteCookieValid`: mock `next/headers`' `cookies()`. Three cases:
  1. `INVITE_CODE` unset → returns false without reading cookies.
  2. Cookie value matches `INVITE_CODE` → returns true.
  3. Cookie absent or mismatched → returns false.
- **`lib/accepted-emails.test.ts`** (extended) — add `upsertWaitlist` cases:
  1. Inserts a fresh accepted row (mocked `pool.query` resolves; assert SQL contains `INSERT INTO waitlist` and `ON CONFLICT`).
  2. Inserts a fresh pending row.
  3. Pool unavailable → no-ops (no throw).
  4. Empty email → no-ops without querying.
  5. Query throws → catches, logs via `console.warn`, no rethrow.
- **`app/login/email-signin-form.test.tsx`** — no change. The mocked `signIn` makes the test agnostic to the new branching inside `authorize`.
- **`app/login/closed-beta.test.tsx`** — deleted.
- **`auth.ts`** — still no direct unit test (same posture as the prior auth spec). The four sign-in scenarios above are covered by the helper-level tests plus manual e2e (Task 8 equivalent in the implementation plan).

## Manual verification after deploy

1. Visit `https://rhymefor.fun/login` in a private window. Expect the sign-in form (no closed-beta page).
2. Type `pending-test-$(date +%s)@example.com`, click Sign in. Expect "Your account isn't accepted yet". `SELECT email, accepted FROM waitlist WHERE email='...'` confirms a new pending row.
3. Visit `https://rhymefor.fun/login?invite=give-asevlad-some-job-please` in a fresh private window. Expect redirect to `/login` with the `rhyme-invite` cookie set (visible in DevTools).
4. Type a fresh email `invited-test-$(date +%s)@example.com`, click Sign in. Expect redirect to `/play`. `SELECT email, accepted FROM waitlist WHERE email='...'` confirms `accepted=true`.
5. Sign out. Clear cookies. Try the same `invited-test-...` email — should succeed without the invite cookie now (it's already accepted).
6. Try a Google account whose email isn't accepted (and you're not using the invite cookie). Expect the branded `/login?error=AccessDenied` page with "This account isn't on the access list". `SELECT … WHERE email = <google-email>` confirms a pending row.

## Out of scope / follow-ups

- Admin page (spec 2 still pending).
- Email validation regex consolidation (`auth.ts` vs `app/api/waitlist/route.ts`).
- Operator notification when a sign-in attempt creates a pending waitlist row (the existing `notifyWaitlistJoin` only fires from the `/api/waitlist` form, not from these new sign-in upserts).
- Rate limiting on sign-in attempts now that they write to the DB.
- Visual indicator on the login form distinguishing "your account is pending" from "your account is unknown" (Option B from the earlier brainstorm; deferred).
