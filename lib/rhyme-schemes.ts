export type RhymeSchemeId = 'free' | 'couplets' | 'bar4' | 'alternating';

export type RhymeScheme = {
  id: RhymeSchemeId;
  label: string;
  wordsPerGroup: number | null;
  groupCount: number;
  interleave: boolean;
};

export const RHYME_SCHEMES: readonly RhymeScheme[] = [
  { id: 'free',        label: 'Free',        wordsPerGroup: null, groupCount: 10, interleave: false },
  { id: 'couplets',    label: 'Couplets',    wordsPerGroup: 2,    groupCount: 16, interleave: false },
  { id: 'bar4',        label: '4-bar',       wordsPerGroup: 4,    groupCount: 8,  interleave: false },
  { id: 'alternating', label: 'Alternating', wordsPerGroup: 2,    groupCount: 16, interleave: true  },
];

export const DEFAULT_SCHEME: RhymeSchemeId = 'free';

const BY_ID = RHYME_SCHEMES.reduce(
  (acc, s) => { acc[s.id] = s; return acc; },
  {} as Record<RhymeSchemeId, RhymeScheme>
);

export function getRhymeScheme(id: string | null | undefined): RhymeScheme {
  if (id && id in BY_ID) return BY_ID[id as RhymeSchemeId];
  return BY_ID[DEFAULT_SCHEME];
}
