export type RhymeSchemeId = 'AABB' | 'ABAB' | 'ABBA' | 'AAAA' | 'AAXX' | 'AXAX' | 'AXXA';

/**
 * A scheme describes a 4-bar block where each character of `pattern` is a
 * rhyme family ('A', 'B') or an empty slot ('X'). Same letter → must rhyme.
 */
export type RhymeScheme = {
  id: RhymeSchemeId;
  label: string;
  pattern: string;
  /** Default number of 4-bar blocks to request per round. */
  blockCount: number;
};

export const RHYME_SCHEMES: readonly RhymeScheme[] = [
  { id: 'AABB', label: 'AABB', pattern: 'AABB', blockCount: 8 },
  { id: 'ABAB', label: 'ABAB', pattern: 'ABAB', blockCount: 8 },
  { id: 'ABBA', label: 'ABBA', pattern: 'ABBA', blockCount: 8 },
  { id: 'AAAA', label: 'AAAA', pattern: 'AAAA', blockCount: 8 },
  { id: 'AAXX', label: 'AAXX', pattern: 'AAXX', blockCount: 8 },
  { id: 'AXAX', label: 'AXAX', pattern: 'AXAX', blockCount: 8 },
  { id: 'AXXA', label: 'AXXA', pattern: 'AXXA', blockCount: 8 },
];

export const DEFAULT_SCHEME: RhymeSchemeId = 'AABB';

const BY_ID = RHYME_SCHEMES.reduce(
  (acc, s) => { acc[s.id] = s; return acc; },
  {} as Record<RhymeSchemeId, RhymeScheme>
);

export function getRhymeScheme(id: string | null | undefined): RhymeScheme {
  if (id && id in BY_ID) return BY_ID[id as RhymeSchemeId];
  return BY_ID[DEFAULT_SCHEME];
}

/** Number of non-X slots in the pattern (e.g. AAAA=4, AAXX=2). */
export function nonEmptySlotsPerBlock(scheme: RhymeScheme): number {
  let n = 0;
  for (const ch of scheme.pattern) if (ch !== 'X') n++;
  return n;
}

/** Distinct rhyme families in the pattern (e.g. AABB has {A,B}, AXAX has {A}). */
export function rhymeFamiliesInScheme(scheme: RhymeScheme): string[] {
  const families = new Set<string>();
  for (const ch of scheme.pattern) if (ch !== 'X') families.add(ch);
  return [...families].sort();
}
