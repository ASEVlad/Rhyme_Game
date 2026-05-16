'use client';

import { motion } from 'framer-motion';

type Props = {
  onPlayAgain: () => void;
  onChangeBeat: () => void;
};

export function EndScreen({ onPlayAgain, onChangeBeat }: Props) {
  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-6 bg-[#060c14]"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 30% at 50% -5%, rgba(94,200,255,0.13) 0%, transparent 100%)',
      }}
    >
      <h2
        className="text-5xl font-extrabold text-white"
        style={{ textShadow: '0 0 16px rgba(94,200,255,0.45)' }}
      >
        Nice work!
      </h2>
      <motion.button
        whileTap={{ scale: 0.96 }}
        transition={{ duration: 0.1 }}
        onClick={onPlayAgain}
        className="rounded-2xl px-10 py-4 text-2xl font-extrabold text-[#060c14]"
        style={{
          background: 'linear-gradient(135deg,#5ec8ff,#2860e0)',
          boxShadow: '0 0 32px rgba(94,200,255,0.45)',
        }}
      >
        Play again
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.96 }}
        transition={{ duration: 0.1 }}
        onClick={onChangeBeat}
        className="rounded-2xl border px-10 py-4 text-xl"
        style={{
          borderColor: 'rgba(94,200,255,0.4)',
          color: 'rgba(94,200,255,0.9)',
        }}
      >
        Change beat
      </motion.button>
    </main>
  );
}
