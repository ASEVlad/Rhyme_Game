'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

type Status = 'idle' | 'loading' | 'error';
type Variant = 'stacked' | 'inline';

type Props = {
  variant?: Variant;
};

export function EmailSignInForm({ variant = 'stacked' }: Props = {}) {
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

  const sharedInputClass =
    'rounded-xl bg-[rgba(94,200,255,0.07)] border border-[rgba(94,200,255,0.25)] px-4 py-2.5 text-sm placeholder:text-white/30 outline-none focus:border-[rgba(94,200,255,0.5)]';

  if (variant === 'inline') {
    return (
      <form onSubmit={handleSubmit} className="space-y-2">
        {status === 'error' && (
          <p aria-live="polite" className="text-xs text-red-400 text-center">
            Your account isn&apos;t accepted yet.
          </p>
        )}
        <div className="flex flex-col md:flex-row gap-2">
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
            className={`${sharedInputClass} w-full md:flex-1`}
          />
          <button
            type="submit"
            disabled={status === 'loading' || !email}
            aria-label="Sign in"
            className="rounded-xl py-2.5 md:px-4 text-sm font-bold text-[#060c14] disabled:opacity-50 md:shrink-0"
            style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)' }}
          >
            <span className="md:hidden">
              {status === 'loading' ? 'Signing in…' : 'Sign in →'}
            </span>
            <span className="hidden md:inline">
              {status === 'loading' ? '…' : '→'}
            </span>
          </button>
        </div>
      </form>
    );
  }

  // stacked (default — master's credentials-flow behavior)
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
        className={`${sharedInputClass} w-full`}
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
