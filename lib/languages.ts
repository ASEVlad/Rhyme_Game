import { pickRandomTopics } from './topics';
import type { RhymeScheme } from './rhyme-schemes';

export type LanguageId = 'uk' | 'en' | 'es' | 'de' | 'pl';

export type RhymeExclusion = { words: string[]; endings: string[] };

export type Language = {
  id: LanguageId;
  label: string;
  themes: string[];
  promptTemplate: (
    count: number,
    theme: string,
    exclude?: RhymeExclusion,
    difficultyHint?: string,
    scheme?: RhymeScheme,
  ) => string;
};

const PROMPT_LANG_NAME: Record<LanguageId, string> = {
  uk: 'Ukrainian',
  en: 'English',
  es: 'Spanish',
  de: 'German',
  pl: 'Polish',
};

const PATTERN_PRIMER = [
  'Pattern rules:',
  '- The pattern has 4 characters; each character is the rhyme family for that bar.',
  '- Same letter (A or B) → those bars must rhyme with each other (same stressed vowel and ending).',
  '- "X" → empty slot; return "" for that position in the block.',
  '',
  'Examples:',
  '- Pattern "AABB" → ["sit", "fit", "day", "way"]   (1+2 rhyme; 3+4 rhyme — different family)',
  '- Pattern "AXAX" → ["sit", "", "fit", ""]         (1 and 3 rhyme; 2 and 4 are empty strings)',
].join('\n');

type Level = 'easy' | 'medium' | 'hard';

function levelFromHint(hint?: string): Level {
  if (!hint) return 'medium';
  const h = hint.toLowerCase();
  if (h.includes('child')) return 'easy';
  if (h.includes('teenager')) return 'medium';
  if (h.includes('expressive') || h.includes('sophisticated') || h.includes('rare')) return 'hard';
  return 'medium';
}

const DIFFICULTY_RUBRIC = [
  'Difficulty levels:',
  'Easy:',
  '- Very common vocabulary',
  '- Highly predictable rhyme chains',
  '- Extremely freestyle-friendly',
  '',
  'Medium:',
  '- Modern rap vocabulary',
  '- Moderate unpredictability',
  '- Natural sounding freestyle chains',
  '',
  'Hard:',
  '- Advanced rap vocabulary',
  '- Less predictable rhyme progression',
  '- Challenging but still usable in freestyle',
].join('\n');

function buildRapGamePrompt(
  langName: string,
  count: number,
  exclude: RhymeExclusion | undefined,
  difficultyHint: string | undefined,
  scheme: RhymeScheme | undefined,
): string {
  const topics = pickRandomTopics(10 + Math.floor(Math.random() * 2));
  const level = levelFromHint(difficultyHint);
  const pattern = scheme?.pattern ?? 'AABB';

  const parts: string[] = [
    'You are creating a freestyle rap "rhyme game".',
    '',
    `Generate ${count} 4-bar blocks of end-words for rap bars. Each block follows this rhyme pattern: ${pattern}`,
    '',
    PATTERN_PRIMER,
    '',
    'Rules:',
    '- Within each rhyme family in a block, every word must rhyme naturally (same stressed vowel and ending).',
    `- Use real, common ${langName} words.`,
    '- Avoid awkward, rare, or impossible rhymes.',
    '- Do not cycle on the same ending — use different rhyme families across blocks.',
    '- Words should sound good in rap/freestyle.',
    '- Pay attention to the difficulty level.',
    '- Keep thematic consistency with the requested vibe.',
    '',
    DIFFICULTY_RUBRIC,
    '',
    `Difficulty: ${level}`,
    'Style: modern freestyle rap',
    `Theme: ${topics.join(', ')}`,
    `Language: ${langName}`,
    '',
    `Pattern: ${pattern}`,
    '',
    `Output via the \`rhyme_blocks\` tool. Each block is an array of EXACTLY 4 ${langName} strings; use "" for any X position.`,
  ];
  if (exclude?.words.length) parts.push('', `Do not use these words: ${exclude.words.join(', ')}.`);
  if (exclude?.endings.length) parts.push(`Do not use these endings: ${exclude.endings.join(', ')}.`);
  return parts.join('\n');
}

export const LANGUAGES: readonly Language[] = [
  {
    id: 'uk',
    label: 'Українська',
    themes: [
      'природа', 'місто', 'емоції', 'рух та дія', 'їжа', 'школа та навчання',
      'спорт', 'музика', "сім'я", 'тварини', 'погода', 'подорожі',
    ],
    promptTemplate: (count, _theme, exclude, difficultyHint, scheme) =>
      buildRapGamePrompt(PROMPT_LANG_NAME.uk, count, exclude, difficultyHint, scheme),
  },
  {
    id: 'en',
    label: 'English',
    themes: [
      'nature', 'city life', 'emotions', 'movement', 'food', 'school',
      'sport', 'music', 'family', 'animals', 'weather', 'travel',
    ],
    promptTemplate: (count, _theme, exclude, difficultyHint, scheme) =>
      buildRapGamePrompt(PROMPT_LANG_NAME.en, count, exclude, difficultyHint, scheme),
  },
  {
    id: 'es',
    label: 'Español',
    themes: [
      'naturaleza', 'ciudad', 'emociones', 'movimiento', 'comida', 'escuela',
      'deporte', 'música', 'familia', 'animales', 'tiempo', 'viajes',
    ],
    promptTemplate: (count, _theme, exclude, difficultyHint, scheme) =>
      buildRapGamePrompt(PROMPT_LANG_NAME.es, count, exclude, difficultyHint, scheme),
  },
  {
    id: 'de',
    label: 'Deutsch',
    themes: [
      'Natur', 'Stadt', 'Gefühle', 'Bewegung', 'Essen', 'Schule',
      'Sport', 'Musik', 'Familie', 'Tiere', 'Wetter', 'Reisen',
    ],
    promptTemplate: (count, _theme, exclude, difficultyHint, scheme) =>
      buildRapGamePrompt(PROMPT_LANG_NAME.de, count, exclude, difficultyHint, scheme),
  },
  {
    id: 'pl',
    label: 'Polski',
    themes: [
      'natura', 'miasto', 'emocje', 'ruch', 'jedzenie', 'szkoła',
      'sport', 'muzyka', 'rodzina', 'zwierzęta', 'pogoda', 'podróże',
    ],
    promptTemplate: (count, _theme, exclude, difficultyHint, scheme) =>
      buildRapGamePrompt(PROMPT_LANG_NAME.pl, count, exclude, difficultyHint, scheme),
  },
];

export const DEFAULT_LANGUAGE: LanguageId = 'uk';

const BY_ID: Record<LanguageId, Language> = LANGUAGES.reduce(
  (acc, lang) => {
    acc[lang.id] = lang;
    return acc;
  },
  {} as Record<LanguageId, Language>
);

export function getLanguage(id: string | null | undefined): Language {
  if (id && id in BY_ID) return BY_ID[id as LanguageId];
  return BY_ID[DEFAULT_LANGUAGE];
}
