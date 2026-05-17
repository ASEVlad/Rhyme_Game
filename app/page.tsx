import Link from 'next/link';
import { LandingHeroGrid } from '@/components/LandingHeroGrid';

export default function LandingPage() {
  return (
    <main
      className="flex min-h-screen flex-col bg-[#060c14]"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(94,200,255,0.22) 0%, transparent 100%)' }}
    >
      {/* TOP — brand bar (h-16, fixed) */}
      <nav className="flex items-center justify-between h-16 px-6 md:px-12 shrink-0">
        <span
          className="font-extrabold text-sm tracking-wide"
          style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          THE RHYME GAME
        </span>
        <Link
          href="/login"
          className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#060c14]"
          style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)' }}
        >
          Log in →
        </Link>
      </nav>

      {/* MIDDLE — asymmetric snapshot grid (flex-1, fills) */}
      <div className="flex-1 flex items-center justify-center md:justify-end px-6 md:px-0 py-8 md:py-12">
        <div className="w-full max-w-[440px] md:max-w-[520px] md:mr-[-16px]">
          <LandingHeroGrid />
          <p className="mt-3 text-xs tracking-widest text-white/40 text-right pr-1">
            Calm Bap · 88 BPM
          </p>
        </div>
      </div>

      {/* BOTTOM — title + tagline + CTA, left-anchored */}
      <div className="px-6 md:px-12 py-8 md:py-12 space-y-4 shrink-0">
        <h1
          className="text-5xl md:text-7xl font-extrabold leading-tight"
          style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          The Rhyme <br />Game.
        </h1>
        <p className="text-base text-white/55 leading-relaxed max-w-sm">
          Beat plays. Ball bounces. Your rhyme lands on time.
        </p>
        <Link
          href="/login"
          className="inline-block w-full md:w-[420px] rounded-2xl px-8 py-5 text-2xl font-extrabold text-[#060c14] text-center"
          style={{
            background: 'linear-gradient(135deg,#5ec8ff,#2860e0)',
            boxShadow: '0 0 32px rgba(94,200,255,0.40)',
          }}
        >
          GET STARTED →
        </Link>
      </div>
    </main>
  );
}
