'use client';

import type { Language, LanguageId } from '@/lib/languages';

type Props = {
  languages: readonly Language[];
  selectedId: LanguageId;
  onChange: (id: LanguageId) => void;
};

export function LanguagePicker({ languages, selectedId, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Rhyme language"
      className="flex flex-wrap justify-center gap-2 rounded-2xl bg-white/5 px-3 py-3"
    >
      {languages.map((lang) => {
        const selected = lang.id === selectedId;
        return (
          <button
            key={lang.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(lang.id)}
            className={
              selected
                ? 'rounded-full bg-rhyme-yellow px-4 py-2 text-sm font-bold text-bg'
                : 'rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/20'
            }
          >
            {lang.label}
          </button>
        );
      })}
    </div>
  );
}
