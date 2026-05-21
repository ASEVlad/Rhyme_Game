export type FillPlanInput = {
  duration: number;          // seconds
  bpm: number;
  startOffset: number;       // seconds before beat 1
};

export type FillPlan = {
  targetBars: number;
  /** Number of 4-bar blocks to request from /api/rhymes. */
  count: number;
};

const MIN_BLOCKS = 4;
const MAX_BLOCKS = 50;
const BARS_PER_BLOCK = 4;
const MAX_RHYME_SECONDS = 180;

export function computeRhymeFillPlan(input: FillPlanInput): FillPlan {
  const playable = Math.max(0, input.duration - input.startOffset);
  const covered = Math.min(playable, MAX_RHYME_SECONDS);
  const targetBars = Math.floor((covered * input.bpm) / 240);
  const rawCount = Math.ceil(targetBars / BARS_PER_BLOCK);
  const count = Math.max(MIN_BLOCKS, Math.min(MAX_BLOCKS, rawCount));
  return { targetBars, count };
}
