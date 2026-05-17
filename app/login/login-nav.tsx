import Link from 'next/link';

export function LoginNav() {
  return (
    <nav className="flex items-center h-16 px-6 md:px-12 shrink-0">
      <Link
        href="/"
        className="font-extrabold text-sm tracking-wide hover:opacity-80 transition-opacity"
        style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
      >
        THE RHYME GAME
      </Link>
    </nav>
  );
}
