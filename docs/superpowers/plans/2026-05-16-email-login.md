# Email Magic-Link Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a magic-link email sign-in option to `/login` (above the existing Google button) so approved users — those on `ALLOWED_EMAILS` — can sign in by typing their email instead of using Google. The Resend provider and Postgres adapter are already wired in `auth.ts` / `auth.config.ts`; this plan only adds the missing UI and threads a server-side enablement check.

**Architecture:** A new client component `EmailSignInForm` calls `signIn('resend', { email, redirect: false, callbackUrl: '/play' })` and renders idle/loading/sent/invalid/error states with the same visual styling as `WaitlistForm`. `LoginContent` takes a new boolean prop `emailEnabled` and renders the new form (plus a fresh `or` divider) above the Google button when true. `app/login/page.tsx` computes `emailEnabled` server-side from `POSTGRES_URL`, `AUTH_RESEND_KEY`, and `EMAIL_FROM`, so the form never renders when the back-end can't service it.

**Tech Stack:** TypeScript, React, Next.js 14 App Router, `next-auth@5.0.0-beta` with Resend provider + `@auth/pg-adapter`, Tailwind CSS, Vitest + `@testing-library/react`.

**Spec:** [docs/superpowers/specs/2026-05-16-email-login-design.md](../specs/2026-05-16-email-login-design.md)

---

## File Structure

| Path | Action | Responsibility |
|------|--------|---------------|
| `app/login/email-signin-form.tsx` | **Create** | Client component: email input + Send-sign-in-link button + state machine |
| `app/login/email-signin-form.test.tsx` | **Create** | Unit tests for the new form |
| `app/login/login-content.tsx` | **Modify** | Accept `emailEnabled` prop; conditionally render `EmailSignInForm` |
| `app/login/login-content.test.tsx` | **Modify** | Add `emailEnabled` to call sites; replace the obsolete "no magic-link form" assertion with parametric coverage |
| `app/login/page.tsx` | **Modify** | Compute `emailEnabled` from env; pass into `LoginContent` |

---

### Task 1: Create `EmailSignInForm` with failing tests

**Files:**
- Create: `app/login/email-signin-form.tsx`
- Create: `app/login/email-signin-form.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `app/login/email-signin-form.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signIn } from 'next-auth/react';
import { EmailSignInForm } from './email-signin-form';

vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));

describe('EmailSignInForm', () => {
  beforeEach(() => {
    (signIn as ReturnType<typeof vi.fn>).mockReset();
  });

  it('renders the input, label, and submit button', () => {
    render(<EmailSignInForm />);
    expect(screen.getByText(/sign in with your email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /send sign-in link/i }),
    ).toBeInTheDocument();
  });

  it('marks the input as required', () => {
    render(<EmailSignInForm />);
    expect(screen.getByPlaceholderText('your@email.com')).toBeRequired();
  });

  it('disables submit until the user types', () => {
    render(<EmailSignInForm />);
    const btn = screen.getByRole('button', { name: /send sign-in link/i });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    expect(btn).not.toBeDisabled();
  });

  it('calls signIn("resend", …) with the typed email on submit', async () => {
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
    render(<EmailSignInForm />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }));

    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenCalledWith('resend', {
      email: 'me@example.com',
      redirect: false,
      callbackUrl: '/play',
    });
  });

  it('shows "Sending…" while the signIn promise is pending', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /sending…/i })).toBeDisabled(),
    );

    resolveCall({ error: null });
  });

  it('replaces the form with an inbox message on success', async () => {
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });
    render(<EmailSignInForm />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }));

    await waitFor(() =>
      expect(screen.getByText(/check your inbox/i)).toBeInTheDocument(),
    );
    expect(screen.queryByPlaceholderText('your@email.com')).not.toBeInTheDocument();
    expect(screen.getByText(/me@example\.com/)).toBeInTheDocument();
  });

  it('shows the generic error message when signIn returns an error', async () => {
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({ error: 'OAuthSignin' });
    render(<EmailSignInForm />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }));

    await waitFor(() =>
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument(),
    );
    // form is still rendered for retry
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
  });

  it('shows the generic error message when signIn rejects', async () => {
    (signIn as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
    render(<EmailSignInForm />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }));

    await waitFor(() =>
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument(),
    );
  });

  it('clears the error microcopy when the user edits the input again', async () => {
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({ error: 'OAuthSignin' });
    render(<EmailSignInForm />);

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send sign-in link/i }));

    await waitFor(() =>
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByPlaceholderText('your@email.com'), {
      target: { value: 'me2@example.com' },
    });
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the new tests and confirm they fail**

Run: `npx vitest run app/login/email-signin-form.test.tsx`

Expected: all tests fail because `./email-signin-form` does not exist (`Cannot find module`).

- [ ] **Step 3: Implement the component**

