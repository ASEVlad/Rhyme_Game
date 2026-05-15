# Landing Page & Auth Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared-password auth system with Auth.js v5 (Google OAuth + magic link), add a public Ice & Chrome landing page at `/`, move the game to `/play`, and redesign the login page.

**Architecture:** Auth.js v5 uses a split config — `auth.config.ts` (Edge-safe, no DB import) for the middleware, and `auth.ts` (full config with PG adapter) for server components and API routes. Sessions use JWT strategy so middleware never hits the database. Vercel Postgres stores users, OAuth accounts, and magic link tokens.

**Tech Stack:** next-auth v5 (beta), @auth/pg-adapter, pg, next-auth/providers/google, next-auth/providers/resend, Vercel Postgres, Vitest

---

### Task 1: Install packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Auth.js and DB dependencies**

```bash
npm install next-auth@beta @auth/pg-adapter pg
npm install --save-dev @types/pg
```

Expected: packages added to `node_modules`, `package.json` updated, no `UNMET PEER` errors.

- [ ] **Step 2: Verify install**

```bash
npm ls next-auth @auth/pg-adapter pg
```

Expected: all three packages listed with version numbers.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add next-auth, @auth/pg-adapter, pg"
```

---

### Task 2: Provision Vercel Postgres + run schema

**Files:**
- Create: `scripts/db-schema.sql`

**External prerequisites — do these before the steps below:**

1. **Vercel Postgres:** In the Vercel dashboard → Storage → Create → Postgres. Link it to this project. This auto-adds `POSTGRES_URL` (and variants) to the project's env vars. Copy `POSTGRES_URL` from the dashboard into `.env.local`.

2. **Google OAuth app:** In [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth 2.0 Client (Web application). Add these authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://yourdomain.com/api/auth/callback/google`
   Copy the client ID and secret.

