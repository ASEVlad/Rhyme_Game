# Email magic-link sign-in on `/login`

**Date:** 2026-05-16
**Status:** Proposed

## Goal

Let approved users (those on `ALLOWED_EMAILS`) sign in to The Rhyme Game by typing their email and clicking a magic link, alongside the existing Google sign-in button and the waitlist form. The Resend provider and Postgres adapter are already wired in `auth.ts` / `auth.config.ts`; this spec covers the missing UI and the env requirements that make it usable.

## Motivation

Today `/login` exposes only **Continue with Google** plus a **Join waitlist** form. An approved user without a Google account — or who prefers not to use Google — has no way in. The back-end already supports magic-link sign-in via the NextAuth Resend provider; only the front-end button is missing.

## Non-goals

- Changes to the existing **Google** sign-in flow.
- Changes to the **waitlist** flow (`/api/waitlist`, `WaitlistForm`, `closed-beta.tsx`).
- Changes to `auth.ts`, `auth.config.ts`, `middleware.ts`, or the invite-gate cookie logic.
- Email sign-in on the closed-beta page (intentionally excluded — see "Closed-beta page" below).
- A new database table or migration; the Postgres adapter already manages `verification_token`.

## UX

Layout, top-to-bottom inside the existing auth card:

1. **Sign in** title + tagline (unchanged)
2. OAuth error message (unchanged — already handles `AccessDenied`)
3. **NEW:** Email input + **Send sign-in link** button
4. `—— or ——` divider
5. **Continue with Google** button (unchanged)
6. `——————` divider (existing visual separator)
7. **Not invited yet? Join the waitlist.** + `WaitlistForm` (unchanged)
8. Back-to-home link (unchanged)

### Email sign-in states

| State | UI |
|-------|----|
| `idle` | Empty input, button enabled when input non-empty |
| `loading` | Button text → `Sending…`, button disabled |
| `sent` | Form replaced with text: `Check your inbox — we sent a sign-in link to <email>.` |
| `invalid` | Red microcopy under input: `That doesn't look like a valid email.` |
| `error` | Red microcopy under input: `Something went wrong — try again.` |

### Allowlist privacy

