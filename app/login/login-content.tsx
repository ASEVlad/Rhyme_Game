'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LoginNav } from './login-nav';
import { WaitlistForm } from './waitlist-form';
import { EmailSignInForm } from './email-signin-form';

// useSearchParams() requires a Suspense boundary in Next.js 14 App Router.
// The parent (page.tsx) wraps this in <Suspense>.
export function LoginContent({ emailEnabled }: { emailEnabled: boolean }) {
  const searchParams = useSearchParams();
  const oauthError = searchParams.get('error');

  return (
    <main
      className="flex min-h-screen flex-col bg-[#060c14]"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(94,200,255,0.22) 0%, transparent 100%)' }}
    >
      <LoginNav />

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
            <div className="grid grid-cols-4 gap-2 opacity-0">
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-rhyme-yellow" />
            </div>
            <div className="grid grid-cols-4 gap-2 opacity-[0.07]">
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="relative rounded-2xl py-5 bg-[rgba(94,200,255,0.06)] flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-[#ff9d2a]" style={{ boxShadow: '0 0 8px rgba(255,157,42,0.8)' }} />
              </div>
              <div className="rounded-2xl py-5 bg-rhyme-blue" />
            </div>
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
            <div className="grid grid-cols-4 gap-2 opacity-[0.28]">
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-rhyme-red" />
            </div>
            <div className="grid grid-cols-4 gap-2 opacity-[0.07]">
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-[rgba(94,200,255,0.06)]" />
              <div className="rounded-2xl py-5 bg-rhyme-yellow" />
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

            <WaitlistForm label="Not invited yet? Join the waitlist." />

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
