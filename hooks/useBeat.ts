'use client';

import { useEffect, useRef, useState } from 'react';
import type { Beat } from '@/lib/beats';

export type BeatHandle = {
  audio: HTMLAudioElement | null;
  isReady: boolean;
  isPlaying: boolean;
  error: string | null;
  duration: number | null;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
};

export function useBeat(beat: Beat | undefined): BeatHandle {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isReady, setReady] = useState(false);
  const [isPlaying, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    setReady(false);
    setError(null);
    setPlaying(false);
    setDuration(null);
    if (!beat) {
      audioRef.current = null;
      return;
    }
    // encodeURI percent-encodes brackets and other reserved chars that the
    // browser would otherwise leave literal, which Caddy rejects with 404.
    const a = new Audio(encodeURI(beat.src));
    a.loop = false;
    a.preload = 'auto';
    const onCanPlay = () => setReady(true);
    const onError = () => setError('Failed to load beat');
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onMeta = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) {
        setDuration(a.duration);
      }
    };
    a.addEventListener('canplaythrough', onCanPlay);
    a.addEventListener('error', onError);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('loadedmetadata', onMeta);
    audioRef.current = a;
    return () => {
      a.pause();
      a.removeEventListener('canplaythrough', onCanPlay);
      a.removeEventListener('error', onError);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('loadedmetadata', onMeta);
      audioRef.current = null;
    };
  }, [beat?.src]);

  return {
    audio: audioRef.current,
    isReady,
    isPlaying,
    error,
    duration,
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
