'use client';

import type { Difficulty, DifficultyId } from '@/lib/difficulties';

type Props = {
  difficulties: readonly Difficulty[];
  selectedId: DifficultyId;
  onChange: (id: DifficultyId) => void;
};

export function DifficultyPicker({ difficulties, selectedId, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Difficulty"
      className="flex flex-wrap justify-center gap-2 rounded-2xl bg-white/5 px-3 py-3"
    >
      {difficulties.map((d) => {
        const selected = d.id === selectedId;
        return (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(d.id)}
            className={
              selected
                ? 'rounded-full border border-rhyme-yellow bg-rhyme-yellow/20 px-4 py-2 text-sm font-bold text-rhyme-yellow'
                : 'rounded-full bg-white/5 px-4 py-2 text-sm text-white/40 hover:bg-white/10'
            }
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}
