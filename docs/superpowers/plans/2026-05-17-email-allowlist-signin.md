# Email-allowlist sign-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the magic-link email form with a passwordless "type your email and sign in" flow gated by a new `accepted` flag on the existing `waitlist` table. Google sign-in switches to the same check; the `ALLOWED_EMAILS` env var is retired.

**Architecture:** A new pure-async `isEmailAccepted(email)` in `lib/accepted-emails.ts` is the single source of truth — queried by both a new NextAuth `Credentials` provider (for the email form) and the existing Google `signIn` callback. The `signIn` callback and Credentials provider live in `auth.ts` (Node runtime, can touch Postgres). `auth.config.ts` shrinks to the edge-safe pieces that `middleware.ts` needs. The login UI's email form is rewritten to call `signIn('credentials', ...)` and show "Your account isn't accepted yet" on any rejection.

**Tech Stack:** Next.js 14 App Router · NextAuth v5 (beta.31) · `@auth/pg-adapter` · Postgres (`pg`) · vitest + React Testing Library · jsdom test env.

**Spec:** [docs/superpowers/specs/2026-05-17-email-allowlist-signin-design.md](../specs/2026-05-17-email-allowlist-signin-design.md)

**Reading order before starting:**
- `lib/db.ts` — confirm `pool` export shape (`Pool | undefined`).
- `auth.config.ts` and `auth.ts` — current provider wiring.
- `app/login/email-signin-form.tsx` and its test — the file being rewritten.
- `app/api/waitlist/route.ts` — pattern for `pool.query` + email regex + `MAX_EMAIL_LENGTH`.

---

## Task 1: Add `accepted` column to the waitlist schema

**Files:**
- Modify: `scripts/db-schema.sql` (the `CREATE TABLE waitlist (...)` block)

- [ ] **Step 1: Add the column to the schema file**

  Open `scripts/db-schema.sql` and replace the existing `CREATE TABLE waitlist (...)` block with:

  ```sql
  CREATE TABLE waitlist (
    id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    email TEXT NOT NULL UNIQUE,
    accepted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
  );
  ```

  This file is the canonical fresh-install script; existing DBs get the column via the migration in Task 3.

- [ ] **Step 2: Commit**

  ```bash
  git add scripts/db-schema.sql
  git commit -m "db: add accepted column to waitlist schema"
  ```

---

## Task 2: Create `isEmailAccepted` helper (TDD)

**Files:**
- Create: `lib/accepted-emails.ts`
- Create: `lib/accepted-emails.test.ts`