3. **Resend:** Create account at [resend.com](https://resend.com), verify your sending domain, create an API key.

4. **`.env.local`** — add all of these:
   ```
   AUTH_SECRET=<run: openssl rand -hex 32>
   AUTH_URL=http://localhost:3000
   GOOGLE_CLIENT_ID=<from Google Console>
   GOOGLE_CLIENT_SECRET=<from Google Console>
   RESEND_API_KEY=<from Resend dashboard>
   EMAIL_FROM=noreply@yourdomain.com
   ALLOWED_EMAILS=your@email.com
   POSTGRES_URL=<from Vercel dashboard>
   ```

- [ ] **Step 1: Create `scripts/db-schema.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  name TEXT,
  email TEXT UNIQUE,
  "emailVerified" TIMESTAMPTZ,
  image TEXT,
  PRIMARY KEY (id)
);

CREATE TABLE accounts (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  PRIMARY KEY (id),
  UNIQUE (provider, "providerAccountId")
);

CREATE TABLE sessions (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "sessionToken" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);
```

- [ ] **Step 2: Run schema against your Postgres database**

```bash
psql "$POSTGRES_URL" -f scripts/db-schema.sql
```

Expected: `CREATE TABLE` printed four times, no errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/db-schema.sql
git commit -m "chore: add Vercel Postgres schema for Auth.js"
```

---

### Task 3: Write `auth.config.ts` with allowlist tests (TDD)

**Files:**
- Create: `auth.config.ts`
- Create: `auth.config.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `auth.config.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isEmailAllowed } from './auth.config';

describe('isEmailAllowed', () => {
  beforeEach(() => vi.unstubAllEnvs());

  it('returns true for an email on the allowlist', () => {
    vi.stubEnv('ALLOWED_EMAILS', 'alice@example.com,bob@example.com');
    expect(isEmailAllowed('alice@example.com')).toBe(true);
  });

  it('returns false for an email not on the list', () => {
    vi.stubEnv('ALLOWED_EMAILS', 'alice@example.com');
    expect(isEmailAllowed('eve@example.com')).toBe(false);
  });

  it('trims whitespace around emails in the list', () => {
    vi.stubEnv('ALLOWED_EMAILS', ' alice@example.com , bob@example.com ');
    expect(isEmailAllowed('alice@example.com')).toBe(true);
  });

  it('returns false when ALLOWED_EMAILS is empty', () => {
    vi.stubEnv('ALLOWED_EMAILS', '');
    expect(isEmailAllowed('alice@example.com')).toBe(false);
  });

  it('returns false for null email', () => {
    vi.stubEnv('ALLOWED_EMAILS', 'alice@example.com');
    expect(isEmailAllowed(null)).toBe(false);
  });

  it('returns false for undefined email', () => {
    vi.stubEnv('ALLOWED_EMAILS', 'alice@example.com');
    expect(isEmailAllowed(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run auth.config.test.ts
```

Expected: 6 tests fail with `Cannot find module './auth.config'`.

- [ ] **Step 3: Write `auth.config.ts`**

Create `auth.config.ts` at the project root:

```ts
import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Resend from 'next-auth/providers/resend';

export function isEmailAllowed(email: string | null | undefined): boolean {
  const list = (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);
  return list.includes(email ?? '');
}

export const authConfig = {
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = ['/play', '/yt', '/calibrate'].some(p =>
        nextUrl.pathname.startsWith(p)
      );
      if (isProtected && !isLoggedIn) return false;
      if (nextUrl.pathname === '/login' && isLoggedIn) {
        return Response.redirect(new URL('/play', nextUrl));
      }
      return true;
    },
    signIn({ user }) {
      return isEmailAllowed(user.email);
    },
  },
  providers: [
    Google,
    Resend({ from: process.env.EMAIL_FROM ?? '' }),
  ],
} satisfies NextAuthConfig;
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run auth.config.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add auth.config.ts auth.config.test.ts
git commit -m "feat: add auth.config with allowlist signIn callback"
```

---

### Task 4: Write `auth.ts` and Auth.js API route

**Files:**
- Create: `auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create `auth.ts` at the project root**

```ts
import NextAuth from 'next-auth';
import PostgresAdapter from '@auth/pg-adapter';
import pg from 'pg';
import { authConfig } from './auth.config';

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PostgresAdapter(pool),
});
```

- [ ] **Step 2: Create the Auth.js catch-all API route**

Create `app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
```

- [ ] **Step 3: Commit**

```bash
git add auth.ts app/api/auth/
git commit -m "feat: set up Auth.js with Postgres adapter and Google + Resend providers"
```

---

### Task 5: Update middleware

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Replace `middleware.ts` entirely**

```ts
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|beats).*)'],
};
```

- [ ] **Step 2: Verify routing in dev server**

```bash
npm run dev
```

- Open `http://localhost:3000/api/auth/providers` → should return JSON listing `google` and `resend` providers
- Open `http://localhost:3000/play` → should redirect to `/login` (not authenticated yet)
- Open `http://localhost:3000/yt` → should redirect to `/login`
- Open `http://localhost:3000/calibrate` → should redirect to `/login`
- Open `http://localhost:3000/login` → should show the old login form (not yet redesigned)

If you see a database error, confirm `POSTGRES_URL` is set in `.env.local`.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: replace homegrown cookie middleware with Auth.js auth middleware"
```

---

### Task 6: Move game to `/play`, update logout

**Files:**
- Create: `app/play/page.tsx`
- Modify: `components/Game.tsx`

- [ ] **Step 1: Create `app/play/page.tsx`**

```tsx
import { Game } from '@/components/Game';

