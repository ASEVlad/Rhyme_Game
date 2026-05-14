'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BEATS, pickBeat } from '@/lib/beats';
import type { Bar } from '@/lib/flatten-bars';
import { DEFAULT_LANGUAGE, type LanguageId } from '@/lib/languages';
import { useBeat } from '@/hooks/useBeat';
import { useGameLoop } from '@/hooks/useGameLoop';
import { Setup } from './Setup';
import { WordGrid } from './WordGrid';
import { BouncingBall } from './BouncingBall';
import { EndScreen } from './EndScreen';

type Phase = 'setup' | 'loading' | 'playing' | 'ended';

export function Game() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('setup');
  const [beatId, setBeatId] = useState<string | null>(BEATS[0]?.id ?? null);
  const [languageId, setLanguageId] = useState<LanguageId>(DEFAULT_LANGUAGE);
  const [bars, setBars] = useState<Bar[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const beat = pickBeat(beatId ?? undefined);
  const beatHandle = useBeat(beat);

  const tick = useGameLoop({
    audio: phase === 'playing' ? beatHandle.audio : null,
    bpm: beat?.bpm ?? 90,
    totalBars: bars.length,
    active: phase === 'playing',
    startOffset: beat?.startOffset ?? 0,
    onEnd: () => {
      beatHandle.stop();
      setPhase('ended');
    },
  });

  useEffect(() => {
    if (phase !== 'loading' || !beat) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/rhymes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ language: languageId }),
        });
        if (!res.ok) throw new Error('rhymes-failed');
        const json = await res.json();
        if (cancelled) return;
        setBars(json.bars);
        try {
          await beatHandle.play();
        } catch {
          throw new Error('audio-failed');
        }
        if (cancelled) return;
        setPhase('playing');
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error && err.message === 'audio-failed'
              ? "Couldn't play beat"
              : "Couldn't load rhymes"
          );
          setPhase('setup');
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  function handlePlay(id: string, lang: LanguageId) {
    setBeatId(id);
    setLanguageId(lang);
    setLoadError(null);
    setPhase('loading');
  }

  function quitToSetup() {
    beatHandle.stop();
    setPhase('setup');
  }

  if (phase === 'setup') {
    return (
      <>
        {loadError && (
          <div className="bg-rhyme-red/30 text-center py-2">{loadError}</div>
        )}
        <Setup
          initialBeatId={beatId}
          initialLanguageId={languageId}
          onPlay={handlePlay}
          onLogout={logout}
        />
      </>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-xl">
        Loading…
      </div>
    );
  }

  if (phase === 'ended') {
    return (
      <EndScreen
        onPlayAgain={() => setPhase('loading')}
        onChangeBeat={() => setPhase('setup')}
      />
    );
  }

  // playing
  return (
    <main className="min-h-screen p-4 flex flex-col">
      <div className="flex justify-between mb-2">
        <button onClick={() => {
          if (confirm('End session?')) quitToSetup();
        }} aria-label="Quit" className="text-white/70 text-xl">←</button>
        <div className="text-white/60 text-sm">
          {beat?.title} · {beat?.bpm.toFixed(1)} BPM
        </div>
      </div>
      <BouncingBall x={tick.ballX} yDip={tick.ballYDip} />
      <div className="mt-4 mx-auto w-full max-w-md">
        <WordGrid bars={bars} activeRow={tick.currentBar} ballX={tick.ballX} />
      </div>
    </main>
  );
}
