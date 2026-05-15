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
