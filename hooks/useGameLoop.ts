'use client';

import { useEffect, useRef, useState } from 'react';
import { makeSessionTimer } from '@/lib/session-time';

export type GameTick = {
  ballX: number;        // 0..1 across the 4 cells of the active row
  ballYDip: number;     // 0..1, sine bounce
  currentBar: number;   // 0..totalBars (counts up)
  beatInBar: number;    // 0..4 (continuous)
};

export function useGameLoop(args: {
  audio: HTMLAudioElement | null;
  bpm: number;
  totalBars: number;
  active: boolean;
  onEnd: () => void;
}): GameTick {
  const { audio, bpm, totalBars, active, onEnd } = args;
  const [tick, setTick] = useState<GameTick>({ ballX: 0, ballYDip: 0, currentBar: 0, beatInBar: 0 });
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    if (!active || !audio) return;
    const sessionTime = makeSessionTimer(audio);
    let raf = 0;
    let ended = false;
    const beatsPerSecond = bpm / 60;

    const frame = () => {
      const t = sessionTime();
      const currentBeat = t * beatsPerSecond;
      const currentBar = Math.floor(currentBeat / 4);
      const beatInBar = currentBeat % 4;
      const ballX = beatInBar / 4;
      // Sine dip — ball is "lower" between beats, "higher" on each beat.
      const phase = (beatInBar % 1) * Math.PI;
      const ballYDip = Math.sin(phase);
      setTick({ ballX, ballYDip, currentBar, beatInBar });
      if (currentBar >= totalBars && !ended) {
        ended = true;
        onEndRef.current();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active, audio, bpm, totalBars]);

  return tick;
}
