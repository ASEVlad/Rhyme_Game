'use client';

import { useState } from 'react';

type Status = 'idle' | 'loading' | 'sent' | 'error' | 'invalid';

export function WaitlistForm({ label }: { label: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus('sent');
        return;
      }
      if (res.status === 400) {
        setStatus('invalid');
        return;
      }
      setStatus('error');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <p className="text-center text-sm text-white/70">
        You&apos;re on the list — we&apos;ll be in touch.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-[rgba(94,200,255,0.6)] text-center">{label}</p>
      {status === 'invalid' && (
        <p className="text-xs text-red-400 text-center">
          That doesn&apos;t look like a valid email.
        </p>
      )}
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
        onChange={e => { setEmail(e.target.value); if (status !== 'loading') setStatus('idle'); }}
        className="w-full rounded-xl bg-[rgba(94,200,255,0.07)] border border-[rgba(94,200,255,0.25)] px-4 py-2.5 text-sm placeholder:text-white/30 outline-none focus:border-[rgba(94,200,255,0.5)]"
      />
      <button
        type="submit"
        disabled={status === 'loading' || !email}
        className="w-full rounded-xl py-2.5 text-sm font-bold text-[#060c14] disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)' }}
      >
        {status === 'loading' ? 'Joining…' : 'Join waitlist'}
      </button>
    </form>
  );
}
