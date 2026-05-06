'use client';

import type { Beat } from '@/lib/beats';

type Props = {
  beats: Beat[];
  selectedId: string | null;
  onChange: (id: string) => void;
};

export function BeatPicker({ beats, selectedId, onChange }: Props) {
  if (beats.length === 0) {
    return <div className="text-white/60 text-center">Біти ще не додано</div>;
  }
  const idx = Math.max(0, beats.findIndex(b => b.id === selectedId));
  const current = beats[idx];
  const prev = () => onChange(beats[(idx - 1 + beats.length) % beats.length].id);
  const next = () => onChange(beats[(idx + 1) % beats.length].id);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-3">
      <button onClick={prev} aria-label="Попередній біт"
              className="h-10 w-10 rounded-full bg-white/10 text-xl">◀</button>
      <div className="text-center">
        <div className="font-bold">{current.title}</div>
        <div className="text-white/60 text-sm">{current.bpm.toFixed(1)} BPM</div>
      </div>
      <button onClick={next} aria-label="Наступний біт"
              className="h-10 w-10 rounded-full bg-white/10 text-xl">▶</button>
    </div>
  );
}
