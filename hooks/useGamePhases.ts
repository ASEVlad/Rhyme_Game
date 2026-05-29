'use client';

import { useEffect, useState, useRef } from 'react';
import type { Beat } from '@/lib/beats';
import type { Bar } from '@/lib/flatten-bars';
import { flattenBars } from '@/lib/flatten-bars';
import { DEFAULT_LANGUAGE, type LanguageId } from '@/lib/languages';
import { DEFAULT_DIFFICULTY, type DifficultyId } from '@/lib/difficulties';
import { DEFAULT_SCHEME, getRhymeScheme, type RhymeSchemeId } from '@/lib/rhyme-schemes';
import { computeRhymeFillPlan } from '@/lib/rhyme-fill';
import { sampleBlocks } from '@/lib/rhymes';
import type { RhymeBlock } from '@/lib/fallback-groups';
import { useBeat } from '@/hooks/useBeat';
import { useGameLoop, type GameTick } from '@/hooks/useGameLoop';
import { addRecentBeat } from '@/lib/recent-beats';
import type { RhymeColor } from '@/lib/colors';

const MAX_EXCLUDED_WORDS = 60;

const PULSE_COLOR: Record<RhymeColor, string> = {
  yellow: 'rgba(255,212,71,0.10)',
  blue:   'rgba(58,163,255,0.10)',
  orange: 'rgba(255,138,60,0.10)',
  red:    'rgba(228,77,77,0.10)',
};

export type Phase = 'setup' | 'loading' | 'playing' | 'ended';

export type GamePhasesReturn = {
  phase: Phase;
  activeBeat: Beat | null;
  languageId: LanguageId;
  difficultyId: DifficultyId;
  schemeId: RhymeSchemeId;
  bars: Bar[];
  loadError: string | null;
  tick: GameTick;
  pulseColor: string;
  handlePlay: (beat: Beat, lang: LanguageId, difficulty: DifficultyId, scheme: RhymeSchemeId) => void;
  quitToSetup: () => void;
  playAgain: () => void;
  goToSetup: () => void;
};

export function useGamePhases(): GamePhasesReturn {
  const [phase, setPhase] = useState<Phase>('setup');
  const [activeBeat, setActiveBeat] = useState<Beat | null>(null);
  const [languageId, setLanguageId] = useState<LanguageId>(DEFAULT_LANGUAGE);
  const [difficultyId, setDifficultyId] = useState<DifficultyId>(DEFAULT_DIFFICULTY);
  const [schemeId, setSchemeId] = useState<RhymeSchemeId>(DEFAULT_SCHEME);
  const [bars, setBars] = useState<Bar[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const usedWordsRef = useRef<string[]>([]);

  const beatHandle = useBeat(activeBeat ?? undefined);

  const tick = useGameLoop({
    audio: phase === 'playing' ? beatHandle.audio : null,
    bpm: activeBeat?.bpm ?? 90,
    active: phase === 'playing',
    startOffset: activeBeat?.startOffset ?? 0,
    onEnd: () => {
      beatHandle.stop();
      setPhase('ended');
    },
  });

  useEffect(() => {
    if (phase !== 'loading' || !activeBeat) return;
    if (beatHandle.duration == null) return; // wait for loadedmetadata
    let cancelled = false;
    const scheme = getRhymeScheme(schemeId);
    const plan = computeRhymeFillPlan({
      duration: beatHandle.duration,
      bpm: activeBeat.bpm,
      startOffset: activeBeat.startOffset ?? 0,
    });

    (async () => {
      try {
        const res = await fetch('/api/rhymes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            language: languageId,
            difficultyId,
            schemeId,
            count: plan.count,
            exclude: {
              words: usedWordsRef.current,
              endings: [],
            },
            beat: {
              id: activeBeat.id,
              title: activeBeat.title,
              bpm: activeBeat.bpm,
              category: activeBeat.category,
              source: activeBeat.source ?? 'local',
            },
          }),
        });
        if (!res.ok) throw new Error('rhymes-failed');
        const json = await res.json();
        if (cancelled) return;

        const allBlocks: RhymeBlock[] = json.blocks ?? [];
        const picked = sampleBlocks(allBlocks, allBlocks.length); // shuffle, keep all
        const flat = flattenBars(picked, scheme);
        const newBars = flat.slice(0, Math.max(0, plan.targetBars));

        const renderedBlockIndices = new Set(newBars.map(b => b.blockIndex));
        const renderedBlocks = picked.filter((_, i) => renderedBlockIndices.has(i));
        const roundWords = renderedBlocks.flatMap(b => b.words).filter(w => w.length > 0);
        usedWordsRef.current = [
          ...usedWordsRef.current,
          ...roundWords,
        ].slice(-MAX_EXCLUDED_WORDS);

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
    // Intentional: effect reads languageId/difficultyId/schemeId/beatHandle as
    // stable snapshots from the render that set phase='loading'. playAgain()
    // deliberately re-uses the last settings by only setting phase, not re-setting
    // the other state. Effect re-fires once per (phase, duration) tuple — duration
    // is stable across replays of the same beat, so playAgain triggers exactly one
    // rhyme refetch. Do not add other deps without re-auditing playAgain.
  }, [phase, beatHandle.duration]);

  function handlePlay(beat: Beat, lang: LanguageId, difficulty: DifficultyId, scheme: RhymeSchemeId) {
    addRecentBeat(beat.id);
    setActiveBeat(beat);
    setLanguageId(lang);
    setDifficultyId(difficulty);
    setSchemeId(scheme);
    setLoadError(null);
    setPhase('loading');
  }

  function quitToSetup() {
    beatHandle.stop();
    setPhase('setup');
  }

  const activeColor = bars[tick.currentBar]?.color;
  const pulseColor = activeColor ? PULSE_COLOR[activeColor] : 'transparent';

  return {
    phase,
    activeBeat,
    languageId,
    difficultyId,
    schemeId,
    bars,
    loadError,
    tick,
    pulseColor,
    handlePlay,
    quitToSetup,
    playAgain: () => setPhase('loading'),
    goToSetup: () => setPhase('setup'),
  };
}
