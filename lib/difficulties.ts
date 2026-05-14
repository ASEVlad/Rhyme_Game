export type DifficultyId = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type Difficulty = {
  id: DifficultyId;
  label: string;
  promptHint: string;
};

export const DIFFICULTIES: readonly Difficulty[] = [
  { id: 'beginner',     label: 'Beginner',     promptHint: 'very common words a young child would know' },
  { id: 'intermediate', label: 'Intermediate', promptHint: 'common words a teenager would recognize' },
  { id: 'advanced',     label: 'Advanced',     promptHint: 'expressive, less common vocabulary' },
  { id: 'expert',       label: 'Expert',       promptHint: 'rare, abstract, or sophisticated vocabulary' },
];

export const DEFAULT_DIFFICULTY: DifficultyId = 'beginner';

const BY_ID = DIFFICULTIES.reduce(
  (acc, d) => { acc[d.id] = d; return acc; },
  {} as Record<DifficultyId, Difficulty>
);

export function getDifficulty(id: string | null | undefined): Difficulty {
  if (id && id in BY_ID) return BY_ID[id as DifficultyId];
  return BY_ID[DEFAULT_DIFFICULTY];
}
