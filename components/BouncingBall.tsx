'use client';

type Props = {
  /** 0..1 across the row width */
  x: number;
};

export function BouncingBall({ x }: Props) {
  return (
    <div className="relative h-5 w-full">
      <div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full"
        style={{
          left: `${x * 100}%`,
          background: 'radial-gradient(circle at 35% 35%, #fff9e6, #ffc929)',
          boxShadow: '0 0 14px rgba(255,200,50,0.9), 0 0 28px rgba(255,200,50,0.35)',
        }}
      />
    </div>
  );
}
