# Landing Page & Auth Redesign — Design Spec

**Date:** 2026-05-15
**Status:** Approved

## Summary

Add a public marketing landing page at `/` and redesign the auth page at `/login`. Replace the current shared-password auth system with Auth.js v5 supporting Google OAuth and email magic links. Access is controlled via an email allowlist managed through an env var.

## Route changes

| Route | Before | After |
|---|---|---|
| `/` | Game (auth-gated) | Public landing page |
| `/play` | — (didn't exist) | Game (auth-gated, moved from `/`) |
| `/login` | Password form | Google + magic link auth page |

Middleware updated: unauthenticated requests to `/play` redirect to `/login`. The landing page `/` and auth page `/login` are always public.

## Landing page (`/`)

Public, no auth required. Implemented as `app/page.tsx`.

### Layout

**Desktop (≥768px):** Full-viewport split layout.

- **Nav bar:** Logo left (`THE RHYME GAME`, cyan gradient text), `Log in →` button right (small, cyan→blue gradient, links to `/login`)
- **Left column:** 
  - Tag: `Freestyle rap trainer` (small caps, `rgba(94,200,255,0.65)`)
  - Headline: `The Rhyme Game` (cyan→blue gradient, `font-extrabold`, large)
  - Tagline: `Beat plays. Ball bounces. Your rhyme lands on time.` (`text-white/50`)
  - CTA button: `GET STARTED →` (cyan→blue gradient, glow shadow, links to `/login`)
- **Right column:** Static decorative game grid — 4 columns × 4 rows of cells. Rightmost column has colored word cells (yellow, blue, orange, red). One row has a glowing orange ball `#ff9d2a` positioned in the third cell. Beat label below: `Calm Bap · 88 BPM` (muted). Separated from left column by a faint cyan border.
- **Feature pills row** (below the split): Three compact pills — `Beat / Hip-hop instrumentals`, `Rhyme / AI word prompts`, `Flow / Lock to the bar`. Styled `bg-[rgba(94,200,255,0.05)] border border-[rgba(94,200,255,0.12)]`.

**Mobile (<768px):** Single column. Nav collapses to logo + login button. Right column (grid preview) is hidden. Left column content stacks. Feature pills wrap. CTA button full-width.

### Background

Same Ice & Chrome as Setup screen:

```tsx
<main
  className="flex min-h-screen flex-col bg-[#060c14]"
  style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(94,200,255,0.22) 0%, transparent 100%)' }}
>
```

### Navigation

Both `Log in →` (nav) and `GET STARTED →` (hero) link to `/login`. There is no scroll-to-section behavior.

## Auth page (`/login`)

Public. If the user is already authenticated, redirect to `/play`.

### Layout

Centered card on the Ice & Chrome background. Nav bar with logo only (no login button).

### Card contents

```
┌─────────────────────────────────┐
│         Sign in                 │  ← gradient heading
│  Access requires an invitation  │  ← muted subtitle
│                                 │
│  [G]  Continue with Google      │  ← white button, full width
│                                 │
│  ─────────── or ────────────    │  ← cyan divider
│                                 │
│  [  your@email.com          ]   │  ← email input
│  [    Send magic link       ]   │  ← gradient button
│                                 │
│        ← Back to home           │  ← small muted link to /
└─────────────────────────────────┘
```

Card styling: `bg-[rgba(94,200,255,0.05)] border border-[rgba(94,200,255,0.15)] rounded-2xl`.

### States

| State | UI |
|---|---|
| Idle | Default card above |
| Magic link sent | Replace input + button with: `Check your inbox — link sent to you@email.com` |
| Email not on allowlist | `This email isn't on the access list` (red, above submit button) |
| Google OAuth error | `?error=...` query param → brief error message above the card |
| Loading (magic link) | Send button shows `Sending…`, disabled |

## Auth implementation

### Library

`next-auth` v5 (`next-auth@beta`). App Router compatible.

### Providers

- **Google OAuth** (`next-auth/providers/google`) — `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
- **Email / magic link** (`next-auth/providers/email`) — sends via **Resend** (free tier: 3k emails/month). `RESEND_API_KEY` + `EMAIL_FROM`

### Database

Vercel Postgres via `@auth/pg-adapter`. Auth.js manages schema (`users`, `accounts`, `sessions`, `verification_tokens`). Connection string: `POSTGRES_URL`.

### Access control

`signIn` callback in `auth.ts` checks the incoming email against `ALLOWED_EMAILS` (comma-separated env var). Rejects any email not on the list, regardless of provider:

```ts
callbacks: {
  signIn({ user }) {
    const allowed = (process.env.ALLOWED_EMAILS ?? '').split(',').map(e => e.trim());
    return allowed.includes(user.email ?? '');
  }
}
```

To grant access: add email to `ALLOWED_EMAILS` in Vercel dashboard. To revoke: remove it.

### New env vars

| Var | Purpose |
|---|---|
| `AUTH_SECRET` | Auth.js session signing (replaces old `AUTH_SECRET` — same name, new semantics) |
| `AUTH_URL` | Canonical URL for OAuth redirects (e.g. `https://yourdomain.com`) |
| `GOOGLE_CLIENT_ID` | Google OAuth app |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app |
| `RESEND_API_KEY` | Magic link email sending |
| `EMAIL_FROM` | From address (e.g. `noreply@yourdomain.com`) |
| `ALLOWED_EMAILS` | Comma-separated allowlist |
| `POSTGRES_URL` | Vercel Postgres connection |

### Removed env vars

`APP_PASSWORD` — no longer used.

### Files added

| File | Purpose |
|---|---|
| `auth.ts` | Auth.js config (providers, adapter, callbacks) |
| `app/api/auth/[...nextauth]/route.ts` | Auth.js catch-all API route |
| `app/play/page.tsx` | Game page (moved from `app/page.tsx`) |

### Files changed

| File | Change |
|---|---|
| `app/page.tsx` | Becomes public landing page |
| `app/login/page.tsx` | Redesigned auth page (Google + magic link) |
| `middleware.ts` | Swap homegrown cookie check for Auth.js `auth()` |
| `components/Game.tsx` | `onLogout` prop call replaced with `signOut()` from `next-auth/react` |

### Files deleted

| File | Reason |
|---|---|
| `lib/auth.ts` | Replaced by Auth.js |
| `app/api/login/route.ts` | Replaced by Auth.js |
| `app/api/logout/route.ts` | Replaced by Auth.js |

## What does NOT change

- `components/Game.tsx`, `components/Setup.tsx`, and all game components — untouched
- `app/globals.css` body background
- `tailwind.config.ts` color tokens
- All game API routes (`/api/rhymes`, `/api/yt-beat`, `/api/analyze-beat`)
- The Ice & Chrome visual theme — landing and auth pages adopt it
