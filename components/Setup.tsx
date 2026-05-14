'use client';

import { useEffect, useState } from 'react';
import { BEATS, pickBeat } from '@/lib/beats';
import type { Beat } from '@/lib/beats';
import { LANGUAGES, type LanguageId } from '@/lib/languages';
import { loadLanguage, saveLanguage } from '@/lib/language-storage';
import { BeatPicker } from './BeatPicker';
import { LanguagePicker } from './LanguagePicker';

type Props = {
  initialBeatId: string | null;
  initialLanguageId: LanguageId;
  onPlay: (beat: Beat, languageId: LanguageId) => void;
  onLogout: () => void;
};

export function Setup({ initialBeatId, initialLanguageId, onPlay, onLogout }: Props) {
  const [beatId, setBeatId] = useState<string | null>(initialBeatId ?? BEATS[0]?.id ?? null);
  const [languageId, setLanguageId] = useState<LanguageId>(initialLanguageId);
  const canPlay = beatId !== null;

  // Reconcile language from localStorage / navigator after mount.
  // Done in useEffect (not a lazy state initializer) to avoid SSR/hydration mismatch.
  useEffect(() => {
    const resolved = loadLanguage();
    if (resolved !== languageId) setLanguageId(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function chooseLanguage(id: LanguageId) {
    setLanguageId(id);
    saveLanguage(id);
  }

  return (
    <main className="flex min-h-screen flex-col p-6">
      <div className="flex justify-end">
        <button onClick={onLogout} className="text-white/60 hover:text-white">Log out</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <h1 className="text-4xl font-extrabold">The Rhyme Game</h1>
        <button
          onClick={() => {
            const beat = beatId ? pickBeat(beatId) : undefined;
            if (beat) onPlay(beat, languageId);
          }}
          disabled={!canPlay}
          className="rounded-2xl bg-rhyme-yellow px-12 py-5 text-3xl font-extrabold text-bg disabled:opacity-50"
        >
          PLAY
        </button>
        <div className="w-full max-w-sm space-y-3">
          <BeatPicker beats={BEATS} selectedId={beatId} onChange={setBeatId} />
          <LanguagePicker
            languages={LANGUAGES}
            selectedId={languageId}
            onChange={chooseLanguage}
          />
        </div>
      </div>
    </main>
  );
}
