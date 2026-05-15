# Login Page Desktop Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-column desktop layout to `app/login/page.tsx` so the left half shows branded game content at `md:` (768px+) while mobile stays unchanged.

**Architecture:** Replace the single centred-card wrapper with an `md:grid-cols-2` div. Left column (`hidden md:flex`) holds branding copy and a static 5-row decorative game grid. Right column holds the existing auth card unchanged. No new components or files beyond the test.

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS, Vitest + @testing-library/react (jsdom).

---

## Files

| Action | Path |
|--------|------|
| Modify | `app/login/page.tsx` |
| Create | `app/login/page.test.tsx` |

---

### Task 1: Add desktop layout to login page

**Files:**
- Modify: `app/login/page.tsx`
- Create: `app/login/page.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `app/login/page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from './page';

vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    <a href={href}>{children}</a>,
}));

describe('LoginPage desktop layout', () => {
  it('renders branding column elements', () => {
    render(<LoginPage />);
    expect(screen.getByText('Freestyle rap trainer')).toBeInTheDocument();
    expect(screen.getByText('Calm Bap · 88 BPM')).toBeInTheDocument();
  });

  it('renders the auth card', () => {
    render(<LoginPage />);
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run app/login/page.test.tsx
```

Expected: both tests FAIL — `'Freestyle rap trainer'` and `'Calm Bap · 88 BPM'` are not yet in the DOM.

- [ ] **Step 3: Implement the layout**

Replace the entire content of `app/login/page.tsx` with:

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

      <div className="flex-1 md:grid md:grid-cols-2">

        {/* ── LEFT COLUMN: branding + decorative grid (desktop only) ── */}
        <div className="hidden md:flex flex-col justify-center gap-6 px-8 py-12 border-r border-[rgba(94,200,255,0.10)]">
          <p className="text-xs uppercase tracking-widest text-[rgba(94,200,255,0.65)]">
            Freestyle rap trainer
          </p>
          <h2
            className="text-4xl font-extrabold leading-tight"
            style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            The<br />Rhyme<br />Game
          </h2>
          <p className="text-sm text-white/50 leading-relaxed">
            Beat plays. Ball bounces.<br />Your rhyme lands on time.
          </p>

          {/* Static decorative game grid — 5 rows, opacity mirrors WordGrid rowOpacity */}
          <div className="space-y-2" aria-hidden="true">
            {/* Row 1 — invisible (two above active) */}
            <div className="grid grid-cols-4 gap-2 opacity-0">
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-rhyme-yellow" />
            </div>
            {/* Row 2 — ghost (one above active) */}
            <div className="grid grid-cols-4 gap-2 opacity-[0.07]">
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="relative rounded-2xl py-5 bg-[rgba(94,200,255,0.06)] flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-[#ff9d2a]" style={{ boxShadow: '0 0 8px rgba(255,157,42,0.8)' }} />
              </div>
              <div className="rounded-2xl py-5 bg-rhyme-blue" />
            </div>
            {/* Row 3 — active row (ring + radial glow) */}
            <div className="relative grid grid-cols-4 gap-2">
              <div
                style={{
                  position: 'absolute',
                  inset: '-8px -10px',
                  borderRadius: '18px',
                  background: 'radial-gradient(ellipse at 50% 50%, rgba(94,200,255,0.10) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }}
              />
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)] ring-2 ring-white/80" />
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)] ring-2 ring-white/80" />
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)] ring-2 ring-white/80" />
              <div className="rounded-2xl py-5 bg-rhyme-orange ring-2 ring-white/80" />
            </div>
            {/* Row 4 — dim upcoming */}
            <div className="grid grid-cols-4 gap-2 opacity-[0.28]">
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-rhyme-red" />
            </div>
            {/* Row 5 — ghost upcoming */}
            <div className="grid grid-cols-4 gap-2 opacity-[0.07]">
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-rhyme-red" />
            </div>
          </div>

          <p className="text-xs text-white/25">Calm Bap · 88 BPM</p>
        </div>

        {/* ── RIGHT COLUMN: auth card (all screen sizes) ── */}
        <div className="flex items-center justify-center p-6">
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run app/login/page.test.tsx
```

Expected: 2 tests PASS.

- [ ] **Step 5: Run full suite to check for regressions**

```bash
npx vitest run --reporter=dot
```

Expected: all previously passing tests still pass (181+ tests).

- [ ] **Step 6: Commit**

```bash
git add app/login/page.tsx app/login/page.test.tsx
git commit -m "feat: two-column desktop layout for login page (md+)"
```
