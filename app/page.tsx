import Link from 'next/link';

const GRID_CELLS = [
  { id: '0-0', variant: 'empty' }, { id: '0-1', variant: 'empty' }, { id: '0-2', variant: 'ball' },  { id: '0-3', variant: 'yellow' },
  { id: '1-0', variant: 'active' }, { id: '1-1', variant: 'active' }, { id: '1-2', variant: 'active' }, { id: '1-3', variant: 'blue' },
  { id: '2-0', variant: 'empty' }, { id: '2-1', variant: 'empty' }, { id: '2-2', variant: 'empty' }, { id: '2-3', variant: 'orange' },
  { id: '3-0', variant: 'empty' }, { id: '3-1', variant: 'empty' }, { id: '3-2', variant: 'empty' }, { id: '3-3', variant: 'red' },
] as const;

const CELL_CLASS: Record<string, string> = {
  empty:  'bg-white/[0.06]',
  active: 'bg-white/[0.15]',
  yellow: 'bg-[#ffd447]',
  blue:   'bg-[#3aa3ff]',
  orange: 'bg-[#ff8a3c]',
  red:    'bg-[#e44d4d]',
};

export default function LandingPage() {
  return (
    <main
      className="flex min-h-screen flex-col bg-[#060c14]"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(94,200,255,0.22) 0%, transparent 100%)' }}
    >
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-[rgba(94,200,255,0.12)]">
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

      {/* Split hero */}
      <div className="flex-1 grid md:grid-cols-2">
        {/* Left: pitch */}
        <div className="flex flex-col justify-center gap-5 px-8 py-12 md:px-12">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[rgba(94,200,255,0.65)]">
            Freestyle rap trainer
          </p>
          <h1
            className="text-5xl font-extrabold leading-tight md:text-6xl"
            style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            The Rhyme<br />Game
          </h1>
          <p className="text-base text-white/50 leading-relaxed max-w-xs">
            Beat plays. Ball bounces.<br />Your rhyme lands on time.
          </p>
          <Link
            href="/login"
            className="self-start rounded-2xl px-8 py-4 text-xl font-extrabold text-[#060c14]"
            style={{
              background: 'linear-gradient(135deg,#5ec8ff,#2860e0)',
              boxShadow: '0 0 32px rgba(94,200,255,0.40)',
            }}
          >
            GET STARTED →
          </Link>
        </div>

        {/* Right: decorative game grid (hidden on mobile) */}
        <div className="hidden md:flex flex-col items-center justify-center border-l border-[rgba(94,200,255,0.10)] px-12">
          <div className="grid grid-cols-4 gap-2 w-full max-w-xs">
            {GRID_CELLS.map(({ id, variant }) =>
              variant === 'ball' ? (
                <div key={id} className="relative h-14 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <div
                    className="w-5 h-5 rounded-full bg-[#ff9d2a]"
                    style={{ boxShadow: '0 0 12px rgba(255,157,42,0.8)' }}
                  />
                </div>
              ) : (
                <div key={id} className={`h-14 rounded-lg ${CELL_CLASS[variant]}`} />
              )
            )}
          </div>
          <p className="mt-4 text-xs text-white/30 tracking-wide">Calm Bap · 88 BPM</p>
        </div>
      </div>

      {/* Feature pills */}
      <div className="flex gap-3 px-8 py-6 md:px-12 border-t border-[rgba(94,200,255,0.08)]">
        {[
          { label: 'Beat', desc: 'Hip-hop instrumentals' },
          { label: 'Rhyme', desc: 'AI word prompts' },
          { label: 'Flow', desc: 'Lock to the bar' },
        ].map(({ label, desc }) => (
          <div
            key={label}
            className="flex-1 rounded-xl bg-[rgba(94,200,255,0.05)] border border-[rgba(94,200,255,0.12)] px-4 py-3 text-center"
          >
            <p className="text-xs font-bold text-white">{label}</p>
            <p className="text-xs text-white/40 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
