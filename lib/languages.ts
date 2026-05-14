export type LanguageId = 'uk' | 'en' | 'es' | 'de' | 'pl';

export type Language = {
  id: LanguageId;
  label: string;
  promptTemplate: (count: number) => string;
};

function joinLines(lines: string[]): string {
  return lines.join(' ');
}

export const LANGUAGES: readonly Language[] = [
  {
    id: 'uk',
    label: 'Українська',
    promptTemplate: (count) => joinLines([
      `Згенеруй ${count} груп поширених українських слів, які римуються між собою.`,
      'Кожна група повинна мати спільне закінчення (від наголошеного голосного до кінця слова).',
      'У кожній групі — 3–4 слова. Уникай рідкісних, архаїчних або вульгарних слів.',
      'Перевага — простим іменникам, дієсловам та прикметникам, які впізнає підліток або початківець.',
      'Виведи результат через інструмент rhyme_groups.',
    ]),
  },
  {
    id: 'en',
    label: 'English',
    promptTemplate: (count) => joinLines([
      `Generate ${count} groups of common English words that rhyme.`,
      'Each group must share an ending (from the stressed vowel to the end of the word).',
      '3–4 words per group. Avoid rare, archaic, or vulgar words.',
      'Prefer simple nouns, verbs, and adjectives recognizable to a teenager or beginner.',
      'Return the result via the rhyme_groups tool.',
    ]),
  },
  {
    id: 'es',
    label: 'Español',
    promptTemplate: (count) => joinLines([
      `Genera ${count} grupos de palabras españolas comunes que rimen entre sí.`,
      'Cada grupo debe compartir una terminación (desde la vocal tónica hasta el final de la palabra).',
      '3–4 palabras por grupo. Evita palabras raras, arcaicas o vulgares.',
      'Prefiere sustantivos, verbos y adjetivos simples reconocibles para un adolescente o principiante.',
      'Devuelve el resultado a través de la herramienta rhyme_groups.',
    ]),
  },
  {
    id: 'de',
    label: 'Deutsch',
    promptTemplate: (count) => joinLines([
      `Generiere ${count} Gruppen häufiger deutscher Wörter, die sich reimen.`,
      'Jede Gruppe muss eine gemeinsame Endung haben (vom betonten Vokal bis zum Wortende).',
      '3–4 Wörter pro Gruppe. Vermeide seltene, archaische oder vulgäre Wörter.',
      'Bevorzuge einfache Substantive, Verben und Adjektive, die ein Jugendlicher oder Anfänger erkennt.',
      'Gib das Ergebnis über das Tool rhyme_groups zurück.',
    ]),
  },
  {
    id: 'pl',
    label: 'Polski',
    promptTemplate: (count) => joinLines([
      `Wygeneruj ${count} grup popularnych polskich słów, które się rymują.`,
      'Każda grupa musi mieć wspólne zakończenie (od akcentowanej samogłoski do końca słowa).',
      '3–4 słowa w grupie. Unikaj rzadkich, archaicznych lub wulgarnych słów.',
      'Preferuj proste rzeczowniki, czasowniki i przymiotniki rozpoznawalne dla nastolatka lub początkującego.',
      'Zwróć wynik za pomocą narzędzia rhyme_groups.',
    ]),
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
