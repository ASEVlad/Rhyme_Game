'use client';

import { useEffect, useState } from 'react';
import { WordGrid } from './WordGrid';

type Props = {
  /** BPM for the preview animation. Defaults to 90 when undefined. */
  bpm?: number;
};

export function LoadingScreen({ bpm = 90 }: Props) {
  const [ballX, setBallX] = useState(0);

  useEffect(() => {
    let raf = 0;
    let start: number | null = null;
    const beatsPerSecond = bpm / 60;
    const frame = (now: number) => {
      if (start == null) start = now;
      const elapsed = (now - start) / 1000;
      const beats = elapsed * beatsPerSecond;
      const x = (beats % 4) / 4;
      setBallX(x);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [bpm]);

  return (
    <main
      className="relative min-h-screen p-4 flex flex-col bg-[#060c14]"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 30% at 50% -5%, rgba(94,200,255,0.13) 0%, transparent 100%)',
      }}
    >
      <div className="relative z-10 mt-12 mx-auto w-full max-w-md lg:max-w-3xl">
        <WordGrid bars={[]} activeRow={0} ballX={ballX} />
        <div className="mt-8 text-center text-sm text-[rgba(94,200,255,0.7)]">
          Loading rhymes…
        </div>
      </div>
    </main>
  );
}
