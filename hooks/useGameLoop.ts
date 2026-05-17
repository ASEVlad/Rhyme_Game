'use client';

import { useEffect, useRef, useState } from 'react';
import { makeSessionTimer } from '@/lib/session-time';

export type GameTick = {
  ballX: number;        // 0..1 across the 4 cells of the active row
  currentBar: number;   // 0..totalBars (counts up)
  beatInBar: number;    // 0..4 (continuous)
};

export function useGameLoop(args: {
  audio: HTMLAudioElement | null;
  bpm: number;
  active: boolean;
  onEnd: () => void;
  startOffset?: number;
}): GameTick {
  const { audio, bpm, active, onEnd, startOffset = 0 } = args;
  const [tick, setTick] = useState<GameTick>({ ballX: 0, currentBar: 0, beatInBar: 0 });
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    if (!active || !audio) return;
    const sessionTime = makeSessionTimer(audio, startOffset);
    let raf = 0;
    let ended = false;
    const beatsPerSecond = bpm / 60;

    const terminate = () => {
      if (ended) return;
      ended = true;
      cancelAnimationFrame(raf);
      onEndRef.current();
    };

    const onAudioEnded = () => terminate();
    audio.addEventListener('ended', onAudioEnded);

    const frame = () => {
      const t = sessionTime();
      const currentBeat = t * beatsPerSecond;
      // The ball's bounce peaks in the middle of each cell. Shifting the
      // audio-time anchor by half a beat puts an integer-beat kick at the
      // moment of the peak — so each landing aligns with the kick.
      const shiftedBeat = currentBeat + 0.5;
      const currentBar = Math.floor(shiftedBeat / 4);
      const beatInBar = shiftedBeat % 4;
      const ballX = beatInBar / 4;
      setTick({ ballX, currentBar, beatInBar });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      audio.removeEventListener('ended', onAudioEnded);
    };
  }, [active, audio, bpm, startOffset]);

  return tick;
}