Create `app/login/email-signin-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

type Status = 'idle' | 'loading' | 'sent' | 'error';

export function EmailSignInForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      const result = await signIn('resend', {
        email,
        redirect: false,
        callbackUrl: '/play',
      });
      if (result && 'error' in result && result.error) {
        setStatus('error');
        return;
      }
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <p className="text-center text-sm text-white/70">
        Check your inbox — we sent a sign-in link to{' '}
        <span className="text-white">{email}</span>.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-[rgba(94,200,255,0.6)] text-center">
        Sign in with your email
      </p>
      {status === 'error' && (
        <p className="text-xs text-red-400 text-center">
          Something went wrong — try again.
        </p>
      )}
      <input
        type="email"
        required
        maxLength={254}
        placeholder="your@email.com"
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
        {status === 'loading' ? 'Sending…' : 'Send sign-in link'}
      </button>
    </form>
  );
}
```

Notes:
- We deliberately do **not** ship an `invalid` state — `<input type="email" required>` blocks form submission on malformed input at the browser level, matching how `WaitlistForm` behaves at the UI layer (its `invalid` state is only set when the server responds 400, which doesn't apply here).
- The `sent` message is identical regardless of whether the email is on `ALLOWED_EMAILS` — the allowlist gate fires at click-time inside the `signIn` callback ([auth.config.ts:28-30](../../../auth.config.ts#L28-L30)) and redirects to `/login?error=AccessDenied`, which `LoginContent` already renders.

- [ ] **Step 4: Run the tests again and confirm they all pass**

Run: `npx vitest run app/login/email-signin-form.test.tsx`

Expected: 9 tests passed.

- [ ] **Step 5: Commit**

```bash
git add app/login/email-signin-form.tsx app/login/email-signin-form.test.tsx
git commit -m "feat(login): EmailSignInForm component for Resend magic-link sign-in"
```

---

### Task 2: Wire `EmailSignInForm` into `LoginContent`

**Files:**
- Modify: `app/login/login-content.tsx`
- Modify: `app/login/login-content.test.tsx`

- [ ] **Step 1: Update the existing tests for the new prop and form**

Replace the contents of `app/login/login-content.test.tsx` with:

```tsx
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
    render(<LoginContent emailEnabled={false} />);
    expect(screen.getByText('Freestyle rap trainer')).toBeInTheDocument();
    expect(screen.getByText('Calm Bap · 88 BPM')).toBeInTheDocument();
  });

  it('renders the auth card with Google sign-in', () => {
    render(<LoginContent emailEnabled={false} />);
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
  });

  it('renders the wordmark as a link to /', () => {
    render(<LoginContent emailEnabled={false} />);
    const wordmark = screen.getByText('THE RHYME GAME');
    expect(wordmark.tagName).toBe('A');
    expect(wordmark).toHaveAttribute('href', '/');
  });

  it('renders the waitlist form regardless of emailEnabled', () => {
    render(<LoginContent emailEnabled={false} />);
    expect(screen.getByRole('button', { name: /join waitlist/i })).toBeInTheDocument();
  });

  it('hides the email sign-in form when emailEnabled is false', () => {
    render(<LoginContent emailEnabled={false} />);
    expect(
      screen.queryByRole('button', { name: /send sign-in link/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the email sign-in form when emailEnabled is true', () => {
    render(<LoginContent emailEnabled={true} />);
    expect(
      screen.getByRole('button', { name: /send sign-in link/i }),
    ).toBeInTheDocument();
    // Both forms coexist
    expect(screen.getByRole('button', { name: /join waitlist/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('does not render the dev-login form', () => {
    render(<LoginContent emailEnabled={false} />);
    expect(screen.queryByText(/dev login/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in \(dev\)/i })).not.toBeInTheDocument();
  });
});
```

Key changes from the old file:
- Every `render(<LoginContent />)` becomes `render(<LoginContent emailEnabled={false} />)` or `emailEnabled={true}`.
- The old test `"renders the waitlist form instead of a magic-link form"` is **removed** (it asserted the old absence) and **replaced** by two new tests: `hides the email sign-in form when emailEnabled is false` and `shows the email sign-in form when emailEnabled is true`.
- We avoid `getByPlaceholderText('your@email.com')` at the LoginContent level because both forms use the same placeholder; we select by button `name` instead.

- [ ] **Step 2: Run the LoginContent tests and confirm the new "emailEnabled is true" case fails**

Run: `npx vitest run app/login/login-content.test.tsx`

Expected: the test `shows the email sign-in form when emailEnabled is true` fails because the form is not yet rendered. The other tests that pass `emailEnabled={false}` fail with a TypeScript error if `LoginContent` doesn't accept the prop — that's fine, we fix it next.

- [ ] **Step 3: Update `LoginContent` to accept the prop and conditionally render the form**

Edit `app/login/login-content.tsx`:

Add the import near the top:

```tsx
import { EmailSignInForm } from './email-signin-form';
```

Change the component signature:

```tsx
export function LoginContent({ emailEnabled }: { emailEnabled: boolean }) {
```

Inside the auth card, **above** the existing `<button onClick={() => signIn('google', …)}>` and **below** the `oauthError` block, insert:

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

So the auth card body, in order, becomes:

1. Title block (unchanged)
2. `oauthError` block (unchanged)
3. **NEW:** `{emailEnabled && <><EmailSignInForm /><or-divider /></>}` ← inserted here
4. `Continue with Google` button (unchanged)
5. Existing `or` divider (unchanged)
6. `<WaitlistForm label="…" />` (unchanged)
7. Back-to-home `<Link>` (unchanged)

Do not change any other markup, classes, or copy in this file.

- [ ] **Step 4: Run the LoginContent tests and confirm they all pass**

Run: `npx vitest run app/login/login-content.test.tsx`

Expected: 7 tests passed.

- [ ] **Step 5: Run the entire test suite to make sure nothing else broke**

Run: `npm test`

Expected: all test files pass. If the wider suite reports a TS error at any other `<LoginContent />` call site, hunt it down with `grep -rn "<LoginContent" --include="*.tsx" --include="*.ts"` — `page.tsx` is the only known caller and we update it in Task 3.

- [ ] **Step 6: Commit**

```bash
git add app/login/login-content.tsx app/login/login-content.test.tsx
git commit -m "feat(login): wire EmailSignInForm into LoginContent behind emailEnabled prop"
```

---

### Task 3: Thread `emailEnabled` through `app/login/page.tsx`

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Update `page.tsx` to compute and pass `emailEnabled`**

The current file (for reference) is:

```tsx
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

Replace it with:

```tsx
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

  const emailEnabled = !!(
    process.env.POSTGRES_URL &&
    process.env.AUTH_RESEND_KEY &&
    process.env.EMAIL_FROM
  );

  return (
    <Suspense>
      <LoginContent emailEnabled={emailEnabled} />
    </Suspense>
  );
}
```

Notes:
- `page.tsx` is a server component, so `process.env` is evaluated at request time on the server — there is no leak of the env values to the client; only the boolean result is serialized into the props.
- We deliberately check all three vars together. Resend's NextAuth provider needs both the API key and the `from` address; the PostgresAdapter (which stores Resend's `verification_token` rows) needs `POSTGRES_URL`. Missing any of the three means submission would fail at runtime.

- [ ] **Step 2: Run the full test suite once more**

Run: `npm test`

Expected: all tests still pass — `page.tsx` is a server component with no dedicated unit tests, and the existing assertions in `login-content.test.tsx` already cover both prop values.

- [ ] **Step 3: Manual smoke test — disabled state**

With your current `.env` (no `POSTGRES_URL` / `AUTH_RESEND_KEY` / `EMAIL_FROM` set):

```bash
npm run dev
```

Open <http://localhost:3000/login> in a browser.

Verify:
- The page renders **without** the email sign-in form.
- The Google button and the waitlist form render as before.
- No console errors related to NextAuth.

- [ ] **Step 4: Manual smoke test — enabled state**

Stop the dev server. In your local `.env`, add (or fill out) the four magic-link env vars listed in `.env.example`:

```
POSTGRES_URL=postgres://…
AUTH_RESEND_KEY=re_…
EMAIL_FROM=noreply@yourdomain.com
ALLOWED_EMAILS=kvochkinvlad@gmail.com
```

(If you don't have a Postgres + Resend setup handy, skip this step — it requires real infrastructure to send the email. The unit tests already cover the UI; this step is for end-to-end verification.)

Restart `npm run dev`. Reload <http://localhost:3000/login>.

Verify:
- The email sign-in form is now rendered above the Google button, separated by an `or` divider.
- Typing your allowlisted email and clicking **Send sign-in link** transitions the button to **Sending…**, then the form is replaced by the `Check your inbox — we sent a sign-in link to …` message.
- Receiving the email and clicking the link signs you in and redirects to `/play`.
- Typing an email **not** on `ALLOWED_EMAILS` and clicking the link in the resulting email redirects back to `/login?error=AccessDenied`, where the existing "This account isn't on the access list" message renders.

- [ ] **Step 5: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat(login): compute emailEnabled server-side and pass into LoginContent"
```

---

## Spec coverage check

| Spec section | Covered by |
|--------------|-----------|
| New `EmailSignInForm` component (idle / loading / sent / error states) | Task 1 |
| `signIn('resend', { email, redirect: false, callbackUrl: '/play' })` | Task 1, Step 3 |
| Visual parity with `WaitlistForm` (same input/button classes) | Task 1, Step 3 |
| `emailEnabled` prop on `LoginContent` | Task 2, Steps 1 + 3 |
| New `or` divider above Google button when enabled | Task 2, Step 3 |
| Server-side env check in `page.tsx` | Task 3, Step 1 |
| Closed-beta page stays waitlist-only | No change required — `closed-beta.tsx` is not modified |
| Allowlist privacy (identical `sent` message regardless of membership) | Task 1, Step 3 (no allowlist check client-side) |
| Test coverage for the new component and the new prop | Task 1, Step 1 + Task 2, Step 1 |
| `auth.ts`, `auth.config.ts`, `middleware.ts`, `/api/waitlist` unchanged | None of these files appear in any task |
