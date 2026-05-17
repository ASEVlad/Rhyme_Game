'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useGamePhases } from '@/hooks/useGamePhases';
import { Setup } from './Setup';
import { WordGrid } from './WordGrid';
import { EndScreen } from './EndScreen';
import { LoadingScreen } from './LoadingScreen';
import { signOut } from 'next-auth/react';
import { fadePage } from '@/lib/motion-variants';

export function Game() {
  const {
    phase, activeBeat, languageId, bars, loadError, tick, pulseColor,
    handlePlay, quitToSetup, playAgain, goToSetup,
  } = useGamePhases();

  async function logout() {
    await signOut({ callbackUrl: '/login' });
  }

  return (
    <AnimatePresence mode="wait">
      {phase === 'setup' && (
        <motion.div key="setup" {...fadePage}>
          {loadError && (
            <div className="bg-rhyme-red/30 text-center py-2">{loadError}</div>
          )}
          <Setup
            initialBeatId={activeBeat?.source === 'youtube' ? null : (activeBeat?.id ?? null)}
            initialYtBeat={activeBeat?.source === 'youtube' ? activeBeat : undefined}
            initialLanguageId={languageId}
            onPlay={handlePlay}
            onLogout={logout}
          />
        </motion.div>
      )}

      {phase === 'loading' && (
        <motion.div key="loading" {...fadePage}>
          <LoadingScreen bpm={activeBeat?.bpm} onCancel={quitToSetup} />
        </motion.div>
      )}

      {phase === 'ended' && (
        <motion.div key="ended" {...fadePage}>
          <EndScreen
            onPlayAgain={playAgain}
            onChangeBeat={goToSetup}
          />
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
