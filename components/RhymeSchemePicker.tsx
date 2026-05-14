'use client';

import type { RhymeScheme, RhymeSchemeId } from '@/lib/rhyme-schemes';

type Props = {
  schemes: readonly RhymeScheme[];
  selectedId: RhymeSchemeId;
  onChange: (id: RhymeSchemeId) => void;
};

export function RhymeSchemePicker({ schemes, selectedId, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Rhyme scheme"
      className="flex flex-wrap justify-center gap-2 rounded-2xl bg-white/5 px-3 py-3"
    >
      {schemes.map((s) => {
        const selected = s.id === selectedId;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(s.id)}
            className={
              selected
                ? 'rounded-full border border-rhyme-yellow bg-rhyme-yellow/20 px-4 py-2 text-sm font-bold text-rhyme-yellow'
                : 'rounded-full bg-white/5 px-4 py-2 text-sm text-white/40 hover:bg-white/10'
            }
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
