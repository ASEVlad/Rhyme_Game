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
    wordsPerGroup?: number | null,
  ) => string;
};

function joinLines(lines: string[]): string {
  return lines.join(' ');
}

export const LANGUAGES: readonly Language[] = [
  {
    id: 'uk',
    label: 'Українська',
    themes: [
      'природа', 'місто', 'емоції', 'рух та дія', 'їжа', 'школа та навчання',
      'спорт', 'музика', "сім'я", 'тварини', 'погода', 'подорожі',
    ],
    promptTemplate: (count, theme, exclude, difficultyHint, wordsPerGroup) => {
      const groupSizeLine = wordsPerGroup != null
        ? `Each group must have exactly ${wordsPerGroup} words. Уникай рідкісних, архаїчних або вульгарних слів.`
        : 'У кожній групі — 3–4 слова. Уникай рідкісних, архаїчних або вульгарних слів.';
      const vocabLine = difficultyHint
        ? `Vocabulary level: ${difficultyHint}.`
        : 'Перевага — простим іменникам, дієсловам та прикметникам, які впізнає підліток або початківець.';
      const parts = [
        `Тема: "${theme}".`,
        `Згенеруй ${count} груп поширених українських слів, пов'язаних із темою "${theme}", які римуються між собою.`,
        'Кожна група повинна мати спільне закінчення (від наголошеного голосного до кінця слова).',
        groupSizeLine,
        vocabLine,
      ];
      if (exclude?.words.length) parts.push(`Не використовуй ці слова: ${exclude.words.join(', ')}.`);
      if (exclude?.endings.length) parts.push(`Не використовуй ці закінчення: ${exclude.endings.join(', ')}.`);
      parts.push('Виведи результат через інструмент rhyme_groups.');
      return joinLines(parts);
    },
  },
  {
    id: 'en',
    label: 'English',
    themes: [
      'nature', 'city life', 'emotions', 'movement', 'food', 'school',
      'sport', 'music', 'family', 'animals', 'weather', 'travel',
    ],
    promptTemplate: (count, theme, exclude, difficultyHint, wordsPerGroup) => {
      const groupSizeLine = wordsPerGroup != null
        ? `Each group must have exactly ${wordsPerGroup} words. Avoid rare, archaic, or vulgar words.`
        : '3–4 words per group. Avoid rare, archaic, or vulgar words.';
      const vocabLine = difficultyHint
        ? `Vocabulary level: ${difficultyHint}.`
        : 'Prefer simple nouns, verbs, and adjectives recognizable to a teenager or beginner.';
      const parts = [
        `Theme: "${theme}".`,
        `Generate ${count} groups of common English words related to "${theme}" that rhyme.`,
        'Each group must share an ending (from the stressed vowel to the end of the word).',
        groupSizeLine,
        vocabLine,
      ];
      if (exclude?.words.length) parts.push(`Do not use these words: ${exclude.words.join(', ')}.`);
      if (exclude?.endings.length) parts.push(`Do not use these endings: ${exclude.endings.join(', ')}.`);
      parts.push('Return the result via the rhyme_groups tool.');
      return joinLines(parts);
    },
  },
  {
    id: 'es',
    label: 'Español',
    themes: [
      'naturaleza', 'ciudad', 'emociones', 'movimiento', 'comida', 'escuela',
      'deporte', 'música', 'familia', 'animales', 'tiempo', 'viajes',
    ],
    promptTemplate: (count, theme, exclude, difficultyHint, wordsPerGroup) => {
      const groupSizeLine = wordsPerGroup != null
        ? `Each group must have exactly ${wordsPerGroup} words. Evita palabras raras, arcaicas o vulgares.`
        : '3–4 palabras por grupo. Evita palabras raras, arcaicas o vulgares.';
      const vocabLine = difficultyHint
        ? `Vocabulary level: ${difficultyHint}.`
        : 'Prefiere sustantivos, verbos y adjetivos simples reconocibles para un adolescente o principiante.';
      const parts = [
        `Tema: "${theme}".`,
        `Genera ${count} grupos de palabras españolas comunes relacionadas con "${theme}" que rimen entre sí.`,
        'Cada grupo debe compartir una terminación (desde la vocal tónica hasta el final de la palabra).',
        groupSizeLine,
        vocabLine,
      ];
      if (exclude?.words.length) parts.push(`No uses estas palabras: ${exclude.words.join(', ')}.`);
      if (exclude?.endings.length) parts.push(`No uses estas terminaciones: ${exclude.endings.join(', ')}.`);
      parts.push('Devuelve el resultado a través de la herramienta rhyme_groups.');
      return joinLines(parts);
    },
  },
  {
    id: 'de',
    label: 'Deutsch',
    themes: [
      'Natur', 'Stadt', 'Gefühle', 'Bewegung', 'Essen', 'Schule',
      'Sport', 'Musik', 'Familie', 'Tiere', 'Wetter', 'Reisen',
    ],
    promptTemplate: (count, theme, exclude, difficultyHint, wordsPerGroup) => {
      const groupSizeLine = wordsPerGroup != null
        ? `Each group must have exactly ${wordsPerGroup} words. Vermeide seltene, archaische oder vulgäre Wörter.`
        : '3–4 Wörter pro Gruppe. Vermeide seltene, archaische oder vulgäre Wörter.';
      const vocabLine = difficultyHint
        ? `Vocabulary level: ${difficultyHint}.`
        : 'Bevorzuge einfache Substantive, Verben und Adjektive, die ein Jugendlicher oder Anfänger erkennt.';
      const parts = [
        `Thema: "${theme}".`,
        `Generiere ${count} Gruppen häufiger deutscher Wörter zum Thema "${theme}", die sich reimen.`,
        'Jede Gruppe muss eine gemeinsame Endung haben (vom betonten Vokal bis zum Wortende).',
        groupSizeLine,
        vocabLine,
      ];
      if (exclude?.words.length) parts.push(`Verwende diese Wörter nicht: ${exclude.words.join(', ')}.`);
      if (exclude?.endings.length) parts.push(`Verwende diese Endungen nicht: ${exclude.endings.join(', ')}.`);
      parts.push('Gib das Ergebnis über das Tool rhyme_groups zurück.');
      return joinLines(parts);
    },
  },
  {
    id: 'pl',
    label: 'Polski',
    themes: [
      'natura', 'miasto', 'emocje', 'ruch', 'jedzenie', 'szkoła',
      'sport', 'muzyka', 'rodzina', 'zwierzęta', 'pogoda', 'podróże',
    ],
    promptTemplate: (count, theme, exclude, difficultyHint, wordsPerGroup) => {
      const groupSizeLine = wordsPerGroup != null
        ? `Each group must have exactly ${wordsPerGroup} words. Unikaj rzadkich, archaicznych lub wulgarnych słów.`
        : '3–4 słowa w grupie. Unikaj rzadkich, archaicznych lub wulgarnych słów.';
      const vocabLine = difficultyHint
        ? `Vocabulary level: ${difficultyHint}.`
        : 'Preferuj proste rzeczowniki, czasowniki i przymiotniki rozpoznawalne dla nastolatka lub początkującego.';
      const parts = [
        `Temat: "${theme}".`,
        `Wygeneruj ${count} grup popularnych polskich słów związanych z tematem "${theme}", które się rymują.`,
        'Każda grupa musi mieć wspólne zakończenie (od akcentowanej samogłoski do końca słowa).',
        groupSizeLine,
        vocabLine,
      ];
      if (exclude?.words.length) parts.push(`Nie używaj tych słów: ${exclude.words.join(', ')}.`);
      if (exclude?.endings.length) parts.push(`Nie używaj tych zakończeń: ${exclude.endings.join(', ')}.`);
      parts.push('Zwróć wynik za pomocą narzędzia rhyme_groups.');
      return joinLines(parts);
    },
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
