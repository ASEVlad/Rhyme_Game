'use client';

export function computeBounceY(x: number): number {
  const cellPhase = (x * 4) % 1;
  return Math.sin(cellPhase * Math.PI);
}

const BOUNCE_PX = 26;

type Props = {
  /** 0..1 across the row width */
  x: number;
};

export function BouncingBall({ x }: Props) {
  const yBounce = computeBounceY(x);
  return (
    <div className="relative h-10 w-full">
      <div
        className="absolute h-3.5 w-3.5 rounded-full"
        style={{
          left: `${x * 100}%`,
          top: `${yBounce * BOUNCE_PX}px`,
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #5ec8ff, #2860e0)',
          boxShadow: '0 0 14px rgba(94,200,255,0.9), 0 0 28px rgba(94,200,255,0.35)',
        }}
      />
    </div>
  );
}