- [ ] **Step 1: Write the failing test**

  Create `lib/accepted-emails.test.ts` with the following content:

  ```typescript
  import { describe, it, expect, vi, beforeEach } from 'vitest';

  vi.mock('@/lib/db', () => ({
    pool: { query: vi.fn() },
  }));

  // Imported after the mock so it picks up the stubbed pool.
  import { pool } from '@/lib/db';
  import { isEmailAccepted } from './accepted-emails';

  const mockQuery = (pool as { query: ReturnType<typeof vi.fn> }).query;

  describe('isEmailAccepted', () => {
    beforeEach(() => {
      mockQuery.mockReset();
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('returns true when an accepted row exists', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [{}] });
      await expect(isEmailAccepted('alice@example.com')).resolves.toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('accepted=true'),
        ['alice@example.com'],
      );
    });

    it('returns false when no row matches (unknown or pending)', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      await expect(isEmailAccepted('eve@example.com')).resolves.toBe(false);
    });

    it('returns false and logs when the query throws', async () => {
      mockQuery.mockRejectedValue(new Error('db down'));
      await expect(isEmailAccepted('alice@example.com')).resolves.toBe(false);
      expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it('returns false without querying for null / undefined / empty input', async () => {
      await expect(isEmailAccepted('')).resolves.toBe(false);
      await expect(isEmailAccepted(null)).resolves.toBe(false);
      await expect(isEmailAccepted(undefined)).resolves.toBe(false);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  ```bash
  npx vitest run lib/accepted-emails.test.ts
  ```

  Expected: **FAIL** — `Cannot find module './accepted-emails'` (the implementation doesn't exist yet).

- [ ] **Step 3: Implement `lib/accepted-emails.ts`**

  Create `lib/accepted-emails.ts` with:

  ```typescript
  import { pool } from '@/lib/db';

  export async function isEmailAccepted(
    email: string | null | undefined,
  ): Promise<boolean> {
    if (!email) return false;
    if (!pool) return false;
    try {
      const { rowCount } = await pool.query(
        'SELECT 1 FROM waitlist WHERE email=$1 AND accepted=true LIMIT 1',
        [email],
      );
      return (rowCount ?? 0) > 0;
    } catch (err) {
      console.warn('[accepted-emails] query failed:', err);
      return false;
    }
  }
  ```

- [ ] **Step 4: Run the test to verify it passes**

  ```bash
  npx vitest run lib/accepted-emails.test.ts
  ```

  Expected: **PASS** — 4 tests passing.

- [ ] **Step 5: Commit**

  ```bash
  git add lib/accepted-emails.ts lib/accepted-emails.test.ts
  git commit -m "feat(auth): add isEmailAccepted helper backed by waitlist table"
  ```

---

## Task 3: Apply the migration locally (manual, no commit)

This is a manual step the implementer runs against whatever Postgres instance they have for local development. It is not a code change.

- [ ] **Step 1: Check whether local Postgres is configured**

  ```bash
  grep -E "^POSTGRES_URL=" /home/asevlad/program_files/github_asevlad/Rhyme_Game/.env
  ```

  If empty / not set: skip the rest of this task. The unit tests pass without a DB; full end-to-end (Task 8) requires a DB but the implementer can run that against a dev/staging DB instead.

- [ ] **Step 2: Apply the migration**

  Using whatever psql client you use locally:

  ```sql
  ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS accepted BOOLEAN NOT NULL DEFAULT false;
  ```

- [ ] **Step 3: Backfill any local test emails**

  If you have a local `ALLOWED_EMAILS=foo@bar.com,...` and want those accounts to keep working after Task 4:

  ```sql
  INSERT INTO waitlist (email, accepted) VALUES ('foo@bar.com', true)
    ON CONFLICT (email) DO UPDATE SET accepted = true;
  ```

  Repeat for each email.

---

## Task 4: Refactor auth — DB-backed check + Credentials provider

This combines the `auth.config.ts` shrink, the new `auth.ts` wiring, and the deletion of `auth.config.test.ts` so that there is no intermediate state where Google sign-in has no allowlist check at all.

**Files:**
- Modify: `auth.config.ts` (delete `isEmailAllowed` and the `signIn` callback)
- Modify: `auth.ts` (add `Credentials` provider, add `signIn` callback)
- Delete: `auth.config.test.ts` (only tested `isEmailAllowed`, which is gone)

- [ ] **Step 1: Replace `auth.config.ts` with the edge-safe version**

  Replace the entire contents of `auth.config.ts` with:

  ```typescript
  import type { NextAuthConfig } from 'next-auth';
  import Google from 'next-auth/providers/google';

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
    },
    providers: [Google],
  } satisfies NextAuthConfig;
  ```

  Note what's gone: `isEmailAllowed` export, `signIn` callback (moves to `auth.ts`), the `ALLOWED_EMAILS` env-var read.

- [ ] **Step 2: Update `auth.ts` to add Credentials + signIn callback**

  Replace the entire contents of `auth.ts` with:

  ```typescript
  import NextAuth from 'next-auth';
  import Credentials from 'next-auth/providers/credentials';
  import Resend from 'next-auth/providers/resend';
  import PostgresAdapter from '@auth/pg-adapter';
  import { authConfig } from './auth.config';
  import { pool } from './lib/db';
  import { isEmailAccepted } from './lib/accepted-emails';

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const MAX_EMAIL_LENGTH = 254;

  export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    ...(pool ? { adapter: PostgresAdapter(pool) } : {}),
    providers: [
      ...authConfig.providers,
      Credentials({
        credentials: { email: { type: 'email' } },
        async authorize(credentials) {
          const email = credentials?.email;
          if (typeof email !== 'string') return null;
          if (email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) return null;
          if (!(await isEmailAccepted(email))) return null;
          return { id: email, email, name: null };
        },
      }),
      Resend({ from: process.env.EMAIL_FROM ?? '' }),
    ],
    callbacks: {
      ...authConfig.callbacks,
      async signIn({ user, account }) {
        if (account?.provider === 'credentials') return true;
        if (account?.provider === 'google') return isEmailAccepted(user.email);
        return false;
      },
    },
  });
  ```

  Notes:
  - The `Resend` provider line stays — it is dormant plumbing for the follow-up spec.
  - The `signIn` callback's `return false` for any unknown provider is a safe default; Resend sign-ins (if ever triggered) would be rejected here even though the provider is registered.
  - Credentials sign-in cannot use the Postgres adapter for user persistence, but we don't need a user row — the JWT carries the email as the id.

- [ ] **Step 3: Delete `auth.config.test.ts`**

  ```bash
  rm auth.config.test.ts
  ```

- [ ] **Step 4: Run the full test suite**

  ```bash
  npx vitest run
  ```

  Expected: **PASS** for everything except `email-signin-form.test.tsx` and possibly `login-content.test.tsx`. Those tests still reference the old magic-link UI; they get rewritten in Tasks 5 and 6. If anything else fails, debug before continuing.

- [ ] **Step 5: Typecheck**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add auth.config.ts auth.ts
  git add -u auth.config.test.ts
  git commit -m "refactor(auth): swap ALLOWED_EMAILS env var for DB-backed accepted flag + add credentials provider"
  ```

