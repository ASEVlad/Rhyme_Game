export type BeatCategory =
  | 'boom-bap'
  | 'trap'
  | 'jazz'
  | 'lo-fi'
  | 'drill'
  | 'other';

export type Beat = {
  id: string;
  src: string;
  title: string;
  bpm: number;
  barsPerLoop: number;
  startOffset?: number;  // seconds before beat 1; omit or 0 = file starts on beat 1
  category: BeatCategory;
};

export const BEATS: Beat[] = [
  {
    id: 'click-90',
    src: '/beats/click-90.wav',
    title: 'Click 90',
    bpm: 90,
    barsPerLoop: 8,
    category: 'other',
  },
];

export function pickBeat(id: string | undefined): Beat | undefined {
  if (!id) return BEATS[0];
  return BEATS.find((b) => b.id === id);
}
