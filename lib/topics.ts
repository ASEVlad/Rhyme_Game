export const TOPICS: readonly string[] = [
  // inner life / mental health
  'ambition', 'growth', 'self-doubt', 'imposter syndrome', 'burnout',
  'anxiety', 'healing', 'therapy', 'self-worth', 'confidence',
  'boundaries', 'mental health', 'jealousy', 'regret', 'nostalgia',
  'memory', 'fear', 'courage', 'identity', 'faith',
  'peace', 'loneliness', 'solitude', 'anger', 'dreams',
  'freedom',
  // love / dating
  'first love', 'heartbreak', 'situationship', 'ghosting', 'dating apps',
  'exes', 'red flags', 'toxic love', 'unrequited love', 'crushes',
  'long distance',
  // social bonds
  'friendship', 'betrayal', 'loyalty', 'real ones', 'fakes',
  'enemies', 'mentor',
  // family / roots
  'family', 'mother', 'father', 'siblings', 'childhood',
  'growing up', 'hometown', 'immigration', 'relocation', 'roots',
  'language', 'tradition', 'culture',
  // work / money
  'hustle', 'grind', 'side hustle', 'freelance', 'remote work',
  'corporate life', 'quiet quitting', 'money', 'broke', 'rent',
  'inflation', 'success', 'failure', 'fame',
  // digital life
  'social media', 'doomscrolling', 'algorithm', 'going viral', 'group chats',
  'notifications', 'AI',
  // nightlife / weekend
  'nightlife', 'party', 'dance floor', 'club', 'hangover',
  'friday night', 'weekend', 'midnight', 'dawn',
  // routine / aesthetic
  'coffee', 'gym', 'running', 'street life', 'city lights',
  'neon', 'fashion', 'style', 'cars', 'road trip',
  'travel', 'summer', 'fire',
];

export function pickRandomTopics(n: number = 5): string[] {
  const k = Math.max(0, Math.min(n, TOPICS.length));
  if (k === 0) return [];
  const pool = [...TOPICS];
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, k);
}
