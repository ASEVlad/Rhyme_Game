// components/YtGame.tsx
'use client';

import { useGamePhases } from '@/hooks/useGamePhases';
import { signOut } from 'next-auth/react';
import { YtSetup } from './YtSetup';
import { WordGrid } from './WordGrid';
import { BouncingBall } from './BouncingBall';
import { EndScreen } from './EndScreen';

export function YtGame() {
  const {
    phase, activeBeat, bars, tick, pulseColor, loadError,
    handlePlay, quitToSetup, playAgain, goToSetup,
  } = useGamePhases();

  async function logout() {
    await signOut({ callbackUrl: '/login' });
  }

  if (phase === 'setup') {
    return <YtSetup onPlay={handlePlay} onLogout={logout} errorMessage={loadError} />;
  }

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-xl">
        Loading…
      </div>
    );
  }

  if (phase === 'ended') {
    return <EndScreen onPlayAgain={playAgain} onChangeBeat={goToSetup} />;
  }

  // playing
  return (
    <main
      className="relative min-h-screen p-4 flex flex-col bg-[#060c14]"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 30% at 50% -5%, rgba(94,200,255,0.13) 0%, transparent 100%)' }}
    >
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{ background: `radial-gradient(ellipse at 50% 35%, ${pulseColor} 0%, transparent 70%)`, transition: 'background 400ms ease' }}
      />
      <div className="relative z-10">
        <div className="flex justify-between mb-2" style={{ opacity: 0.18 }}>
          <button
            onClick={() => { if (confirm('End session?')) quitToSetup(); }}
            aria-label="Quit"
            className="text-white/70 text-xl"
          >←</button>
          <div className="text-white/60 text-sm">
            {activeBeat?.title} · {activeBeat?.bpm.toFixed(1)} BPM
          </div>
        </div>
        <div className="mt-4 mx-auto w-full max-w-md">
          <BouncingBall x={tick.ballX} />
          <WordGrid bars={bars} activeRow={tick.currentBar} ballX={tick.ballX} />
        </div>
      </div>
    </main>
  );
}
