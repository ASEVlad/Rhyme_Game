'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LoginNav } from './login-nav';
import { WaitlistForm } from './waitlist-form';
import { EmailSignInForm } from './email-signin-form';

const DOT_COLORS = ['#5ec8ff', '#5ec8ff', '#2860e0', '#2860e0'];

// useSearchParams() requires a Suspense boundary in Next.js 14 App Router.
// The parent (page.tsx) wraps this in <Suspense>.
export function LoginContent() {
  const searchParams = useSearchParams();
  const oauthError = searchParams.get('error');
  const [showWaitlist, setShowWaitlist] = useState(false);

  return (
    <main
      className="flex min-h-screen flex-col bg-[#060c14]"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(94,200,255,0.22) 0%, transparent 100%)' }}
    >
      {/* TOP — brand bar */}
      <LoginNav />

      {/* MIDDLE — oversized wordmark + 4-dot motif */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 md:px-12 py-8 md:py-12 gap-6">
        <h1
          className="text-5xl md:text-7xl font-extrabold leading-tight text-center"
          style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          The Rhyme <br />Game.
        </h1>
        <div className="flex gap-3" aria-hidden="true">
          {DOT_COLORS.map((color, i) => (
            <span
              key={i}
              data-rhythm-dot
              className="w-2 h-2 rounded-full"
              style={{ background: color }}
            />
          ))}
        </div>
      </div>

      {/* BOTTOM — auth card + page-level back link */}
      <div className="px-6 md:px-12 py-8 md:py-12 shrink-0">
        <div className="mx-auto w-full max-w-md rounded-2xl bg-[rgba(94,200,255,0.05)] border border-[rgba(94,200,255,0.15)] p-6 space-y-4">

          <div className="text-center space-y-1">
            <h2
              className="text-2xl font-extrabold"
              style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              Sign in
            </h2>
            <p className="text-xs tracking-widest text-white/40 uppercase">
              Access by invitation
            </p>
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
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-base font-semibold text-gray-800 hover:bg-gray-100 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-9 20-20 0-1.3-.1-2.7-.4-4z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.5 35.5 26.9 36.3 24 36.3c-5.2 0-9.6-3.4-11.2-8H6.5C9.9 38.4 16.4 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.4-2.4 4.4-4.5 5.8l6.2 5.2C40.6 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
            </svg>
            Continue with Google
          </button>

          <div className="space-y-2">
            <p className="text-xs tracking-widest text-white/40 uppercase text-center">
              or use email
            </p>
            <EmailSignInForm variant="inline" />
          </div>

          {showWaitlist ? (
            <div className="pt-2 border-t border-[rgba(94,200,255,0.10)]">
              <WaitlistForm label="Get notified when we open up" />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowWaitlist(true)}
              className="block w-full text-center text-xs text-white/55 hover:text-white/80 transition-colors"
            >
              Not invited? Join the waitlist →
            </button>
          )}
        </div>

        <p className="mt-6 text-xs text-white/35 text-center md:text-left">
          <Link href="/" className="hover:text-white/60 transition-colors">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
