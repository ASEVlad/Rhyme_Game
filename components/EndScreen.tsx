'use client';

import { motion } from 'framer-motion';

type Props = {
  onPlayAgain: () => void;
  onChangeBeat: () => void;
};

export function EndScreen({ onPlayAgain, onChangeBeat }: Props) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <h2 className="text-4xl font-extrabold">Nice work!</h2>
      <motion.button
        whileTap={{ scale: 0.96 }}
        transition={{ duration: 0.1 }}
        onClick={onPlayAgain}
        className="rounded-2xl bg-rhyme-yellow px-10 py-4 text-2xl font-bold text-bg"
      >
        Play again
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.96 }}
        transition={{ duration: 0.1 }}
        onClick={onChangeBeat}
        className="rounded-2xl bg-white/10 px-10 py-4 text-xl"
      >
        Change beat
      </motion.button>
    </div>
  );
}
