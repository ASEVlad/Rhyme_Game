'use client';

import type { RhymeScheme, RhymeSchemeId } from '@/lib/rhyme-schemes';

type Props = {
  schemes: readonly RhymeScheme[];
  selectedId: RhymeSchemeId;
  onChange: (id: RhymeSchemeId) => void;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
};

const DEFAULT_ACTIVE   = 'rounded-full border border-rhyme-yellow bg-rhyme-yellow/20 px-4 py-2 text-sm font-bold text-rhyme-yellow';
const DEFAULT_INACTIVE = 'rounded-full bg-white/5 px-4 py-2 text-sm text-white/40 hover:bg-white/10';
const DEFAULT_CONTAINER = 'flex flex-wrap justify-center gap-2 rounded-2xl bg-white/5 px-3 py-3';

export function RhymeSchemePicker({
  schemes,
  selectedId,
  onChange,
  className,
  activeClassName,
  inactiveClassName,
}: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Rhyme scheme"
      className={className ?? DEFAULT_CONTAINER}
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
            className={selected ? (activeClassName ?? DEFAULT_ACTIVE) : (inactiveClassName ?? DEFAULT_INACTIVE)}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
