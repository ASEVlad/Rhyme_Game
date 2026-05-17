'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

type Props = {
  onPlayAgain: () => void;
  onChangeBeat: () => void;
};

export function EndScreen({ onPlayAgain, onChangeBeat }: Props) {
  return (
    <main
      className="relative flex min-h-screen flex-col bg-[#060c14]"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 30% at 50% -5%, rgba(94,200,255,0.13) 0%, transparent 100%)',
      }}
    >
      {/* TOP — brand bar (consistent with the rest of the app) */}
      <nav className="flex items-center h-16 px-6 md:px-12 shrink-0">
        <Link
          href="/"
          className="font-extrabold text-sm tracking-wide hover:opacity-80 transition-opacity"
          style={{ background: 'linear-gradient(135deg,#5ec8ff,#2860e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
        >
          THE RHYME GAME
        </Link>
      </nav>

      {/* CONTENT — centered congrats + actions */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 md:px-12 pb-8">
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
      </div>
    </main>
  );
}
