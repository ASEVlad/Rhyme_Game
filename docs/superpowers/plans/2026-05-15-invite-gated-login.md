# Invite-Gated Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide `/login` behind a shared invite code so only friends can see the sign-in form. The existing email allowlist remains the real security boundary.

**Architecture:** A pure `decideInvite()` helper in `lib/` is exercised by an extended `middleware.ts` (callback form of NextAuth's `auth()`). Middleware sets/checks an httpOnly cookie that mirrors `INVITE_CODE`; on a closed-beta verdict it rewrites `/login` with an `x-rhyme-invite-state: closed-beta` header. `app/login/page.tsx` becomes a server component that reads that header and renders either the existing sign-in form (extracted to a child) or a new ClosedBeta panel. The new middleware callback also replicates the routing logic from the existing `authorized` callback (protected-route redirects, signed-in-user-on-`/login` redirect), because under the callback form of `auth()` the `authorized` callback's response is not automatically applied. The `authorized` callback in `auth.config.ts` is left untouched to avoid scope creep, but it becomes effectively redundant under the new middleware.

**Tech Stack:** Next.js 14 App Router, NextAuth v5 (beta), vitest, React 18, TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-15-invite-gated-login-design.md`

---

## File Structure

**New files:**
- `lib/invite.ts` — pure `decideInvite()` function returning a tagged-union decision.
- `lib/invite.test.ts` — unit tests for `decideInvite`.
- `app/login/login-content.tsx` — extracted client component (the existing form code).
- `app/login/closed-beta.tsx` — new server component for the "closed beta" panel.

**Modified files:**
- `middleware.ts` — switch to callback form, add invite check on `/login`.
- `app/login/page.tsx` — becomes a server component that reads the header and branches.
- `.env.example` — document `INVITE_CODE`.

**Unchanged:** `auth.ts`, `auth.config.ts`, all other code.

---

### Task 1: Document INVITE_CODE in .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Append INVITE_CODE entry**

Replace the contents of `.env.example` with:

```
APP_PASSWORD=change-me
AUTH_SECRET=generate-with-openssl-rand-hex-32
ANTHROPIC_API_KEY=sk-ant-...

# Invite-only gate for /login. When set, only visitors who land on
# /login?invite=<code> (or who already have the matching cookie) see
# the sign-in form. Strangers see a "closed beta" page. Leave empty or
# unset to make /login publicly visible. Recommended: ~16 random chars.
INVITE_CODE=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: document INVITE_CODE env var"
```

---

### Task 2: Add `lib/invite.ts` decision helper (TDD)

**Files:**
- Create: `lib/invite.ts`
- Test: `lib/invite.test.ts`

The decision function is pure: given the env code, the query-string code, and the cookie code, return one of three verdicts:
- `pass` — let the request through to the login form (gate is off, or cookie is valid).
- `set` — query code is valid; middleware should set the cookie and redirect to a clean `/login`.
- `closed` — no valid invite present; middleware should rewrite to the closed-beta view.

- [ ] **Step 1: Write the failing tests**

Create `lib/invite.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { decideInvite } from './invite';

describe('decideInvite', () => {
  it('passes through when envCode is undefined (gate disabled)', () => {
    expect(decideInvite({ envCode: undefined })).toEqual({ kind: 'pass' });
  });

  it('passes through when envCode is empty string (gate disabled)', () => {
    expect(decideInvite({ envCode: '' })).toEqual({ kind: 'pass' });
  });

  it('returns set when queryCode matches envCode', () => {
    expect(
      decideInvite({ envCode: 'secret', queryCode: 'secret' })
    ).toEqual({ kind: 'set', code: 'secret' });
  });

  it('passes through when cookieCode matches envCode', () => {
    expect(
      decideInvite({ envCode: 'secret', cookieCode: 'secret' })
    ).toEqual({ kind: 'pass' });
  });

  it('returns closed when no code is provided', () => {
    expect(decideInvite({ envCode: 'secret' })).toEqual({ kind: 'closed' });
  });

  it('returns closed when queryCode does not match', () => {
    expect(
      decideInvite({ envCode: 'secret', queryCode: 'wrong' })
    ).toEqual({ kind: 'closed' });
  });

  it('returns closed when cookieCode is stale and no query is present', () => {
    expect(
      decideInvite({ envCode: 'secret', cookieCode: 'old' })
    ).toEqual({ kind: 'closed' });
  });

  it('prefers a matching queryCode over an existing matching cookie (re-sets the cookie)', () => {
    expect(
      decideInvite({ envCode: 'secret', queryCode: 'secret', cookieCode: 'secret' })
    ).toEqual({ kind: 'set', code: 'secret' });
  });

  it('passes through when query is wrong but cookie is valid', () => {
    expect(
      decideInvite({ envCode: 'secret', queryCode: 'wrong', cookieCode: 'secret' })
    ).toEqual({ kind: 'pass' });
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npx vitest run lib/invite.test.ts`
Expected: FAIL — module `./invite` not found.

- [ ] **Step 3: Implement the helper**

Create `lib/invite.ts`:

```ts
export type InviteDecision =
  | { kind: 'pass' }
  | { kind: 'set'; code: string }
  | { kind: 'closed' };

export interface InviteInput {
  envCode: string | undefined;
  queryCode?: string;
  cookieCode?: string;
}

export function decideInvite({
  envCode,
  queryCode,
  cookieCode,
}: InviteInput): InviteDecision {
  if (!envCode) return { kind: 'pass' };
  if (queryCode === envCode) return { kind: 'set', code: envCode };
  if (cookieCode === envCode) return { kind: 'pass' };
  return { kind: 'closed' };
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run lib/invite.test.ts`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/invite.ts lib/invite.test.ts
git commit -m "feat: add invite decision helper"
```

---

### Task 3: Extract LoginContent into its own client component (pure refactor)

This is a no-behavior-change refactor. The current `app/login/page.tsx` has `'use client'` at the top because `LoginContent` uses `useState`, `useSearchParams`, and `signIn`. To let `page.tsx` become a server component (Task 4), we move the form logic to a separate `'use client'` file.

**Files:**
- Create: `app/login/login-content.tsx`
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Create `app/login/login-content.tsx`**

Copy lines 1–167 of the current `app/login/page.tsx` into `app/login/login-content.tsx`, **export** the `LoginContent` function, and **remove** the trailing `LoginPage` default export. The new file should look like:

```tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// useSearchParams() requires a Suspense boundary in Next.js 14 App Router.
// The parent (page.tsx) wraps this in <Suspense>.
export function LoginContent() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const searchParams = useSearchParams();
  const oauthError = searchParams.get('error');

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    const result = await signIn('resend', { email, redirect: false });
    if (result?.error) {
      setStatus('error');
    } else {
      setStatus('sent');
    }
  }

  return (
    <main
      className="flex min-h-screen flex-col bg-[#060c14]"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(94,200,255,0.22) 0%, transparent 100%)' }}
    >
      <nav className="flex items-center px-6 py-4 border-b border-[rgba(94,200,255,0.12)]">
        <span
          className="font-extrabold text-sm tracking-wide"
          style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          THE RHYME GAME
        </span>
      </nav>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-5 rounded-2xl bg-[rgba(94,200,255,0.05)] border border-[rgba(94,200,255,0.15)] p-8">

          <div className="text-center space-y-1">
            <h1
              className="text-2xl font-extrabold"
              style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              Sign in
            </h1>
            <p className="text-sm text-white/45">Access requires an invitation</p>
          </div>

          {oauthError && (
            <p className="text-sm text-red-400 text-center">
              {oauthError === 'AccessDenied'
                ? "This account isn't on the access list"
                : 'Sign-in failed — try again'}
            </p>
          )}

          <button
            onClick={() => signIn('google', { callbackUrl: '/play' })}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-100 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-9 20-20 0-1.3-.1-2.7-.4-4z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.5 35.5 26.9 36.3 24 36.3c-5.2 0-9.6-3.4-11.2-8H6.5C9.9 38.4 16.4 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.4-2.4 4.4-4.5 5.8l6.2 5.2C40.6 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 text-xs text-white/30">
            <div className="flex-1 h-px bg-[rgba(94,200,255,0.12)]" />
            or
            <div className="flex-1 h-px bg-[rgba(94,200,255,0.12)]" />
          </div>

          {process.env.NODE_ENV === 'development' && status !== 'sent' && (
            <>
              <form
                onSubmit={async e => {
                  e.preventDefault();
                  setStatus('loading');
                  const result = await signIn('credentials', { email, redirect: false });
                  if (result?.error) {
                    setStatus('error');
                  } else {
                    window.location.href = '/play';
                  }
                }}
                className="space-y-3"
              >
                <p className="text-xs text-[rgba(94,200,255,0.6)] text-center">Dev login (no Google/Resend needed)</p>
                {status === 'error' && (
                  <p className="text-xs text-red-400 text-center">
                    Email not on access list
                  </p>
                )}
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setStatus('idle'); }}
                  className="w-full rounded-xl bg-[rgba(94,200,255,0.07)] border border-[rgba(94,200,255,0.25)] px-4 py-2.5 text-sm placeholder:text-white/30 outline-none focus:border-[rgba(94,200,255,0.5)]"
                />
                <button
                  type="submit"
                  disabled={status === 'loading' || !email}
                  className="w-full rounded-xl py-2.5 text-sm font-bold text-[#060c14] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)' }}
                >
                  {status === 'loading' ? 'Signing in…' : 'Sign in (dev)'}
                </button>
              </form>
              <div className="flex items-center gap-3 text-xs text-white/30">
                <div className="flex-1 h-px bg-[rgba(94,200,255,0.12)]" />
                or magic link
                <div className="flex-1 h-px bg-[rgba(94,200,255,0.12)]" />
              </div>
            </>
          )}

          {status === 'sent' ? (
            <p className="text-center text-sm text-white/70">
              Check your inbox — link sent to{' '}
              <span className="text-white font-medium">{email}</span>
            </p>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-3">
              {status === 'error' && process.env.NODE_ENV !== 'development' && (
                <p className="text-xs text-red-400 text-center">
                  This email isn&apos;t on the access list
                </p>
              )}
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setStatus('idle'); }}
                className="w-full rounded-xl bg-[rgba(94,200,255,0.07)] border border-[rgba(94,200,255,0.25)] px-4 py-2.5 text-sm placeholder:text-white/30 outline-none focus:border-[rgba(94,200,255,0.5)]"
              />
              <button
                type="submit"
                disabled={status === 'loading' || !email}
                className="w-full rounded-xl py-2.5 text-sm font-bold text-[#060c14] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)' }}
              >
                {status === 'loading' ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
          )}

          <p className="text-center text-xs text-white/35">
            <Link href="/" className="hover:text-white/60 transition-colors">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Reduce `app/login/page.tsx` to a thin wrapper**

Replace the entire contents of `app/login/page.tsx` with:

```tsx
'use client';

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

(`'use client'` stays on `page.tsx` for now; Task 4 removes it.)

- [ ] **Step 3: Verify types and that the login page still renders**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run dev` and visit `http://localhost:3000/login`.
Expected: the existing sign-in form renders exactly as before. Stop the dev server (`Ctrl-C`) when done.

- [ ] **Step 4: Commit**

```bash
git add app/login/login-content.tsx app/login/page.tsx
git commit -m "refactor: extract LoginContent into its own client component"
```

---

### Task 4: Convert page.tsx to a server component; add ClosedBeta panel

After this task, `page.tsx` is a server component that reads `x-rhyme-invite-state` from the request headers and renders one of two views. Middleware doesn't set the header yet, so the default (form) view continues to render.

**Files:**
- Create: `app/login/closed-beta.tsx`
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Create the ClosedBeta panel**

Create `app/login/closed-beta.tsx`:

```tsx
import Link from 'next/link';

export function ClosedBeta() {
  return (
    <main
      className="flex min-h-screen flex-col bg-[#060c14]"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(94,200,255,0.22) 0%, transparent 100%)' }}
    >
      <nav className="flex items-center px-6 py-4 border-b border-[rgba(94,200,255,0.12)]">
        <span
          className="font-extrabold text-sm tracking-wide"
          style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          THE RHYME GAME
        </span>
      </nav>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-5 rounded-2xl bg-[rgba(94,200,255,0.05)] border border-[rgba(94,200,255,0.15)] p-8">
          <div className="text-center space-y-2">
            <h1
              className="text-2xl font-extrabold"
              style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              Closed beta
            </h1>
            <p className="text-sm text-white/55">
              The Rhyme Game is in private testing. Ask your friend for an invite link.
            </p>
          </div>

          <p className="text-center text-xs text-white/35">
            <Link href="/" className="hover:text-white/60 transition-colors">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
```

Note: no `'use client'` directive — this is a server component (it only uses `<Link>` and static markup).

- [ ] **Step 2: Make page.tsx a server component that branches on the header**

Replace the entire contents of `app/login/page.tsx` with:

```tsx
import { Suspense } from 'react';
import { headers } from 'next/headers';
import { LoginContent } from './login-content';
import { ClosedBeta } from './closed-beta';

export default function LoginPage() {
  const inviteState = headers().get('x-rhyme-invite-state');
  if (inviteState === 'closed-beta') {
    return <ClosedBeta />;
  }
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
```

(`'use client'` is removed; this is now a server component.)

- [ ] **Step 3: Verify types and that the form still renders by default**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run dev` and visit `http://localhost:3000/login`.
Expected: the sign-in form still renders (middleware does not yet set the header). Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add app/login/page.tsx app/login/closed-beta.tsx
git commit -m "feat: branch login page on x-rhyme-invite-state header"
```

---

### Task 5: Wire invite logic into middleware

The existing `middleware.ts` exports `NextAuth(authConfig).auth` directly, so the NextAuth `authorized` callback in `auth.config.ts` IS the entire middleware. We switch to the callback form so we can run our own logic. Under the callback form, the `authorized` callback's `Response` return is not automatically applied — our callback has full control. So the new middleware must:

1. Replicate the protected-routes check (redirect unauth'd visits to `/play`, `/yt`, `/calibrate` → `/login`).
2. Replicate the signed-in-on-`/login` redirect (→ `/play`).
3. Run the invite decision for unauth'd visits to `/login`.

The `authorized` callback in `auth.config.ts` is left intact (no edits) — it becomes redundant for middleware decisions, but the `signIn` callback below it (the email allowlist) is still load-bearing and must not be touched.

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Rewrite middleware.ts**

Replace the entire contents of `middleware.ts` with:

```ts
import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from './auth.config';
import { decideInvite } from './lib/invite';

const { auth } = NextAuth(authConfig);

const PROTECTED_PREFIXES = ['/play', '/yt', '/calibrate'];

export default auth(req => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth?.user;
  const path = nextUrl.pathname;

  // Protected routes require auth
  if (PROTECTED_PREFIXES.some(p => path.startsWith(p)) && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  // /login routing
  if (path === '/login') {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/play', nextUrl));
    }

    const decision = decideInvite({
      envCode: process.env.INVITE_CODE,
      queryCode: nextUrl.searchParams.get('invite') ?? undefined,
      cookieCode: req.cookies.get('rhyme-invite')?.value,
    });

    if (decision.kind === 'pass') return;

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

    // decision.kind === 'closed'
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-rhyme-invite-state', 'closed-beta');
    return NextResponse.rewrite(nextUrl, { request: { headers: requestHeaders } });
  }

  // All other routes: pass through
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|beats).*)'],
};
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: gate /login behind INVITE_CODE in middleware"
```

---

### Task 6: End-to-end manual verification

The invite logic is too tangled with Next.js middleware machinery to unit-test cheaply, so we verify behavior manually. Run the dev server once and walk through each scenario.

**Setup:**

- [ ] **Step 1: Set up env for the test**

Edit your local `.env` (not committed) to include a known invite code, e.g.:

```
INVITE_CODE=test-invite-12345
```

Start the dev server: `npm run dev`. Keep it running for all scenarios; restart only if asked.

**Gate-disabled scenario:**

- [ ] **Step 2: With INVITE_CODE temporarily commented out, verify open access**

Comment out `INVITE_CODE=...` in `.env`, restart `npm run dev`, visit `http://localhost:3000/login` in a fresh incognito window.
Expected: sign-in form renders (gate disabled). Same as current production behavior.

Re-enable `INVITE_CODE=test-invite-12345` in `.env`, restart `npm run dev`.

**Stranger scenarios:**

- [ ] **Step 3: Stranger lands on /login**

In a fresh incognito window, visit `http://localhost:3000/login`.
Expected: "Closed beta" panel; no form; URL stays `/login`.

- [ ] **Step 4: Stranger tries a wrong invite code**

Visit `http://localhost:3000/login?invite=wrong-code`.
Expected: "Closed beta" panel; no cookie set in DevTools → Application → Cookies.

**Friend scenarios:**

- [ ] **Step 5: Friend uses the invite link**

Visit `http://localhost:3000/login?invite=test-invite-12345`.
Expected: redirected to `http://localhost:3000/login` (no query string); sign-in form renders; cookie `rhyme-invite=test-invite-12345` visible in DevTools (httpOnly, sameSite=Lax).

- [ ] **Step 6: Friend revisits /login without the query**

Open a new tab, visit `http://localhost:3000/login`.
Expected: sign-in form renders (cookie is honored).

**Kill-switch scenario:**

- [ ] **Step 7: Rotate INVITE_CODE and confirm existing friend is locked out**

Change `.env` to `INVITE_CODE=different-code-99999`. Restart `npm run dev`. In the same tab (with the old cookie still set), reload `http://localhost:3000/login`.
Expected: "Closed beta" panel — cookie no longer matches the new env value.

Restore `INVITE_CODE=test-invite-12345` and restart before continuing.

**Signed-in user scenarios:**

- [ ] **Step 8: Signed-in friend hits /login**

While in the friend's cookie-set tab, sign in (use the dev credentials form with an allowlisted email if you have one, or skip if not available locally). Then visit `http://localhost:3000/login`.
Expected: redirected to `/play` (handled by NextAuth's `authorized` callback). Invite state is irrelevant.

- [ ] **Step 9: Signed-in friend whose invite cookie has expired**

While signed in, manually delete the `rhyme-invite` cookie from DevTools, then visit `http://localhost:3000/login`.
Expected: still redirected to `/play` — the auth check takes precedence over the missing invite cookie.

- [ ] **Step 10: Protected route still requires auth**

Sign out. Visit `http://localhost:3000/play` directly.
Expected: redirected to `/login` (and from there, "Closed beta" if cookie is gone, or form if still present).

**Wrap up:**

- [ ] **Step 11: Stop dev server, clean up local env if desired**

Stop `npm run dev`. Optionally remove the `INVITE_CODE` line from your local `.env`.

No commit — verification is read-only.

---

## Notes for the implementer

- **NextAuth callback-form interplay:** Under `auth(req => …)`, our callback has full control over the middleware response. The `authorized` callback in `auth.config.ts` is not consulted for the final response decision, so the new middleware must replicate the redirect rules itself. The `authorized` callback is left in place to avoid churn, but it is effectively dead code as middleware logic. The `signIn` callback (email allowlist) is **not** affected — it still runs during the actual sign-in flow.
- **Cookie name collision:** NextAuth's own cookies are prefixed `authjs.*`. `rhyme-invite` won't clash.
- **Why `secure: process.env.NODE_ENV === 'production'`:** Local dev runs on `http://localhost`, where `secure: true` would prevent the browser from sending the cookie at all. Production runs over HTTPS, where `secure: true` is correct.
- **Why `307` and not `302`:** 307 preserves the request method. Not strictly necessary for a GET, but it's the more precise status code and matches Next.js's own redirect conventions.
- **Edge runtime constraints:** All code in `middleware.ts` runs in the edge runtime. The current code only uses `URL`, `NextResponse`, `Headers`, and `process.env`, all of which are edge-compatible.
