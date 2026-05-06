'use client';

type Props = {
  /** 0..1 across the row */
  x: number;
  /** 0..1, dip amount; we render lower when ballYDip is high */
  yDip: number;
};

export function BouncingBall({ x, yDip }: Props) {
  const left = `${x * 100}%`;
  const dipPx = (1 - yDip) * 28; // up to 28px lift on the beat
  return (
    <div className="relative h-16 w-full">
      <div
        className="absolute h-7 w-7 rounded-full bg-ball shadow-[0_0_24px_rgba(255,157,42,0.6)] -translate-x-1/2"
        style={{ left, bottom: `${dipPx}px`, transition: 'background 120ms' }}
      />
    </div>
  );
}
