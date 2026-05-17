export type FillPlanInput = {
  duration: number;          // seconds
  bpm: number;
  startOffset: number;       // seconds before beat 1
  wordsPerGroup: number | null; // scheme.wordsPerGroup; null = free (variable)
};

export type FillPlan = {
  targetBars: number;
  count: number; // groups to request from /api/rhymes
};

const MIN_GROUPS = 4;
const MAX_GROUPS = 40;
const FREE_MIN_WORDS_PER_GROUP = 2;
const MAX_RHYME_SECONDS = 90;

export function computeRhymeFillPlan(input: FillPlanInput): FillPlan {
  const playable = Math.max(0, input.duration - input.startOffset);
  const covered = Math.min(playable, MAX_RHYME_SECONDS);
  const targetBars = Math.floor((covered * input.bpm) / 240);
  const minWords = input.wordsPerGroup ?? FREE_MIN_WORDS_PER_GROUP;
  const rawCount = Math.ceil(targetBars / minWords);
  const count = Math.max(MIN_GROUPS, Math.min(MAX_GROUPS, rawCount));
  return { targetBars, count };
}
