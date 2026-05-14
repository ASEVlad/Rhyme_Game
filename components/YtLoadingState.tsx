// components/YtLoadingState.tsx
'use client';

import { useEffect, useState } from 'react';

// Stage indices:
//   0 = URL validated  (always immediately done)
//   1 = Downloading audio  (active 0–12 s)
//   2 = Detecting BPM      (active 12–20 s)
//   3 = Generating title   (active 20 s+)
const STAGES = [
  'URL validated',
  'Downloading audio…',
  'Detecting BPM…',
  'Generating title…',
] as const;

export function getActiveStage(elapsedMs: number): number {
  if (elapsedMs >= 20_000) return 3;
  if (elapsedMs >= 12_000) return 2;
  return 1;
}

export function YtLoadingState({ className }: { className?: string }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - start), 500);
    return () => clearInterval(id);
  }, []);

  const activeStage = getActiveStage(elapsedMs);

  return (
    <div className={className}>
      <style>{`
        @keyframes yt-bar {
          0%, 100% { transform: scaleY(0.25); }
          50%       { transform: scaleY(1); }
        }
        @keyframes yt-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Waveform */}
      <div className="flex items-end justify-center gap-1 mb-4" style={{ height: '32px' }}>
        {[0, 0.15, 0.30, 0.45, 0.60, 0.75, 0.90].map((offset, i) => (
          <div
            key={i}
            className="w-2 rounded-sm bg-rhyme-yellow"
            style={{
              height: '32px',
              transformOrigin: 'bottom',
              animation: `yt-bar 0.8s ease-in-out -${offset}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Stage checklist */}
      <div className="space-y-2">
        {STAGES.map((label, i) => {
          const done = i < activeStage;
          const active = i === activeStage;
          return (
            <div key={i} className="flex items-center gap-3 text-sm">
              {done ? (
                <span className="text-green-400 w-4 text-center leading-none">✓</span>
              ) : active ? (
                <span
                  className="block w-4 h-4 rounded-full border-2 border-white/20 shrink-0"
                  style={{
                    borderTopColor: 'rgb(255,212,71)',
                    animation: 'yt-spin 1s linear infinite',
                  }}
                />
              ) : (
                <span className="text-white/30 w-4 text-center leading-none">○</span>
              )}
              <span className={
                done   ? 'text-white/40' :
                active ? 'text-rhyme-yellow font-medium' :
                         'text-white/30'
              }>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
