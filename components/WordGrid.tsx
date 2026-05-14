'use client';

import type { Bar } from '@/lib/flatten-bars';
import type { RhymeColor } from '@/lib/colors';

const COLOR_BG: Record<RhymeColor, string> = {
  yellow: 'bg-rhyme-yellow text-bg',
  blue:   'bg-rhyme-blue text-white',
  orange: 'bg-rhyme-orange text-white',
  red:    'bg-rhyme-red text-white',
};

const COLOR_SHADOW: Record<RhymeColor, string> = {
  yellow: '0 0 16px rgba(255,212,71,0.5)',
  blue:   '0 0 16px rgba(58,163,255,0.6)',
  orange: '0 0 16px rgba(255,138,60,0.5)',
  red:    '0 0 16px rgba(228,77,77,0.5)',
};

type Props = {
  bars: Bar[];
  /** index into bars[] currently being played */
  activeRow: number;
  /** ballX 0..1 — used to highlight the active cell */
  ballX: number;
  /** how many rows to show above and below the active one */
  windowSize?: number;
  /** hide rhyme words for the first N bars so the player can feel the beat first */
  introRows?: number;
};

export function WordGrid({ bars, activeRow, ballX, windowSize = 4, introRows = 2 }: Props) {
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
        const isPast   = index < activeRow;
        const opacity  = isActive ? 1 : isPast ? 0.07 : 0.28;

        const rowContent = (
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map(col => {
              const isWordCell  = col === 3;
              const cellActive  = isActive && col === activeCol;

              if (isWordCell && bar && index >= introRows) {
                const isActiveWord = isActive;
                return (
                  <div
                    key={col}
                    className={[
                      'rounded-2xl py-5 text-center text-xl font-black',
                      COLOR_BG[bar.color],
                      isActiveWord ? 'ring-2 ring-white/80' : '',
                    ].join(' ')}
                    style={isActiveWord ? { boxShadow: COLOR_SHADOW[bar.color] } : undefined}
                  >
                    {bar.word}
                  </div>
                );
              }

              return (
                <div
                  key={col}
                  className={[
                    'rounded-2xl py-5',
                    cellActive
                      ? 'bg-white/20 border border-white/40'
                      : 'bg-white/[0.06]',
                  ].join(' ')}
                />
              );
            })}
          </div>
        );

        if (isActive) {
          return (
            <div
              key={index}
              style={{ opacity, position: 'relative' }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: '-8px -10px',
                  borderRadius: '18px',
                  background: 'radial-gradient(ellipse at 50% 50%, rgba(255,200,50,0.12) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }}
              />
              {rowContent}
            </div>
          );
        }

        return (
          <div
            key={index}
            style={{
              opacity,
              transition: isPast ? 'opacity 300ms ease' : undefined,
            }}
          >
            {rowContent}
          </div>
        );
      })}
    </div>
  );
}
