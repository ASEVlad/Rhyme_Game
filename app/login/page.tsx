'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setSubmitting(false);
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('Неправильний пароль');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-3xl font-extrabold text-center">Римова Гра</h1>
        <p className="text-center text-white/60">Введіть пароль</p>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoFocus
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-lg outline-none focus:bg-white/15"
          placeholder="Пароль"
        />
        {error && <p className="text-rhyme-red text-center">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !password}
          className="w-full rounded-xl bg-rhyme-yellow text-bg font-bold py-3 text-lg disabled:opacity-50"
        >
          {submitting ? 'Перевірка...' : 'Увійти'}
        </button>
      </form>
    </main>
  );
}
