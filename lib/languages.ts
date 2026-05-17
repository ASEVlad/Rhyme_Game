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
        ? `Each group must have exactly ${wordsPerGroup} words.`
        : 'У кожній групі — 3–4 слова.';
      const vocabLine = difficultyHint
        ? `Vocabulary level: ${difficultyHint}.`
        : 'Перевага — простим словам, які впізнає підліток або початківець.';
      const parts = [
        `Тема для натхнення: "${theme}". Це лише поштовх, не клітка.`,
        `Згенеруй ${count} груп українських слів, які римуються в межах кожної групи.`,
        'ФОРМАТ КОЖНОЇ ГРУПИ:',
        '• "ending" — буквальне закінчення, яким завершується КОЖНЕ слово групи. Формат: дефіс + 2–5 літер. Без коментарів, дужок, слешів, альтернатив. Якщо не всі слова групи мають однакове закінчення — розділи на дві групи.',
        '• Кожне слово — ОДНЕ існуюче українське слово у звичній формі. Без пробілів, прийменників, новотворів, латиниці. Якщо сумніваєшся, чи слово існує — не використовуй.',
        '• Усі слова в групі мають справді римуватися (однаковий наголошений голосний і звуки після нього).',
        '• Не повторюй слово в межах групи.',
        'ПРИКЛАД ПРАВИЛЬНОЇ ГРУПИ: { "ending": "-ить", "words": ["летить", "горить", "болить", "кричить"] }.',
        'ПРИКЛАД НЕПРАВИЛЬНОЇ (різні закінчення в одній групі): { "ending": "-ають", "words": ["співають", "гуляють", "гризуть", "кричать"] } — так не роби.',
        'ВНУТРІШНЯ РІЗНОМАНІТНІСТЬ ГРУПИ (КРИТИЧНО):',
        '• За замовчуванням слова в групі мають той самий звук — і часто виходять однієї частини мови та однієї довжини. Це нудно для римера.',
        `• ОБОВʼЯЗКОВО серед ${count} груп:`,
        '  — щонайменше 2 групи мають МІКС ЧАСТИН МОВИ всередині (наприклад прикметник + іменник, або прислівник + іменник в одній групі). Підбери закінчення, яке природно дозволяє різні частини мови.',
        '  — щонайменше 2 групи мають МІКС ДОВЖИНИ слів (короткі 1–2 склади поряд з довшими 3–4 складами в одній групі).',
        '  — добре, якщо ці вимоги поєднуються (одна група має і POS-мікс, і мікс довжин).',
        '• Якщо закінчення фізично допускає лише одну частину мови (наприклад "-ують" — тільки дієслова) або однакову довжину — моно-група це ок. Але серед закінчень знайди такі, що дозволяють мікс, і використай їх.',
        'ЛЕКСИЧНА РІЗНОМАНІТНІСТЬ МІЖ ГРУПАМИ:',
        '• Кожна група має походити з різного семантичного гнізда. Не створюй кілька груп навколо одного і того самого кореня.',
        '• ЗАБОРОНЕНО: одна група з "магічна, музична", інша з "магічний, музичний", третя з "магічно, музично". Це той самий лексикон у різних формах — для римера це повтор.',
        '• Якщо для нового закінчення тобі спадають на думку лише форми слів з інших груп — обери інше закінчення.',
        '• Жодне слово не повторюється у двох групах.',
        `РІЗНОМАНІТТЯ ЗА ЧАСТИНАМИ МОВИ НА РІВНІ ${count} ЗАКІНЧЕНЬ — набір має включати:`,
        '• щонайменше 2 прикметникові закінчення (наприклад -ий, -на, -ого, -ій, -ний, -іший),',
        '• щонайменше 1 прислівникове (наприклад -о, -е: тихо, легко, разом, потім, навіки),',
        '• щонайменше 1 дієслівне в особовій формі (-ить, -ать, -ять, -ують, -ємо),',
        "• щонайменше 1 'якірне' — таке, де живуть конкретні образи для історії (людина, час доби, частина тіла, погода, місце).",
        'СЕМАНТИКА: тема — натхнення для приблизно 30–40% груп. Інші мають вести римера в інші напрямки (різні образи, дії, відчуття, побут). Не зациклюйся на одному семантичному полі.',
        groupSizeLine,
        vocabLine,
        'Уникай рідкісних, архаїчних або вульгарних слів.',
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