export default function PlayPage() {
  return <Game />;
}
```

- [ ] **Step 2: Update logout in `components/Game.tsx`**

Remove the `useRouter` import (line 2):
```ts
import { useRouter } from 'next/navigation';
```

Add `signOut` import after the existing imports:
```ts
import { signOut } from 'next-auth/react';
```

Replace the `logout` function and remove the `router` line:

Before (lines 11–20):
```ts
export function Game() {
  const router = useRouter();
  const {
    phase, activeBeat, languageId, bars, loadError, tick, pulseColor,
    handlePlay, quitToSetup, playAgain, goToSetup,
  } = useGamePhases();

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }
```

After:
```ts
export function Game() {
  const {
    phase, activeBeat, languageId, bars, loadError, tick, pulseColor,
    handlePlay, quitToSetup, playAgain, goToSetup,
  } = useGamePhases();

  async function logout() {
    await signOut({ callbackUrl: '/login' });
  }
```

- [ ] **Step 3: Verify game loads at `/play`**

With the dev server running, sign in via magic link (or temporarily set `ALLOWED_EMAILS` to your email, request a link, open it). Then open `http://localhost:3000/play` — should render the Setup screen. Pick a beat and press PLAY. Game should work normally.

- [ ] **Step 4: Commit**

```bash
git add app/play/page.tsx components/Game.tsx
git commit -m "feat: move game to /play, replace fetch logout with signOut"
```

---

### Task 7: Delete old auth files

**Files:**
- Delete: `lib/auth.ts`
- Delete: `lib/auth.test.ts`
- Delete: `app/api/login/route.ts`
- Delete: `app/api/logout/route.ts`

- [ ] **Step 1: Delete the files**

```bash
git rm lib/auth.ts lib/auth.test.ts app/api/login/route.ts app/api/logout/route.ts
```

- [ ] **Step 2: Run tests and build check**

```bash
npm run test
npm run build
```

Expected: all tests pass, build succeeds with no errors referencing the deleted files. If any remaining file imports from `lib/auth`, remove that import.

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: delete homegrown auth — replaced by Auth.js"
```

---

### Task 8: Redesign auth page (`/login`)

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Replace `app/login/page.tsx`**

```tsx
'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// useSearchParams() requires a Suspense boundary in Next.js 14 App Router.
// LoginContent holds all the form logic; LoginPage wraps it in Suspense.
function LoginContent() {
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

          {status === 'sent' ? (
            <p className="text-center text-sm text-white/70">
              Check your inbox — link sent to{' '}
              <span className="text-white font-medium">{email}</span>
            </p>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-3">
              {status === 'error' && (
                <p className="text-xs text-red-400 text-center">
                  This email isn&apos;t on the access list
                </p>
              )}
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
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

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify auth page**

With the dev server running, open `http://localhost:3000/login`:
- Ice & Chrome card with "Sign in" gradient heading ✓
- White Google button with Google icon ✓
- Cyan divider ✓
- Email input + "Send magic link" button ✓
- "← Back to home" link returns to `/` ✓
- Enter an email not in `ALLOWED_EMAILS` → "This email isn't on the access list" ✓
- Visit `/login?error=AccessDenied` → error message shown above card ✓

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: redesign login page with Google OAuth + magic link (Ice & Chrome)"
```

---

### Task 9: Build landing page (`/`)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx` with the landing page**

```tsx
import Link from 'next/link';

const GRID_CELLS = [
  { id: '0-0', variant: 'empty' }, { id: '0-1', variant: 'empty' }, { id: '0-2', variant: 'ball' },  { id: '0-3', variant: 'yellow' },
  { id: '1-0', variant: 'active' }, { id: '1-1', variant: 'active' }, { id: '1-2', variant: 'active' }, { id: '1-3', variant: 'blue' },
  { id: '2-0', variant: 'empty' }, { id: '2-1', variant: 'empty' }, { id: '2-2', variant: 'empty' }, { id: '2-3', variant: 'orange' },
  { id: '3-0', variant: 'empty' }, { id: '3-1', variant: 'empty' }, { id: '3-2', variant: 'empty' }, { id: '3-3', variant: 'red' },
] as const;

const CELL_CLASS: Record<string, string> = {
  empty:  'bg-white/[0.06]',
  active: 'bg-white/[0.15]',
  yellow: 'bg-[#ffd447]',
  blue:   'bg-[#3aa3ff]',
  orange: 'bg-[#ff8a3c]',
  red:    'bg-[#e44d4d]',
};

export default function LandingPage() {
  return (
    <main
      className="flex min-h-screen flex-col bg-[#060c14]"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(94,200,255,0.22) 0%, transparent 100%)' }}
    >
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[rgba(94,200,255,0.12)]">
        <span
          className="font-extrabold text-sm tracking-wide"
          style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          THE RHYME GAME
        </span>
        <Link
          href="/login"
          className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#060c14]"
          style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)' }}
        >
          Log in →
        </Link>
      </nav>

      {/* Split hero */}
      <div className="flex-1 grid md:grid-cols-2">
        {/* Left: pitch */}
        <div className="flex flex-col justify-center gap-5 px-8 py-12 md:px-12">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[rgba(94,200,255,0.65)]">
            Freestyle rap trainer
          </p>
          <h1
            className="text-5xl font-extrabold leading-tight md:text-6xl"
            style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            The Rhyme<br />Game
          </h1>
          <p className="text-base text-white/50 leading-relaxed max-w-xs">
            Beat plays. Ball bounces.<br />Your rhyme lands on time.
          </p>
          <Link
            href="/login"
            className="self-start rounded-2xl px-8 py-4 text-xl font-extrabold text-[#060c14]"
            style={{
              background: 'linear-gradient(135deg,#5ec8ff,#2860e0)',
              boxShadow: '0 0 32px rgba(94,200,255,0.40)',
            }}
          >
            GET STARTED →
          </Link>
        </div>

        {/* Right: decorative game grid (hidden on mobile) */}
        <div className="hidden md:flex flex-col items-center justify-center border-l border-[rgba(94,200,255,0.10)] px-12">
          <div className="grid grid-cols-4 gap-2 w-full max-w-xs">
            {GRID_CELLS.map(({ id, variant }) =>
              variant === 'ball' ? (
                <div key={id} className="relative h-14 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <div
                    className="w-5 h-5 rounded-full bg-[#ff9d2a]"
                    style={{ boxShadow: '0 0 12px rgba(255,157,42,0.8)' }}
                  />
                </div>
              ) : (
                <div key={id} className={`h-14 rounded-lg ${CELL_CLASS[variant]}`} />
              )
            )}
          </div>
          <p className="mt-4 text-xs text-white/30 tracking-wide">Calm Bap · 88 BPM</p>
        </div>
      </div>

      {/* Feature pills */}
      <div className="flex gap-3 px-8 py-6 md:px-12 border-t border-[rgba(94,200,255,0.08)]">
        {[
          { label: 'Beat', desc: 'Hip-hop instrumentals' },
          { label: 'Rhyme', desc: 'AI word prompts' },
          { label: 'Flow', desc: 'Lock to the bar' },
        ].map(({ label, desc }) => (
          <div
            key={label}
            className="flex-1 rounded-xl bg-[rgba(94,200,255,0.05)] border border-[rgba(94,200,255,0.12)] px-4 py-3 text-center"
          >
            <p className="text-xs font-bold text-white">{label}</p>
            <p className="text-xs text-white/40 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify landing page**

With the dev server running, open `http://localhost:3000`:
- Ice & Chrome background with cyan glow ✓
- Nav: logo left, "Log in →" right ✓
- Desktop: two-column — pitch left, game grid right ✓
- Mobile (resize browser <768px): single column, grid hidden ✓
- "Log in →" and "GET STARTED →" both navigate to `/login` ✓
- Feature pills visible at the bottom ✓

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add public landing page at / (Ice & Chrome, split layout)"
```

---

### Task 10: Smoke test end-to-end

Manual verification — no code changes.

- [ ] **Unauthenticated flow**
  - `http://localhost:3000` → landing page (not the game) ✓
  - Click "GET STARTED →" → `/login` ✓
  - Navigate directly to `/play` → redirected to `/login` ✓
  - Navigate directly to `/yt` → redirected to `/login` ✓
  - Navigate directly to `/calibrate` → redirected to `/login` ✓

- [ ] **Magic link flow**
  - On `/login`, enter an email in `ALLOWED_EMAILS`, click "Send magic link" → "Check your inbox" message ✓
  - Click link in email → lands on `/play`, game loads ✓
  - Click "Log out" in Setup → redirected to `/login` ✓
  - While logged in, navigate to `/login` → redirected to `/play` ✓

- [ ] **Allowlist rejection**
  - Log out, enter an email NOT in `ALLOWED_EMAILS` → "This email isn't on the access list" ✓

- [ ] **Google OAuth flow** (requires Google credentials configured)
  - "Continue with Google" → Google consent screen → sign in with an allowed account → `/play` ✓
  - Sign in with a non-allowed Google account → `/login?error=AccessDenied` → error shown ✓

- [ ] **Game integrity**
  - From `/play`, pick a beat, press PLAY — ball bounces, words appear, session completes ✓
