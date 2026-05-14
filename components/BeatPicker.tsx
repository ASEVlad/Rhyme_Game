'use client';

import { useState } from 'react';
import type { Beat, BeatCategory } from '@/lib/beats';

type Props = {
  beats: Beat[];
  selectedId: string | null;
  onChange: (id: string) => void;
};

// Derives ordered unique categories present in the beats array, plus 'youtube' chip if any beat has source === 'youtube'.
export function availableCategories(beats: Beat[]): Array<BeatCategory | 'youtube'> {
  const seen = new Set<BeatCategory>();
  const result: Array<BeatCategory | 'youtube'> = [];
  for (const b of beats) {
    if (!seen.has(b.category)) { seen.add(b.category); result.push(b.category); }
  }
  if (beats.some(b => b.source === 'youtube')) {
    result.push('youtube');
  }
  return result;
}

export function BeatPicker({ beats, selectedId, onChange }: Props) {
  const [activeCat, setActiveCat] = useState<BeatCategory | 'youtube' | 'all'>('all');

  if (beats.length === 0) {
    return <div className="text-white/60 text-center">No beats added yet</div>;
  }

  const cats = availableCategories(beats);
  const rawFiltered =
    activeCat === 'all'     ? beats :
    activeCat === 'youtube' ? beats.filter(b => b.source === 'youtube') :
                              beats.filter(b => b.category === activeCat);
  const filtered = rawFiltered.length > 0 ? rawFiltered : beats;

  function handleCatChange(cat: BeatCategory | 'youtube' | 'all') {
    setActiveCat(cat);
    const newFiltered =
      cat === 'all'     ? beats :
      cat === 'youtube' ? beats.filter(b => b.source === 'youtube') :
                          beats.filter(b => b.category === cat);
    if (newFiltered.length > 0 && !newFiltered.find(b => b.id === selectedId)) {
      onChange(newFiltered[0].id);
    }
  }

  const idx = Math.max(0, filtered.findIndex(b => b.id === selectedId));
  const current = filtered[idx] ?? filtered[0];
  const prev = () => onChange(filtered[(idx - 1 + filtered.length) % filtered.length].id);
  const next = () => onChange(filtered[(idx + 1) % filtered.length].id);

  return (
    <div className="flex flex-col gap-2">
      {cats.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleCatChange('all')}
            className={[
              'rounded-full px-3 py-1 text-xs font-bold',
              activeCat === 'all'
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-white/40',
            ].join(' ')}
          >
            All
          </button>
          {cats.map(cat => (
            <button
              key={cat}
              onClick={() => handleCatChange(cat)}
              className={[
                'rounded-full px-3 py-1 text-xs font-bold',
                activeCat === cat
                  ? 'bg-rhyme-yellow/20 text-rhyme-yellow border border-rhyme-yellow'
                  : 'bg-white/5 text-white/40',
              ].join(' ')}
            >
              {cat === 'youtube' ? 'YouTube' : cat}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-3">
        <button onClick={prev} aria-label="Previous beat"
                className="h-10 w-10 rounded-full bg-white/10 text-xl">◀</button>
        <div className="text-center">
          <div className="font-bold">{current.title}</div>
          <div className="text-white/60 text-sm">
            {Number.isInteger(current.bpm) ? current.bpm : current.bpm.toFixed(1)} BPM
          </div>
        </div>
        <button onClick={next} aria-label="Next beat"
                className="h-10 w-10 rounded-full bg-white/10 text-xl">▶</button>
      </div>
    </div>
  );
}
