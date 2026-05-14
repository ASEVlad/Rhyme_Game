import Link from 'next/link';

export default function YtPlaceholder() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-extrabold">YouTube Mode</h1>
      <p className="text-white/70">Coming soon.</p>
      <Link href="/" className="text-white/60 hover:text-white">← Back</Link>
    </main>
  );
}
