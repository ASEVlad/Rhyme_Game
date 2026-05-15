# Invite-Gated Login

**Date:** 2026-05-15
**Status:** Design approved, ready for implementation plan

## Problem

We want to soft-launch The Rhyme Game to friends only. The existing email allowlist (`ALLOWED_EMAILS` + `signIn` callback in `auth.config.ts`) correctly blocks non-friend emails from completing sign-in, but the `/login` page itself is publicly visible: any visitor sees the Google button, magic-link form, and (in dev) the credentials form. We want to hide the sign-in surface from strangers entirely, while keeping the public homepage marketing-friendly.

## Goals

- Strangers landing on `/login` see a "closed beta" page, not a sign-in form.
- Friends who have the shared invite code can reach the form and sign in normally.
- One env var rotates access for everyone at once (kill switch).
- No database changes. No schema for users/invites.
- Homepage `/` stays public.

## Non-Goals

- Per-friend invite codes or analytics on which friend invited whom.
- Rate-limiting / brute-force protection on the invite code. (The code is in a query string, and the email allowlist is the real wall.)
- Replacing or weakening the existing email allowlist.
- Gating routes other than `/login`. Auth-protected routes (`/play`, `/yt`, `/calibrate`) remain protected by the existing NextAuth `authorized` callback.
- Gating `/api/auth/*` (NextAuth's OAuth callback, magic-link, and signout endpoints). These stay reachable; the email allowlist in the `signIn` callback prevents any non-friend email from completing a sign-in regardless of whether the form was reached through the invite gate.

## Two-Layer Model

Access becomes a two-layer check:

1. **Invite layer (new)** — gates *who can see the sign-in form*. Checked in middleware on requests to `/login`.
2. **Allowlist layer (existing)** — gates *which emails can complete sign-in*. Unchanged: `signIn` callback in `auth.config.ts` returns `isEmailAllowed(user.email)`.

A leaked invite code does not grant access; it only exposes the form. The email allowlist still has to admit the user.

## Design

### Env var

Add a single new env var:

```
INVITE_CODE=<random-string>
```

Recommended: a random ~16-character string. Documented in `.env.example` with a comment explaining that share-out-of-band URLs take the form `/login?invite=<code>`. We do not enforce length or randomness in code.

If `INVITE_CODE` is unset, the invite layer is **disabled** (login form is publicly visible). This keeps local dev frictionless and lets us "open the doors" later by simply unsetting the var.

### Cookie

Name: `rhyme-invite`
Value: the invite code itself (not a boolean).
Attributes:

- `httpOnly: true` — not readable from client JS.
- `secure: true` in production, `false` in development.
- `sameSite: 'lax'` — survives top-level navigation from email links.
- `path: '/'`.
- `maxAge: 90 * 24 * 60 * 60` (90 days).

Storing the code itself (rather than a boolean) means rotating `INVITE_CODE` invalidates all existing cookies on the next request. That is the kill switch.

### Middleware flow

The existing `middleware.ts` uses NextAuth's `auth()` wrapper. We rewrite it to use the callback form (`export default auth((req) => { ... })`) so we can run custom logic with `req.auth` available.

For a request to `/login`:

1. If `req.auth?.user` is truthy → user is already signed in. Redirect to `/play` (matching today's behavior). The invite check does not run.
2. If `INVITE_CODE` is unset or empty string → pass through (invite layer disabled).
3. If query param `?invite=<code>` is present:
   - If it matches `INVITE_CODE` → set the `rhyme-invite` cookie and `307` redirect to `/login` (clean URL).
   - If it does not match → fall through to step 4 (treat as no invite).
4. If the `rhyme-invite` cookie equals `INVITE_CODE` → pass through; the login form renders.
5. Otherwise → rewrite to `/login` with a `x-rhyme-invite-state: closed-beta` request header. URL stays `/login`, no information leak.

Auth check comes first so that an already-signed-in user whose invite cookie has expired still gets redirected to `/play` instead of seeing a closed-beta page.

For all routes other than `/login`, behavior matches today's `authorized` callback: `/play`, `/yt`, `/calibrate` require a signed-in user; everything else is public. The implementation may keep the callback in `auth.config.ts` or replicate the equivalent checks in the new middleware callback — design is silent on which.

### Login page branching

`app/login/page.tsx` becomes a thin server component that reads the `x-rhyme-invite-state` request header (via `headers()` from `next/headers`) and renders one of two children based on its value:

- **Sign-in view** (existing): nav header, "Sign in" card, Google button, magic-link form, dev-only credentials form. Code in this branch is exactly what `LoginContent` renders today.
- **Closed-beta view** (new): same nav header and visual shell, but the card contents are:
  - Heading: "Closed beta"
  - Body: "The Rhyme Game is in private testing. Ask your friend for an invite link."
  - "← Back to home" link.
  - No form. No invite input. No mention of the env var or the URL shape.

The existing client logic for form submission stays in a `'use client'` child component imported by the sign-in branch.

### Files touched

- `middleware.ts` — wrap the existing `auth()` middleware with the invite check for `/login`.
- `app/login/page.tsx` — split into server-component shell + two view components (sign-in form and closed-beta panel). The current client form logic moves into a child component.
- `.env.example` — add `INVITE_CODE=` with a short comment.
- No new packages. No DB changes. No `auth.ts` or `auth.config.ts` changes.

### Visual style

Closed-beta view uses the existing Ice & Chrome palette already established on the login page (`#060c14` background, radial gradient highlight, `rgba(94,200,255,...)` border tones, blue gradient text for the heading). Same nav bar, same card container. The only difference is the card contents.

## Security considerations

- The invite check runs in middleware (Node/edge runtime, server-side). Client-side bypass via DevTools is not possible.
- The cookie is httpOnly; client JS cannot read or forge it without knowing the current `INVITE_CODE`.
- Rotating `INVITE_CODE` cuts off all existing cookies on the next request.
- We deliberately do not rate-limit invite attempts. The invite layer is a soft gate; the email allowlist is the real security boundary.
- `INVITE_CODE` should not be a guessable word. We do not enforce this; we document it.

## Testing

- Manual: with `INVITE_CODE` set, visiting `/login` shows closed-beta; visiting `/login?invite=<correct>` shows the form and sets the cookie; subsequent `/login` visits show the form; changing `INVITE_CODE` and reloading reverts to closed-beta.
- Manual: with `INVITE_CODE` unset, `/login` always shows the form (matches current behavior).
- Manual: an already-signed-in user hitting `/login` still gets redirected to `/play` regardless of invite state — including the case where their invite cookie has expired or been cleared.
- Unit test (optional, low value): a small test of the middleware decision function if it can be extracted from the Next.js request context. Not required for v1.

## Rollout

1. Implement, merge.
2. Set `INVITE_CODE` in production env. Share `/login?invite=<code>` with friends out-of-band.
3. When ready to open the game publicly, unset `INVITE_CODE` (no code changes needed).
