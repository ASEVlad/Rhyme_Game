import Link from 'next/link';
import { LoginNav } from './login-nav';
import { WaitlistForm } from './waitlist-form';

const DOT_COLORS = ['#5ec8ff', '#5ec8ff', '#2860e0', '#2860e0'];

export function ClosedBeta() {
  return (
    <main
      className="flex min-h-screen flex-col bg-[#060c14]"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(94,200,255,0.22) 0%, transparent 100%)' }}
    >
      {/* TOP */}
      <LoginNav />

      {/* MIDDLE */}
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

      {/* BOTTOM */}
      <div className="px-6 md:px-12 py-8 md:py-12 shrink-0">
        <div className="mx-auto w-full max-w-md rounded-2xl bg-[rgba(94,200,255,0.05)] border border-[rgba(94,200,255,0.15)] p-6 space-y-4">
          <p className="text-xs tracking-widest text-white/40 uppercase text-center">
            Closed beta — private testing
          </p>
          <WaitlistForm label="Get notified when we open up" />
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
