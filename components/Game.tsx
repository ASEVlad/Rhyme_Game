'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BEATS } from '@/lib/beats';
import type { Beat } from '@/lib/beats';
import type { Bar } from '@/lib/flatten-bars';
import { flattenBars } from '@/lib/flatten-bars';
import { DEFAULT_LANGUAGE, type LanguageId } from '@/lib/languages';
import { sampleGroups } from '@/lib/rhymes';
import type { RhymeGroup } from '@/lib/fallback-groups';
import { useBeat } from '@/hooks/useBeat';
import { useGameLoop } from '@/hooks/useGameLoop';
import { addRecentBeat } from '@/lib/recent-beats';
import type { RhymeColor } from '@/lib/colors';
import { Setup } from './Setup';
import { WordGrid } from './WordGrid';
import { BouncingBall } from './BouncingBall';
import { EndScreen } from './EndScreen';

const MAX_EXCLUDED_WORDS = 60;
const MAX_EXCLUDED_ENDINGS = 20;

const PULSE_COLOR: Record<RhymeColor, string> = {
  yellow: 'rgba(255,212,71,0.10)',
  blue:   'rgba(58,163,255,0.10)',
  orange: 'rgba(255,138,60,0.10)',
  red:    'rgba(228,77,77,0.10)',
};

type Phase = 'setup' | 'loading' | 'playing' | 'ended';

export function Game() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('setup');
  const [activeBeat, setActiveBeat] = useState<Beat | null>(BEATS[0] ?? null);
  const [languageId, setLanguageId] = useState<LanguageId>(DEFAULT_LANGUAGE);
  const [bars, setBars] = useState<Bar[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const usedWordsRef = useRef<string[]>([]);
  const usedEndingsRef = useRef<string[]>([]);

  const beatHandle = useBeat(activeBeat ?? undefined);

  const tick = useGameLoop({
    audio: phase === 'playing' ? beatHandle.audio : null,
    bpm: activeBeat?.bpm ?? 90,
    totalBars: bars.length,
    active: phase === 'playing',
    startOffset: activeBeat?.startOffset ?? 0,
    onEnd: () => {
      beatHandle.stop();
      setPhase('ended');
    },
  });

  useEffect(() => {
    if (phase !== 'loading' || !activeBeat) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/rhymes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            language: languageId,
            exclude: {
              words: usedWordsRef.current,
              endings: usedEndingsRef.current,
            },
          }),
        });
        if (!res.ok) throw new Error('rhymes-failed');
        const json = await res.json();
        if (cancelled) return;

        const allGroups: RhymeGroup[] = json.groups ?? [];
        const picked = sampleGroups(allGroups, 10);
        const newBars = flattenBars(picked);

        const roundWords = picked.flatMap(g => g.words);
        const roundEndings = picked.map(g => g.ending);
        usedWordsRef.current = [
          ...usedWordsRef.current,
          ...roundWords,
        ].slice(-MAX_EXCLUDED_WORDS);
        usedEndingsRef.current = [
          ...usedEndingsRef.current,
          ...roundEndings,
        ].slice(-MAX_EXCLUDED_ENDINGS);

        setBars(newBars);
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

  function handlePlay(beat: Beat, lang: LanguageId) {
    addRecentBeat(beat.id);
    setActiveBeat(beat);
    setLanguageId(lang);
    setLoadError(null);
    setPhase('loading');
  }

  function quitToSetup() {
    beatHandle.stop();
    setPhase('setup');
  }

  if (phase === 'setup') {
    const isYtBeat = activeBeat !== null && !BEATS.some(b => b.id === activeBeat.id);
    return (
      <>
        {loadError && (
          <div className="bg-rhyme-red/30 text-center py-2">{loadError}</div>
        )}
        <Setup
          initialBeatId={isYtBeat ? null : (activeBeat?.id ?? null)}
          initialYtBeat={isYtBeat ? activeBeat : undefined}
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
  const activeColor = bars[tick.currentBar]?.color;
  const pulseColor = activeColor ? PULSE_COLOR[activeColor] : 'transparent';

  return (
    <main className="relative min-h-screen p-4 flex flex-col">
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{ backgroundColor: pulseColor, transition: 'background-color 400ms ease' }}
      />
      <div className="relative z-10">
        <div className="flex justify-between mb-2" style={{ opacity: 0.18 }}>
          <button
            onClick={() => { if (confirm('End session?')) quitToSetup(); }}
            aria-label="Quit"
            className="text-white/70 text-xl"
          >←</button>
          <div className="text-white/60 text-sm">
            {activeBeat?.title} · {activeBeat?.bpm.toFixed(1)} BPM
          </div>
        </div>
        <div className="mt-4 mx-auto w-full max-w-md">
          <BouncingBall x={tick.ballX} />
          <WordGrid bars={bars} activeRow={tick.currentBar} ballX={tick.ballX} />
        </div>
      </div>
    </main>
  );
}
