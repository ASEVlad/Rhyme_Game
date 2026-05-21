'use client';

import type { Bar } from '@/lib/flatten-bars';
import type { RhymeColor } from '@/lib/colors';
import { BouncingBall, computeBounceY } from './BouncingBall';

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

export function rowOpacity(index: number, activeRow: number, windowSize: number): number {
  if (index === activeRow) return 1;
  if (index === activeRow - 1) return 0.07;
  if (index < activeRow - 1 || index > activeRow + windowSize) return 0;
  return 0.28;
}

type Props = {
  bars: Bar[];
  /** index into bars[] currently being played */
  activeRow: number;
  /** ballX 0..1 — used to highlight the active cell */
  ballX: number;
  /** upcoming rows visible below the active row; two invisible buffer rows always render above and below (default 4) */
  windowSize?: number;
  /** hide rhyme words for the first N bars so the player can feel the beat first */
  introRows?: number;
};

export function WordGrid({ bars, activeRow, ballX, windowSize = 4, introRows = 2 }: Props) {
  const start = activeRow - 2;
  const end = activeRow + windowSize + 1;
  const visibleRows: Array<{ index: number; bar: Bar | null }> = [];
  for (let i = start; i <= end; i++) {
    visibleRows.push({ index: i, bar: bars[i] ?? null });
  }
  const activeCol = Math.min(3, Math.floor(ballX * 4));
  const yBounce = computeBounceY(ballX);

  return (
    <div className="space-y-2 select-none">
      {visibleRows.map(({ index, bar }) => {
        const isActive = index === activeRow;
        const opacity  = rowOpacity(index, activeRow, windowSize);

        const rowContent = (
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map(col => {
              const isWordCell  = col === 3;
              const cellActive  = isActive && col === activeCol;

              if (isWordCell && bar && bar.word && index >= introRows) {
                return (
                  <div
                    key={col}
                    className={[
                      'rounded-2xl py-5 lg:py-8 text-center text-xl lg:text-3xl font-black',
                      COLOR_BG[bar.color],
                      isActive ? 'ring-2 ring-white/80' : '',
                    ].join(' ')}
                    style={isActive ? { boxShadow: COLOR_SHADOW[bar.color] } : undefined}
                  >
                    {bar.word}
                  </div>
                );
              }

              return (
                <div
                  key={col}
                  className="rounded-2xl py-5 lg:py-8"
                  style={
                    cellActive
                      ? {
                          backgroundColor: `rgba(94,200,255,${0.06 + 0.34 * yBounce})`,
                          boxShadow: `inset 0 0 0 1px rgba(94,200,255,${0.4 * yBounce})`,
                        }
                      : { backgroundColor: 'rgba(94,200,255,0.06)' }
                  }
                />
              );
            })}
          </div>
        );

        if (isActive) {
          return (
            <div
              key={index}
              style={{ opacity, position: 'relative', transition: 'opacity 600ms ease' }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: '-8px -10px',
                  borderRadius: '18px',
                  background: 'radial-gradient(ellipse at 50% 50%, rgba(94,200,255,0.10) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }}
              />
              {rowContent}
              <BouncingBall x={ballX} />
            </div>
          );
        }

        return (
          <div
            key={index}
            style={{ opacity, transition: 'opacity 600ms ease' }}
          >
            {rowContent}
          </div>
        );
      })}
    </div>
  );
}
