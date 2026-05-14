'use client';

import { useRouter } from 'next/navigation';
import { BEATS } from '@/lib/beats';
import { useGamePhases } from '@/hooks/useGamePhases';
import { Setup } from './Setup';
import { WordGrid } from './WordGrid';
import { BouncingBall } from './BouncingBall';
import { EndScreen } from './EndScreen';

export function Game() {
  const router = useRouter();
  const {
    phase, activeBeat, languageId, bars, loadError, tick, pulseColor,
    handlePlay, quitToSetup, playAgain, goToSetup,
  } = useGamePhases();

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  if (phase === 'setup') {
    const isYtBeat = activeBeat !== null && !BEATS.some(b => b.id === activeBeat.id);
    return (
      <>
        {loadError && (
          <div className="bg-rhyme-red/30 text-center py-2">{loadError}</div>
        )}
        <Setup
          initialBeatId={isYtBeat ? null : (activeBeat?.id ?? null)}
          initialYtBeat={isYtBeat ? activeBeat : undefined}
          initialLanguageId={languageId}
          onPlay={handlePlay}
          onLogout={logout}
        />
      </>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-xl">
        Loading…
      </div>
    );
  }

  if (phase === 'ended') {
    return (
      <EndScreen
        onPlayAgain={playAgain}
        onChangeBeat={goToSetup}
      />
    );
  }

  // playing
  return (
    <main className="relative min-h-screen p-4 flex flex-col">
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{ backgroundColor: pulseColor, transition: 'background-color 400ms ease' }}
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
