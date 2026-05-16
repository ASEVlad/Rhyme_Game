import Link from 'next/link';
import { LoginNav } from './login-nav';
import { WaitlistForm } from './waitlist-form';

export function ClosedBeta() {
  return (
    <main
      className="flex min-h-screen flex-col bg-[#060c14]"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(94,200,255,0.22) 0%, transparent 100%)' }}
    >
      <LoginNav />

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-5 rounded-2xl bg-[rgba(94,200,255,0.05)] border border-[rgba(94,200,255,0.15)] p-8">
          <div className="text-center space-y-2">
            <h1
              className="text-2xl font-extrabold"
              style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              Closed beta
            </h1>
            <p className="text-sm text-white/55">
              The Rhyme Game is in private testing. Ask your friend for an invite link.
            </p>
          </div>

          <div className="h-px bg-[rgba(94,200,255,0.12)]" />

          <WaitlistForm label="Get notified when we open up" />

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
