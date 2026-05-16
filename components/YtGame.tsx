// components/YtGame.tsx
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useGamePhases } from '@/hooks/useGamePhases';
import { signOut } from 'next-auth/react';
import { YtSetup } from './YtSetup';
import { WordGrid } from './WordGrid';
import { EndScreen } from './EndScreen';
import { fadePage } from '@/lib/motion-variants';

export function YtGame() {
  const {
    phase, activeBeat, bars, tick, pulseColor, loadError,
    handlePlay, quitToSetup, playAgain, goToSetup,
  } = useGamePhases();

  async function logout() {
    await signOut({ callbackUrl: '/login' });
  }

  return (
    <AnimatePresence mode="wait">
      {phase === 'setup' && (
        <motion.div key="setup" {...fadePage}>
          <YtSetup onPlay={handlePlay} onLogout={logout} errorMessage={loadError} />
        </motion.div>
      )}

      {phase === 'loading' && (
        <motion.div key="loading" {...fadePage}>
          <div className="flex min-h-screen items-center justify-center text-xl">
            Loading…
          </div>
        </motion.div>
      )}

      {phase === 'ended' && (
        <motion.div key="ended" {...fadePage}>
          <EndScreen onPlayAgain={playAgain} onChangeBeat={goToSetup} />
        </motion.div>
      )}

      {phase === 'playing' && (
        <motion.div key="playing" {...fadePage}>
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
              <div className="mt-4 mx-auto w-full max-w-md lg:max-w-3xl">
                <WordGrid bars={bars} activeRow={tick.currentBar} ballX={tick.ballX} />
              </div>
            </div>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
