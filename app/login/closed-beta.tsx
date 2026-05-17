import Link from 'next/link';
import { LoginNav } from './login-nav';
import { WaitlistForm } from './waitlist-form';

export function ClosedBeta() {
  return (
    <main
      className="flex h-screen flex-col overflow-hidden bg-[#060c14]"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(94,200,255,0.22) 0%, transparent 100%)' }}
    >
      <LoginNav />

      {/* Centered stack: wordmark → card → back link, tight vertical rhythm */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 md:px-12 py-4 md:py-6 gap-4 md:gap-6">
        <h1
          className="text-4xl md:text-5xl font-extrabold leading-[1.05] text-center"
          style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          The Rhyme <br />Game.
        </h1>

        <div className="w-full max-w-md rounded-2xl bg-[rgba(94,200,255,0.05)] border border-[rgba(94,200,255,0.15)] p-6 space-y-4">
          <p className="text-xs tracking-widest text-white/40 uppercase text-center">
            Closed beta — private testing
          </p>
          <WaitlistForm label="Get notified when we open up" />
        </div>

        <p className="text-xs text-white/35">
          <Link href="/" className="hover:text-white/60 transition-colors">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
