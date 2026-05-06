'use client';

import { useEffect, useRef, useState } from 'react';
import type { Beat } from '@/lib/beats';

export type BeatHandle = {
  audio: HTMLAudioElement | null;
  isReady: boolean;
  isPlaying: boolean;
  error: string | null;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
};

export function useBeat(beat: Beat | undefined): BeatHandle {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isReady, setReady] = useState(false);
  const [isPlaying, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReady(false);
    setError(null);
    setPlaying(false);
    if (!beat) {
      audioRef.current = null;
      return;
    }
    const a = new Audio(beat.src);
    a.loop = true;
    a.preload = 'auto';
    const onCanPlay = () => setReady(true);
    const onError = () => setError('Не вдалося завантажити біт');
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener('canplaythrough', onCanPlay);
    a.addEventListener('error', onError);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    audioRef.current = a;
    return () => {
      a.pause();
      a.removeEventListener('canplaythrough', onCanPlay);
      a.removeEventListener('error', onError);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      audioRef.current = null;
    };
  }, [beat?.src]);

  return {
    audio: audioRef.current,
    isReady,
    isPlaying,
    error,
    play: async () => {
      const a = audioRef.current;
      if (!a) return;
      a.currentTime = 0;
      await a.play();
    },
    pause: () => audioRef.current?.pause(),
    stop: () => {
      const a = audioRef.current;
      if (!a) return;
      a.pause();
      a.currentTime = 0;
    },
  };
}
