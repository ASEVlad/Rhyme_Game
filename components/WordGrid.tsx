'use client';

import type { Bar } from '@/lib/flatten-bars';
import type { RhymeColor } from '@/lib/colors';

const COLOR_BG: Record<RhymeColor, string> = {
  yellow: 'bg-rhyme-yellow text-bg',
  blue:   'bg-rhyme-blue text-white',
  orange: 'bg-rhyme-orange text-white',
  red:    'bg-rhyme-red text-white',
};

type Props = {
  bars: Bar[];
  /** index into bars[] currently being played */
  activeRow: number;
  /** ballX 0..1 — used to highlight the active cell */
  ballX: number;
  /** how many rows to show above and below the active one */
  windowSize?: number;
};

export function WordGrid({ bars, activeRow, ballX, windowSize = 4 }: Props) {
  const start = activeRow - 1;
  const end = activeRow + windowSize;
  const visibleRows: Array<{ index: number; bar: Bar | null }> = [];
  for (let i = start; i <= end; i++) {
    visibleRows.push({ index: i, bar: bars[i] ?? null });
  }
  const activeCol = Math.min(3, Math.floor(ballX * 4));

  return (
    <div className="space-y-2 select-none">
      {visibleRows.map(({ index, bar }) => {
        const isActive = index === activeRow;
        return (
          <div key={index} className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map(col => {
              const isWordCell = col === 3;
              const cellActive = isActive && col === activeCol;
              if (isWordCell && bar) {
                return (
                  <div
                    key={col}
                    className={[
                      'rounded-xl py-4 text-center text-xl font-bold',
                      COLOR_BG[bar.color],
                      isActive ? 'ring-2 ring-white/70' : 'opacity-90',
                    ].join(' ')}
                  >
                    {bar.word}
                  </div>
                );
              }
              return (
                <div
                  key={col}
                  className={[
                    'rounded-xl py-4',
                    cellActive ? 'bg-white/20' : 'bg-white/[0.06]',
                  ].join(' ')}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
