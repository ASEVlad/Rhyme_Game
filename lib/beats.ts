export type Beat = {
  id: string;
  src: string; // path under /public, e.g. /beats/calm-bap.mp3
  title: string;
  bpm: number; // derived from real file duration, see spec
  barsPerLoop: number; // 8 or 16 typically
};

export const BEATS: Beat[] = [
  {
    id: 'click-90',
    src: '/beats/click-90.wav',
    title: 'Click 90',
    bpm: 90,
    barsPerLoop: 8,
  },
];

export function pickBeat(id: string | undefined): Beat | undefined {
  if (!id) return BEATS[0];
  return BEATS.find((b) => b.id === id) ?? BEATS[0];
}
