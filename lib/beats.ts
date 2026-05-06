export type Beat = {
  id: string;
  src: string; // path under /public, e.g. /beats/calm-bap.mp3
  title: string;
  bpm: number; // derived from real file duration, see spec
  barsPerLoop: number; // 8 or 16 typically
};

export const BEATS: Beat[] = [
  // No bundled beats yet. Drop MP3 files into public/beats/ and add entries here.
];

export function pickBeat(id: string | undefined): Beat | undefined {
  if (!id) return BEATS[0];
  return BEATS.find((b) => b.id === id) ?? BEATS[0];
}
