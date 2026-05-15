'use client';

import type { Difficulty, DifficultyId } from '@/lib/difficulties';

type Props = {
  difficulties: readonly Difficulty[];
  selectedId: DifficultyId;
  onChange: (id: DifficultyId) => void;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
};

const DEFAULT_ACTIVE   = 'rounded-full border border-rhyme-yellow bg-rhyme-yellow/20 px-4 py-2 text-sm font-bold text-rhyme-yellow';
const DEFAULT_INACTIVE = 'rounded-full bg-white/5 px-4 py-2 text-sm text-white/40 hover:bg-white/10';
const DEFAULT_CONTAINER = 'flex flex-wrap justify-center gap-2 rounded-2xl bg-white/5 px-3 py-3';

export function DifficultyPicker({
  difficulties,
  selectedId,
  onChange,
  className,
  activeClassName,
  inactiveClassName,
}: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Difficulty"
      className={className ?? DEFAULT_CONTAINER}
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
            className={selected ? (activeClassName ?? DEFAULT_ACTIVE) : (inactiveClassName ?? DEFAULT_INACTIVE)}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}
