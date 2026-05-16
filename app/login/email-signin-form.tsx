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
      if (result?.error) {
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
      <p aria-live="polite" className="text-center text-sm text-white/70">
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
        <p aria-live="polite" className="text-xs text-red-400 text-center">
          Something went wrong — try again.
        </p>
      )}
      <input
        type="email"
        required
        maxLength={254}
        placeholder="your@email.com"
        aria-label="Email for sign-in link"
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
        {status === 'loading' ? 'Sending…' : 'Send sign-in link'}
      </button>
    </form>
  );
}
