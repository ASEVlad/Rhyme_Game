'use client';

import { useState } from 'react';
import { BEATS } from '@/lib/beats';
import { BeatPicker } from './BeatPicker';

type Props = {
  initialBeatId: string | null;
  onPlay: (beatId: string) => void;
  onLogout: () => void;
};

export function Setup({ initialBeatId, onPlay, onLogout }: Props) {
  const [beatId, setBeatId] = useState<string | null>(initialBeatId ?? BEATS[0]?.id ?? null);
  const canPlay = beatId !== null;
  return (
    <main className="flex min-h-screen flex-col p-6">
      <div className="flex justify-end">
        <button onClick={onLogout} className="text-white/60 hover:text-white">Вийти</button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <h1 className="text-4xl font-extrabold">Римова Гра</h1>
        <button
          onClick={() => beatId && onPlay(beatId)}
          disabled={!canPlay}
          className="rounded-2xl bg-rhyme-yellow px-12 py-5 text-3xl font-extrabold text-bg disabled:opacity-50"
        >
          ГРАТИ
        </button>
        <div className="w-full max-w-sm">
          <BeatPicker beats={BEATS} selectedId={beatId} onChange={setBeatId} />
        </div>
      </div>
    </main>
  );
}
