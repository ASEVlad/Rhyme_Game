// lib/recent-beats.ts
// Client-only. Stores recently-played beat IDs in localStorage.
const KEY = 'rhyme.recentBeats';
const CAP = 5;

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadRecentBeats(): string[] {
  const s = getStorage();
  if (!s) return [];
  let raw: string | null;
  try {
    raw = s.getItem(KEY);
  } catch {
    return [];
  }
  if (raw == null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('[recent-beats] malformed localStorage value; ignoring');
    return [];
  }
  if (!Array.isArray(parsed)) {
    console.warn('[recent-beats] localStorage value is not an array; ignoring');
    return [];
  }
  return parsed.filter((x): x is string => typeof x === 'string');
}

export function addRecentBeat(id: string): void {
  const s = getStorage();
  if (!s) return;
  try {
    const current = loadRecentBeats().filter(x => x !== id);
    const next = [id, ...current].slice(0, CAP);
    s.setItem(KEY, JSON.stringify(next));
  } catch {
    console.warn('[recent-beats] failed to write recents; ignoring');
  }
}
