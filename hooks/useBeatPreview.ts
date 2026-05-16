'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Beat } from '@/lib/beats';

export const PREVIEW_START_SEC = 15;
export const PREVIEW_DURATION_MS = 15000;

export type BeatPreviewHandle = {
  previewingId: string | null;
  startPreview: (beat: Beat) => void;
  togglePreview: (beat: Beat) => void;
  stopPreview: () => void;
};

export function useBeatPreview(): BeatPreviewHandle {
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metaListenerRef = useRef<(() => void) | null>(null);
  const errorListenerRef = useRef<(() => void) | null>(null);

  const stopPreview = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      if (metaListenerRef.current) {
        audio.removeEventListener('loadedmetadata', metaListenerRef.current);
        metaListenerRef.current = null;
      }
      if (errorListenerRef.current) {
        audio.removeEventListener('error', errorListenerRef.current);
        errorListenerRef.current = null;
      }
      audio.pause();
    }
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    setPreviewingId(null);
  }, []);

  const startPreview = useCallback((beat: Beat) => {
    stopPreview();
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    audio.loop = false;
    audio.src = beat.src;
    const onMeta = () => {
      audio.currentTime = Math.min(
        PREVIEW_START_SEC,
        Math.max(0, (audio.duration || 0) - 1),
      );
      audio.play().catch(() => setPreviewingId(null));
      stopTimerRef.current = setTimeout(stopPreview, PREVIEW_DURATION_MS);
    };
    audio.addEventListener('loadedmetadata', onMeta);
    metaListenerRef.current = onMeta;
    const onError = () => setPreviewingId(null);
    audio.addEventListener('error', onError);
    errorListenerRef.current = onError;
    setPreviewingId(beat.id);
  }, [stopPreview]);

  const togglePreview = useCallback((beat: Beat) => {
    if (previewingId === beat.id) stopPreview();
    else startPreview(beat);
  }, [previewingId, startPreview, stopPreview]);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        if (metaListenerRef.current) {
          audio.removeEventListener('loadedmetadata', metaListenerRef.current);
          metaListenerRef.current = null;
        }
        if (errorListenerRef.current) {
          audio.removeEventListener('error', errorListenerRef.current);
          errorListenerRef.current = null;
        }
        audio.pause();
      }
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
    };
  }, []);

  return { previewingId, startPreview, togglePreview, stopPreview };
}