The `sent` message is **identical** regardless of whether the email is on `ALLOWED_EMAILS`. The allowlist gate fires inside the `signIn` callback ([`auth.config.ts:28-30`](../../../auth.config.ts#L28-L30)) when the user clicks the link in their inbox, redirecting non-allowed users to `/login?error=AccessDenied`. The existing OAuth-error handler in [`login-content.tsx:101-107`](../../../app/login/login-content.tsx#L101-L107) already renders the right message for that case, so no extra UI is required.

This prevents the auth page from acting as an allowlist-membership oracle.

### Closed-beta page

`app/login/closed-beta.tsx` stays waitlist-only. The closed-beta page exists to hide that a sign-in flow exists for users without a valid invite cookie; adding the email form there would defeat that purpose. Approved users who lose their invite cookie need to revisit the invite link once to restore it.

## Architecture

### New component: `app/login/email-signin-form.tsx`

A client component that mirrors `WaitlistForm` in structure and styling.

```tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

type Status = 'idle' | 'loading' | 'sent' | 'invalid' | 'error';

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
      if (result?.error) {
        setStatus('error');
        return;
      }
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  // Render: same input + button styling classes as WaitlistForm, with the
  // 'sent' branch rendering the inbox message and the rest rendering the form.
}
```

- Uses `signIn('resend', …)` with `redirect: false` so we control the success UI instead of being redirected to NextAuth's default `verifyRequest` page.
- Reuses Tailwind classes from `WaitlistForm` (`rounded-xl bg-[rgba(94,200,255,0.07)] …`) so the two forms look like siblings.
- `<input type="email" required maxLength={254}>` for HTML5 validation, matching `WaitlistForm`.

### Modified: `app/login/page.tsx`

Computes `emailEnabled` server-side from env vars and passes it into `LoginContent`:

```tsx
const emailEnabled = !!(
  process.env.POSTGRES_URL &&
  process.env.AUTH_RESEND_KEY &&
  process.env.EMAIL_FROM
);
// …
<LoginContent emailEnabled={emailEnabled} />
```

This avoids rendering a form that is guaranteed to throw at submit time when the Resend provider can't run (no adapter or no API key). Closed-beta path is unaffected.

### Modified: `app/login/login-content.tsx`

- Accepts a new prop: `emailEnabled: boolean`.
- When `emailEnabled` is true, renders `<EmailSignInForm />` above the Google button, then an `—— or ——` divider.
- When false, the markup matches today's layout exactly (Google → `or` divider → waitlist).

No changes to the Google button, waitlist form, or surrounding decoration.

## Tests

### `app/login/email-signin-form.test.tsx` *(new)*

Mocks `next-auth/react`'s `signIn`. Covers:

1. Renders idle form by default.
2. Disables button when input is empty.
3. Calls `signIn('resend', { email, redirect: false, callbackUrl: '/play' })` on submit.
4. Shows `Sending…` while the promise is pending.
5. Shows the inbox message on success (result has no `error`).
6. Shows the generic error microcopy when `signIn` returns `{ error: '…' }`.
7. Shows the generic error microcopy when `signIn` rejects.
8. Clears error/invalid state when the user edits the input again.

Follows the patterns in [`waitlist-form.test.tsx`](../../../app/login/waitlist-form.test.tsx) and [`login-content.test.tsx`](../../../app/login/login-content.test.tsx).

### `app/login/login-content.test.tsx` *(extended)*

Add two cases:

1. `emailEnabled=true` → `EmailSignInForm` is in the DOM (assert by a stable selector — e.g., the "Send sign-in link" button text).
2. `emailEnabled=false` → that form is not in the DOM, Google + waitlist still render.

No changes to existing assertions.

## Environment configuration

For local testing the developer needs all of:

| Var | Purpose |
|-----|---------|
| `POSTGRES_URL` | PostgresAdapter — stores Resend's `verification_token` rows |
| `AUTH_RESEND_KEY` | Resend API key for actually sending the magic-link email |
| `EMAIL_FROM` | `From:` address Resend sends as |
| `ALLOWED_EMAILS` | Comma-separated allowlist — the `signIn` callback rejects everyone not on it |

All four are already documented in `.env.example`. Without them, the email form is hidden (`emailEnabled=false`) and the existing Google + waitlist flows behave unchanged.

## Risks and edge cases

- **Adapter required.** NextAuth's Resend provider requires a database adapter to persist verification tokens; if `POSTGRES_URL` is unset, `auth.ts` doesn't install the PostgresAdapter and any `signIn('resend', …)` call would throw. The `emailEnabled` gate prevents this surface from being reachable.
- **Stale verification tokens.** PostgresAdapter handles token lifecycle; nothing for us to do.
- **Email enumeration.** Mitigated by the identical `sent` message regardless of allowlist membership (see UX section).
- **Vercel build environment.** The `emailEnabled` check runs at request time (`page.tsx` is a server component, not statically rendered), so changing env vars in Vercel does not require a redeploy of the auth page rendering layer — but it does for the `auth.ts` module that conditionally installs the adapter. This is consistent with how the codebase already handles Postgres.
- **What if the user submits an email that's already pending in the waitlist?** No conflict — waitlist rows and verification_token rows live in different tables, and the user simply won't be able to complete sign-in if they aren't yet on `ALLOWED_EMAILS`. Standard `AccessDenied` flow.

## Out of scope (future work)

- Auto-promoting waitlist rows to `ALLOWED_EMAILS` once approved (currently manual via env config).
- Adding email sign-in to the closed-beta page.
- Rate-limiting `signIn('resend', …)` calls (Resend itself rate-limits at the API level; if we hit it, the form shows the generic error).
- Custom `verifyRequest` page styling — we sidestep it by using `redirect: false`.
