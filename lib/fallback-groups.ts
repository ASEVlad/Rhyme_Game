import type { LanguageId } from './languages';
import type { RhymeScheme } from './rhyme-schemes';

/** Internal fallback data shape — each entry is a pool of words that rhyme. */
export type RhymeGroup = { ending: string; words: string[] };

/** A 4-bar block. `words[i]` is '' for an X slot in the scheme pattern. */
export type RhymeBlock = { words: string[] };

export const FALLBACK_GROUPS_BY_LANGUAGE: Record<LanguageId, RhymeGroup[]> = {
  uk: [
    { ending: '-іт',   words: ['кіт', 'щит', 'піт', 'цвіт'] },
    { ending: '-ата',  words: ['хата', 'лата', 'вата', 'плата'] },
    { ending: '-ить',  words: ['летить', 'горить', 'болить', 'кричить'] },
    { ending: '-ова',  words: ['нова', 'голова', 'основа', 'розмова'] },
    { ending: '-ина',  words: ['калина', 'малина', 'людина', 'хвилина'] },
    { ending: '-ого',  words: ['нового', 'білого', 'чужого', 'малого'] },
    { ending: '-ало',  words: ['мало', 'стало', 'сказало', 'пропало'] },
    { ending: '-ення', words: ['рішення', 'значення', 'натхнення', 'зіткнення'] },
    { ending: '-уть',  words: ['ідуть', 'несуть', 'кують', 'пасуть'] },
    { ending: '-іти',  words: ['летіти', 'горіти', 'жаліти', 'хотіти'] },
    { ending: '-ість', words: ['радість', 'свіжість', 'юність', 'ніжність'] },
    { ending: '-іра',  words: ['віра', 'міра', 'ліра', 'жара'] },
  ],
  en: [
    { ending: '-ay',    words: ['day', 'way', 'play', 'say'] },
    { ending: '-ight',  words: ['light', 'night', 'sight', 'right'] },
    { ending: '-ake',   words: ['cake', 'lake', 'take', 'make'] },
    { ending: '-ime',   words: ['time', 'lime', 'rhyme', 'dime'] },
    { ending: '-ow',    words: ['low', 'slow', 'grow', 'show'] },
    { ending: '-and',   words: ['hand', 'sand', 'land', 'stand'] },
    { ending: '-ing',   words: ['sing', 'ring', 'king', 'thing'] },
    { ending: '-all',   words: ['ball', 'call', 'fall', 'wall'] },
    { ending: '-ear',   words: ['year', 'near', 'clear', 'hear'] },
    { ending: '-ind',   words: ['mind', 'kind', 'find', 'blind'] },
  ],
  es: [
    { ending: '-ar',    words: ['mar', 'hablar', 'andar', 'lugar'] },
    { ending: '-or',    words: ['amor', 'calor', 'dolor', 'color'] },
    { ending: '-ana',   words: ['mañana', 'ventana', 'manzana', 'hermana'] },
    { ending: '-ado',   words: ['estado', 'soldado', 'mercado', 'helado'] },
    { ending: '-er',    words: ['comer', 'beber', 'ver', 'leer'] },
    { ending: '-ente',  words: ['gente', 'mente', 'siguiente', 'presente'] },
    { ending: '-ida',   words: ['vida', 'salida', 'comida', 'herida'] },
    { ending: '-illa',  words: ['silla', 'mejilla', 'orilla', 'semilla'] },
    { ending: '-aje',   words: ['viaje', 'paisaje', 'mensaje', 'pasaje'] },
    { ending: '-ón',    words: ['razón', 'canción', 'corazón', 'balcón'] },
  ],
  de: [
    { ending: '-icht',  words: ['Licht', 'Pflicht', 'Sicht', 'Gesicht'] },
    { ending: '-aus',   words: ['Haus', 'Maus', 'raus', 'aus'] },
    { ending: '-ein',   words: ['mein', 'sein', 'klein', 'allein'] },
    { ending: '-and',   words: ['Hand', 'Sand', 'Land', 'Stand'] },
    { ending: '-acht',  words: ['Nacht', 'Macht', 'acht', 'lacht'] },
    { ending: '-eit',   words: ['Zeit', 'Streit', 'weit', 'breit'] },
    { ending: '-ier',   words: ['Bier', 'Tier', 'vier', 'hier'] },
    { ending: '-ang',   words: ['lang', 'sang', 'klang', 'sprang'] },
    { ending: '-ehen',  words: ['gehen', 'sehen', 'stehen', 'drehen'] },
    { ending: '-ank',   words: ['Bank', 'Dank', 'krank', 'blank'] },
  ],
  pl: [
    { ending: '-oga',   words: ['noga', 'droga', 'podłoga', 'trwoga'] },
    { ending: '-ota',   words: ['robota', 'ochota', 'prostota', 'brzydota'] },
    { ending: '-ada',   words: ['rada', 'lada', 'narada', 'gromada'] },
    { ending: '-ana',   words: ['ściana', 'rana', 'polana', 'słomiana'] },
    { ending: '-ość',   words: ['miłość', 'radość', 'młodość', 'czystość'] },
    { ending: '-anie',  words: ['kochanie', 'spotkanie', 'śpiewanie', 'czytanie'] },
    { ending: '-ić',    words: ['pić', 'bić', 'śnić', 'mówić'] },
    { ending: '-ina',   words: ['godzina', 'malina', 'kalina', 'drabina'] },
    { ending: '-aj',    words: ['zwyczaj', 'kraj', 'raj', 'daj'] },
    { ending: '-ucha',  words: ['mucha', 'ucha', 'ducha', 'słucha'] },
  ],
};

/**
 * Build fallback 4-bar blocks for a given language and scheme.
 * Uses the FALLBACK_GROUPS rhyme pools to fill A/B slots; X slots become ''.
 */
export function buildFallbackBlocks(
  language: LanguageId,
  scheme: RhymeScheme,
  count: number,
): RhymeBlock[] {
  const groups = FALLBACK_GROUPS_BY_LANGUAGE[language];
  const pattern = scheme.pattern;
  const blocks: RhymeBlock[] = [];
  for (let i = 0; i < count; i++) {
    const aPool = groups[(i * 2) % groups.length].words;
    const bPool = groups[(i * 2 + 1) % groups.length].words;
    let aIdx = 0;
    let bIdx = 0;
    const words: string[] = [];
    for (const ch of pattern) {
      if (ch === 'A') {
        words.push(aPool[aIdx % aPool.length]);
        aIdx++;
      } else if (ch === 'B') {
        words.push(bPool[bIdx % bPool.length]);
        bIdx++;
      } else {
        words.push('');
      }
    }
    blocks.push({ words });
  }
  return blocks;
}
