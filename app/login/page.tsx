'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn(provider: 'google' | 'resend') {
    setSigningIn(provider);
    setError(null);
    try {
      await signIn(provider, { redirect: true, redirectTo: '/play' });
    } catch {
      setError(`Failed to sign in with ${provider}`);
      setSigningIn(null);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-3xl font-extrabold text-center">The Rhyme Game</h1>
        <p className="text-center text-white/60">Sign in to play</p>
        <div className="space-y-3">
          <button
            onClick={() => handleSignIn('google')}
            disabled={signingIn !== null}
            className="w-full rounded-xl bg-white text-black font-bold py-3 text-lg disabled:opacity-50 hover:bg-gray-100"
          >
            {signingIn === 'google' ? 'Signing in…' : 'Sign in with Google'}
          </button>
          <button
            onClick={() => handleSignIn('resend')}
            disabled={signingIn !== null}
            className="w-full rounded-xl bg-rhyme-yellow text-bg font-bold py-3 text-lg disabled:opacity-50 hover:bg-yellow-400"
          >
            {signingIn === 'resend' ? 'Signing in…' : 'Sign in with Email'}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-rhyme-red text-center">{error}</p>
        )}
      </div>
    </main>
  );
}
