'use client';

import { motion } from 'framer-motion';
import type { Language, LanguageId } from '@/lib/languages';

type Props = {
  languages: readonly Language[];
  selectedId: LanguageId;
  onChange: (id: LanguageId) => void;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
};

const DEFAULT_ACTIVE   = 'rounded-full bg-rhyme-yellow px-4 py-2 text-sm font-bold text-bg';
const DEFAULT_INACTIVE = 'rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/20';
const DEFAULT_CONTAINER = 'flex flex-wrap justify-center gap-2 rounded-2xl bg-white/5 px-3 py-3';

export function LanguagePicker({
  languages,
  selectedId,
  onChange,
  className,
  activeClassName,
  inactiveClassName,
}: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Rhyme language"
      className={className ?? DEFAULT_CONTAINER}
    >
      {languages.map((lang) => {
        const selected = lang.id === selectedId;
        return (
          <motion.button
            key={lang.id}
            type="button"
            role="radio"
            aria-checked={selected}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.08 }}
            onClick={() => onChange(lang.id)}
            className={selected ? (activeClassName ?? DEFAULT_ACTIVE) : (inactiveClassName ?? DEFAULT_INACTIVE)}
          >
            {lang.label}
          </motion.button>
        );
      })}
    </div>
  );
}
