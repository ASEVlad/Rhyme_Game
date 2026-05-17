'use client';

export function computeBounceY(x: number): number {
  const cellPhase = (x * 4) % 1;
  const t = 1 - Math.abs(2 * cellPhase - 1); // triangle wave: 0 → 1 → 0
  return t * t;                              // squared: slow at apex, fast at impact
}

const BALL_SIZE_PX = 14;       // matches w-3.5 h-3.5
const BALL_HALF = BALL_SIZE_PX / 2;
const APEX_PX = 36;             // how high the ball arcs above the tile top

type Props = {
  /** 0..1 across the row width. */
  x: number;
};

/**
 * Renders inside the active row container (which must be `position: relative`).
 * The ball's center lands on the row's top edge on each beat (so its lower
 * half visually presses into the tile for the impact feel), and arcs up to
 * `APEX_PX` above the row between beats. The arc is gravity-shaped: the ball
 * lingers near the apex and snaps down onto each tile.
 */
export function BouncingBall({ x }: Props) {
  const yBounce = computeBounceY(x);
  const top = -APEX_PX + yBounce * (APEX_PX - BALL_HALF);
  const isLanding = yBounce > 0.92;
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${x * 100}%`,
        top: `${top}px`,
        width: `${BALL_SIZE_PX}px`,
        height: `${BALL_SIZE_PX}px`,
        transform: `translateX(-50%) ${isLanding ? 'scale(1.15, 0.85)' : 'scale(1, 1)'}`,
        transition: 'transform 60ms ease-out',
        zIndex: 5,
      }}
    >
      <div
        className="h-full w-full rounded-full"
        style={{
          background: 'linear-gradient(135deg, #5ec8ff, #2860e0)',
          boxShadow: '0 0 14px rgba(94,200,255,0.9), 0 0 28px rgba(94,200,255,0.35)',
        }}
      />
    </div>
  );
}