---

## Task 5: Rewrite `EmailSignInForm` (TDD)

**Files:**
- Modify (full rewrite): `app/login/email-signin-form.test.tsx`
- Modify (full rewrite): `app/login/email-signin-form.tsx`

- [ ] **Step 1: Replace the test file with the new tests**

  Replace the entire contents of `app/login/email-signin-form.test.tsx` with:

  ```typescript
  import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { signIn } from 'next-auth/react';
  import { EmailSignInForm } from './email-signin-form';

  vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));

  const assignMock = vi.fn();

  beforeEach(() => {
    (signIn as ReturnType<typeof vi.fn>).mockReset();
    assignMock.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...window.location, assign: assignMock },
    });
  });

  describe('EmailSignInForm', () => {
    it('renders the email input, label, and Sign in button', () => {
      render(<EmailSignInForm />);
      expect(screen.getByText(/sign in with your email/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    });

    it('marks the input as required', () => {
      render(<EmailSignInForm />);
      expect(screen.getByPlaceholderText('your@email.com')).toBeRequired();
    });

    it('disables submit until the user types', () => {
      render(<EmailSignInForm />);
      const btn = screen.getByRole('button', { name: /^sign in$/i });
      expect(btn).toBeDisabled();
      fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
        target: { value: 'me@example.com' },
      });
      expect(btn).not.toBeDisabled();
    });

    it('calls signIn("credentials", …) with the typed email on submit', async () => {
      (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        error: undefined,
        url: '/play',
      });
      render(<EmailSignInForm />);

      fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
        target: { value: 'me@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
      expect(signIn).toHaveBeenCalledWith('credentials', {
        email: 'me@example.com',
        redirect: false,
        callbackUrl: '/play',
      });
    });

    it('navigates to the returned url on success', async () => {
      (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        error: undefined,
        url: '/play',
      });
      render(<EmailSignInForm />);

      fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
        target: { value: 'me@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() => expect(assignMock).toHaveBeenCalledWith('/play'));
    });

    it('shows "Signing in…" while the signIn promise is pending', async () => {
      let resolveCall!: (v: unknown) => void;
      (signIn as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise(resolve => {
          resolveCall = resolve;
        }),
      );
      render(<EmailSignInForm />);

      fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
        target: { value: 'me@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /signing in…/i })).toBeDisabled(),
      );

      await act(async () => {
        resolveCall({ ok: true, error: undefined, url: '/play' });
      });
    });

    it('shows "not accepted yet" when signIn returns an error', async () => {
      (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        error: 'CredentialsSignin',
      });
      render(<EmailSignInForm />);

      fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
        target: { value: 'me@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() =>
        expect(screen.getByText(/account isn't accepted yet/i)).toBeInTheDocument(),
      );
      // Form remains for retry.
      expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
      // We did NOT navigate.
      expect(assignMock).not.toHaveBeenCalled();
    });

    it('shows "not accepted yet" when signIn rejects', async () => {
      (signIn as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
      render(<EmailSignInForm />);

      fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
        target: { value: 'me@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() =>
        expect(screen.getByText(/account isn't accepted yet/i)).toBeInTheDocument(),
      );
    });

    it('clears the error microcopy when the user edits the input again', async () => {
      (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        error: 'CredentialsSignin',
      });
      render(<EmailSignInForm />);

      fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
        target: { value: 'me@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

      await waitFor(() =>
        expect(screen.getByText(/account isn't accepted yet/i)).toBeInTheDocument(),
      );

      fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
        target: { value: 'me2@example.com' },
      });
      expect(screen.queryByText(/account isn't accepted yet/i)).not.toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  ```bash
  npx vitest run app/login/email-signin-form.test.tsx
  ```

  Expected: **FAIL** — the current implementation calls `signIn('resend', ...)` and shows "Send sign-in link" / "Check your inbox". Many assertions will fail.

- [ ] **Step 3: Replace the component with the new implementation**

  Replace the entire contents of `app/login/email-signin-form.tsx` with:

  ```typescript
  'use client';

  import { useState } from 'react';
  import { signIn } from 'next-auth/react';

  type Status = 'idle' | 'loading' | 'error';

  export function EmailSignInForm() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<Status>('idle');

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      setStatus('loading');
      try {
        const result = await signIn('credentials', {
          email,
          redirect: false,
          callbackUrl: '/play',
        });
        if (result?.ok && !result.error) {
          window.location.assign(result.url ?? '/play');
          return;
        }
        setStatus('error');
      } catch {
        setStatus('error');
      }
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-[rgba(94,200,255,0.6)] text-center">
          Sign in with your email
        </p>
        {status === 'error' && (
          <p aria-live="polite" className="text-xs text-red-400 text-center">
            Your account isn&apos;t accepted yet.
          </p>
        )}
        <input
          type="email"
          required
          maxLength={254}
          placeholder="your@email.com"
          aria-label="Email"
          autoComplete="email"
          value={email}
          onChange={e => {
            setEmail(e.target.value);
            if (status !== 'loading') setStatus('idle');
          }}
          className="w-full rounded-xl bg-[rgba(94,200,255,0.07)] border border-[rgba(94,200,255,0.25)] px-4 py-2.5 text-sm placeholder:text-white/30 outline-none focus:border-[rgba(94,200,255,0.5)]"
        />
        <button
          type="submit"
          disabled={status === 'loading' || !email}
          className="w-full rounded-xl py-2.5 text-sm font-bold text-[#060c14] disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)' }}
        >
          {status === 'loading' ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    );
  }
  ```

- [ ] **Step 4: Run the test to verify it passes**

  ```bash
  npx vitest run app/login/email-signin-form.test.tsx
  ```

  Expected: **PASS** — 9 tests passing.

- [ ] **Step 5: Commit**

  ```bash
  git add app/login/email-signin-form.tsx app/login/email-signin-form.test.tsx
  git commit -m "feat(login): rewrite email sign-in form for passwordless credentials flow"
  ```

---

## Task 6: Wire the form into the login page unconditionally

**Files:**
- Modify: `app/login/page.tsx` (drop `emailEnabled` computation and prop)
- Modify: `app/login/login-content.tsx` (drop prop + the `{emailEnabled && (...)}` wrapper)
- Modify: `app/login/login-content.test.tsx` (drop `emailEnabled` prop usage and the now-obsolete tests)

- [ ] **Step 1: Update `app/login/page.tsx`**

  Replace the entire contents of `app/login/page.tsx` with:

  ```typescript
  import { Suspense } from 'react';
  import { headers } from 'next/headers';
  import { INVITE_STATE_HEADER, INVITE_STATE_CLOSED_BETA } from '@/lib/invite';
  import { LoginContent } from './login-content';
  import { ClosedBeta } from './closed-beta';

  export default function LoginPage() {
    const inviteState = headers().get(INVITE_STATE_HEADER);
    if (inviteState === INVITE_STATE_CLOSED_BETA) {
      return <ClosedBeta />;
    }

    return (
      <Suspense>
        <LoginContent />
      </Suspense>
    );
  }
  ```

- [ ] **Step 2: Update `app/login/login-content.tsx`**

  Change the function signature from:

  ```typescript
  export function LoginContent({ emailEnabled }: { emailEnabled: boolean }) {
  ```

  to:

  ```typescript
  export function LoginContent() {
  ```

  Then locate the block (currently around lines 110–119) that reads:

  ```tsx
  {emailEnabled && (
    <>
      <EmailSignInForm />
      <div className="flex items-center gap-3 text-xs text-white/30">
        <div className="flex-1 h-px bg-[rgba(94,200,255,0.12)]" />
        or
        <div className="flex-1 h-px bg-[rgba(94,200,255,0.12)]" />
      </div>
    </>
  )}
  ```

  Replace it with the unconditional form:

  ```tsx
  <EmailSignInForm />
  <div className="flex items-center gap-3 text-xs text-white/30">
    <div className="flex-1 h-px bg-[rgba(94,200,255,0.12)]" />
    or
    <div className="flex-1 h-px bg-[rgba(94,200,255,0.12)]" />
  </div>
  ```

- [ ] **Step 3: Update `app/login/login-content.test.tsx`**

  Replace the entire contents of `app/login/login-content.test.tsx` with:

  ```typescript
  import { render, screen } from '@testing-library/react';
  import { describe, it, expect, vi } from 'vitest';
  import { LoginContent } from './login-content';

  vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));
  vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
  vi.mock('next/link', () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
      <a href={href} {...rest}>{children}</a>,
  }));

  describe('LoginContent', () => {
    it('renders branding column elements', () => {
      render(<LoginContent />);
      expect(screen.getByText('Freestyle rap trainer')).toBeInTheDocument();
      expect(screen.getByText('Calm Bap · 88 BPM')).toBeInTheDocument();
    });

    it('renders the auth card with Google sign-in', () => {
      render(<LoginContent />);
      // The "Sign in" heading is an h1; disambiguate from the form button.
      expect(screen.getByRole('heading', { name: /^sign in$/i })).toBeInTheDocument();
      expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    });

    it('renders the wordmark as a link to /', () => {
      render(<LoginContent />);
      const wordmark = screen.getByText('THE RHYME GAME');
      expect(wordmark.tagName).toBe('A');
      expect(wordmark).toHaveAttribute('href', '/');
    });

    it('renders the email sign-in form (always)', () => {
      render(<LoginContent />);
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    });

    it('renders the waitlist form', () => {
      render(<LoginContent />);
      expect(screen.getByRole('button', { name: /join waitlist/i })).toBeInTheDocument();
    });

    it('does not render the dev-login form', () => {
      render(<LoginContent />);
      expect(screen.queryByText(/dev login/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /sign in \(dev\)/i })).not.toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 4: Run the affected tests**

  ```bash
  npx vitest run app/login/
  ```

  Expected: **PASS** for `login-content.test.tsx`, `email-signin-form.test.tsx`, `closed-beta.test.tsx`, and `waitlist-form.test.tsx`.

- [ ] **Step 5: Typecheck**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add app/login/page.tsx app/login/login-content.tsx app/login/login-content.test.tsx
  git commit -m "refactor(login): always render email sign-in form (drop emailEnabled gate)"
  ```

---

## Task 7: Drop `ALLOWED_EMAILS` from `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Remove the line**

  Open `.env.example`. Find and delete the line:

  ```
  ALLOWED_EMAILS=you@example.com,teammate@example.com
  ```

  If there's a comment line above it explaining `ALLOWED_EMAILS`, delete that too.

  Leave `POSTGRES_URL`, `EMAIL_FROM`, `AUTH_RESEND_KEY` untouched — `AUTH_RESEND_KEY` and `EMAIL_FROM` stay reserved for the follow-up spec's acceptance-email feature.

- [ ] **Step 2: Run the full test suite + typecheck (sanity)**

  ```bash
  npx vitest run && npx tsc --noEmit
  ```

  Expected: both pass.

- [ ] **Step 3: Commit**

  ```bash
  git add .env.example
  git commit -m "chore: drop ALLOWED_EMAILS env var (replaced by waitlist.accepted)"
  ```

---

## Task 8: End-to-end verification

This task is manual. It produces no commit.

- [ ] **Step 1: Start dev server (with a DB)**

  If you don't have local Postgres, point your `POSTGRES_URL` at a dev/staging instance whose `waitlist` table has the `accepted` column applied. Then:

  ```bash
  npm run dev
  ```

  Expected: server starts at `http://localhost:3000`, no errors in the terminal.

- [ ] **Step 2: Seed a test row**

  Against the same DB the dev server is using:

  ```sql
  INSERT INTO waitlist (email, accepted) VALUES ('accepted@test.dev', true)
    ON CONFLICT (email) DO UPDATE SET accepted = true;
  INSERT INTO waitlist (email, accepted) VALUES ('pending@test.dev', false)
    ON CONFLICT (email) DO UPDATE SET accepted = false;
  ```

- [ ] **Step 3: Browser check — accepted email**

  Open `http://localhost:3000/login`. Type `accepted@test.dev` and click **Sign in**.
  Expected: redirect to `/play`, signed in.

- [ ] **Step 4: Browser check — pending email**

  Sign out (or use a private window). Open `/login`. Type `pending@test.dev` and click **Sign in**.
  Expected: form shows **"Your account isn't accepted yet."** Page stays on `/login`.

- [ ] **Step 5: Browser check — unknown email**

  Type `nobody@test.dev` and click **Sign in**.
  Expected: same **"Your account isn't accepted yet."** message.

- [ ] **Step 6: Google sign-in still works**

  If Google OAuth is configured locally: click **Continue with Google** and sign in with an account whose email is in the waitlist with `accepted=true`. Expected: redirect to `/play`. Then repeat with an account whose email is NOT accepted — expected: redirect to `/login?error=AccessDenied` with the "This account isn't on the access list" banner.

- [ ] **Step 7: Waitlist form still works**

  Type a new email into the **Join waitlist** form. Expected: success message, row inserted in `waitlist` with `accepted=false`, operator notification email sent (if configured).

---

## Production deployment notes (out of band, not a commit)

The plan above ships safely to dev. The order for production is:

1. Apply the schema migration **before** deploying the code:
   ```sql
   ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS accepted BOOLEAN NOT NULL DEFAULT false;
   ```
2. Backfill from the current prod `ALLOWED_EMAILS`. For each email currently in that env var:
   ```sql
   INSERT INTO waitlist (email, accepted) VALUES ('...', true)
     ON CONFLICT (email) DO UPDATE SET accepted = true;
   ```
3. Verify with `SELECT email FROM waitlist WHERE accepted=true ORDER BY email;` that everyone you expect is present.
4. Run `scripts/deploy.sh`.
5. Smoke-test: sign in with one of the previously-allowed Google accounts; confirm it still works.
6. Remove `ALLOWED_EMAILS` from the production env.

Rollback: revert the deploy. The `accepted` column can stay (harmless to old code). If `ALLOWED_EMAILS` was already unset in step 6, restore it from operator records.

---

## Spec coverage cross-check

| Spec section / requirement | Task |
|---|---|
| `accepted` column on `waitlist` | Task 1 |
| `lib/accepted-emails.ts` with all listed edge cases | Task 2 |
| `auth.config.ts` shrunk to edge-safe pieces | Task 4 |
| `Credentials` provider with email-shape validation + DB check | Task 4 |
| `signIn` callback: Google → DB check, credentials → pass-through | Task 4 |
| `Resend` provider stays dormant | Task 4 (left intact) |
| `auth.config.test.ts` deleted | Task 4 |
| `EmailSignInForm` rewrite (button label, error microcopy, success branch removed) | Task 5 |
| `login-content.tsx` form unconditional | Task 6 |
| `login-content.test.tsx` updated | Task 6 |
| `page.tsx` drops `emailEnabled` | Task 6 |
| `.env.example`: `ALLOWED_EMAILS` removed, Resend keys retained | Task 7 |
| Rollout / backfill SQL | "Production deployment notes" section |
| E2E manual verification (accepted / pending / unknown / Google / waitlist) | Task 8 |
