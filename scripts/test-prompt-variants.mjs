#!/usr/bin/env node
// Compares prompt variants for Ukrainian rhyme generation.
// Runs each named variant on the same set of themes and prints side-by-side output.
// Usage: node scripts/test-prompt-variants.mjs

import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}

const COUNT = 10;
const THEMES = ['місто', 'тварини', 'емоції', 'природа', 'спорт'];

// --- variant A: CURRENT production prompt for Ukrainian (mirrors lib/languages.ts) ---
const promptCurrent = (theme) => [
  `Тема: "${theme}".`,
  `Згенеруй ${COUNT} груп поширених українських слів, пов'язаних із темою "${theme}", які римуються між собою.`,
  'Кожна група повинна мати спільне закінчення (від наголошеного голосного до кінця слова).',
  'У кожній групі — 3–4 слова. Уникай рідкісних, архаїчних або вульгарних слів.',
  'Перевага — простим іменникам, дієсловам та прикметникам, які впізнає підліток або початківець.',
  'Виведи результат через інструмент rhyme_groups.',
].join(' ');

// --- variant B: v5 — tighter, bans phonetic-family clustering, sharper format rule ---
const promptV5 = (theme) => [
  `Тема для натхнення: "${theme}" — лише поштовх, не клітка. Приблизно 30–40% груп можуть бути про тему, решта — про інше (різні образи, дії, побут, відчуття).`,

  `Згенеруй ${COUNT} груп. У кожній групі — 3–4 справжніх українських слова, які римуються (однаковий наголошений голосний і звуки після нього). Без пробілів, прийменників, новотворів, латиниці, повторів у групі.`,

  'ФОРМАТ ВИВОДУ — приклад правильної групи:',
  '{ "ending": "-ить", "words": ["летить", "горить", "болить", "кричить"] }',
  'Поле "ending" — дефіс + 2–5 літер, які буквально завершують КОЖНЕ слово в групі. Без коментарів, дужок, слешів.',

  'НА РІВНІ ВСІХ 10 ГРУП (критично):',
  '• Жодне слово не повторюється у двох групах.',
  "• Жодне семантичне/морфологічне гніздо не повторюється: якщо в одній групі є 'магічний', не клади 'магічно', 'магічна', 'магічне' в інші групи. Обери зовсім інший корінь.",
  "• НЕ обирай кілька закінчень із одного фонетичного гнізда (наприклад -ічний / -ічна / -ічно / -ічне — це фактично одна група). Закінчення мають відчуватися як ПОВНІСТЮ різні рими, а не варіанти однієї.",
  '• Серед 10 закінчень обов\'язково: ≥2 прикметникові (-ий/-на/-ого/-ій/-ний), ≥1 прислівникове (-о/-е: тихо, легко, разом), ≥1 дієслівне в особовій формі (-ить/-ать/-ять/-ують), ≥1 з конкретними образами для історії (людина, місце, час доби, погода, частина тіла).',

  'Перевага — простим словам, які впізнає підліток або початківець. Уникай архаїзмів і вульгаризмів.',
  'Виведи через інструмент rhyme_groups.',
].join(' ');

// --- variant C: v4 (kept for reference, not in active variants) ---
const promptV4 = (theme) => [
  `Тема для натхнення: "${theme}". Це лише поштовх, не клітка.`,
  `Згенеруй ${COUNT} груп українських слів, які римуються в межах кожної групи.`,

  'ФОРМАТ КОЖНОЇ ГРУПИ:',
  '• "ending" — буквальне закінчення, яким завершується КОЖНЕ слово групи. Формат: дефіс + 2-5 літер ("-ить", "-ова", "-шка"). Без коментарів, дужок, слешів, альтернатив. Якщо не всі слова групи мають однакове закінчення — розділи на дві групи.',
  '• Кожне слово — ОДНЕ існуюче українське слово у звичній формі. Без пробілів, прийменників, новотворів, латиниці. Якщо сумніваєшся, чи слово існує — не використовуй.',
  '• Усі слова в групі мають справді римуватися (однаковий наголошений голосний і звуки після нього).',
  '• Не повторюй слово в межах групи.',

  'ПРИКЛАД ПРАВИЛЬНОЇ ГРУПИ:',
  '{ "ending": "-ить", "words": ["летить", "горить", "болить", "кричить"] }',
  'ПРИКЛАД НЕПРАВИЛЬНОЇ (різні закінчення в одній групі):',
  '{ "ending": "-ають", "words": ["співають", "гуляють", "гризуть", "кричать"] }  ← так не роби.',

  'ЛЕКСИЧНА РІЗНОМАНІТНІСТЬ (критично важливо):',
  '• Кожна група має походити з різного семантичного гнізда. Не створюй кілька груп навколо одного і того самого кореня.',
  '• ЗАБОРОНЕНО: одна група з "магічна, музична", інша з "магічний, музичний", третя з "магічно, музично". Це той самий лексикон у різних формах — для римера це просто повтор.',
  '• Якщо для нового закінчення тобі спадають на думку лише форми слів, які вже зустрічалися в інших групах, — обери інше закінчення.',
  '• Жодне слово не повторюється у двох групах.',

  'РІЗНОМАНІТТЯ ЗА ЧАСТИНАМИ МОВИ — обери 10 закінчень так, щоб набір включав:',
  '• ≥2 прикметникові (наприклад -ий, -на, -ого, -ій, -ний, -іший),',
  '• ≥1 прислівникове (-о, -е: тихо, легко, разом, потім, навіки),',
  '• ≥1 дієслівне в особовій формі (-ить, -ать, -ять, -ують),',
  "• ≥1 'якірне' — конкретні образи, які запускають історію (людина, час доби, частина тіла, погода, місце).",

  'СЕМАНТИКА: тема — натхнення для приблизно 30–40% груп. Інші мають вести римера в інші напрямки (різні образи, дії, відчуття, побут). Не зациклюйся на одному семантичному полі.',

  'У кожній групі — 3–4 слова. Перевага — простим словам, які впізнає підліток або початківець. Уникай архаїчних і вульгарних слів.',
  'Виведи результат через інструмент rhyme_groups.',
].join(' ');

// --- variant C: v3 (kept for reference, not exported by default) ---
const promptV3 = (theme) => [
  `Тема для натхнення: "${theme}". Це лише поштовх, не клітка.`,
  `Згенеруй ${COUNT} груп українських слів, які римуються в межах кожної групи.`,

  'ФОРМАТ КОЖНОЇ ГРУПИ (важливо, не порушуй):',
  '• "ending" — буквальне закінчення, яким завершується КОЖНЕ слово групи. Формат: дефіс + 2-5 літер. Приклади: "-ить", "-ова", "-ого", "-шка". Без коментарів, без дужок, без слешів і альтернатив. Якщо не всі слова групи мають однакове закінчення — НЕ створюй таку групу, розділи на дві.',
  '• Кожне "слово" — ОДНЕ існуюче українське слово у звичній формі. Без пробілів, без прийменників, без новотворів, без транслітерації латиницею. Якщо сумніваєшся, чи слово існує — не використовуй.',
  '• Усі слова в групі мають справді римуватися (однаковий наголошений голосний і звуки після нього).',
  '• Не повторюй те саме слово в межах групи.',

  'ПРИКЛАД ПРАВИЛЬНОЇ ГРУПИ:',
  '{ "ending": "-ить", "words": ["летить", "горить", "болить", "кричить"] }',
  'ПРИКЛАД НЕПРАВИЛЬНОЇ (різні закінчення в одній групі):',
  '{ "ending": "-ають", "words": ["співають", "гуляють", "гризуть", "кричать"] }  ← так не роби.',

  'РІЗНОМАНІТТЯ — обери 10 РІЗНИХ закінчень так, щоб набір як ціле включав:',
  '• щонайменше 2 прикметникові закінчення (наприклад -ий, -на, -ого, -ій, -ний, -іший),',
  '• щонайменше 1 прислівникове (наприклад -о, -е: тихо, легко, разом, потім, навіки),',
  '• щонайменше 1 дієслівне в особовій формі (-ить, -ать, -ять, -ують, -ємо),',
  "• щонайменше 1 'якірне' — таке, де природно живуть конкретні образи для історії (людина, час доби, частина тіла, погода, місце).",

  'СЕМАНТИКА: тема — натхнення для приблизно 30–40% груп. Інші мають вести римера в інші напрямки (різні образи, дії, відчуття, побут). Не зациклюйся на одному семантичному полі.',

  'У кожній групі — 3–4 слова. Перевага — простим словам, які впізнає підліток або початківець. Уникай архаїчних і вульгарних слів.',
  'Виведи результат через інструмент rhyme_groups.',
].join(' ');

const VARIANTS = [
  { name: 'current', build: promptCurrent },
  { name: 'v4',      build: promptV4 },
];

const TOOL_NAME = 'rhyme_groups';

const TOOL = {
  name: TOOL_NAME,
  description: 'Return groups of Ukrainian words that rhyme.',
  input_schema: {
    type: 'object',
    properties: {
      groups: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ending: { type: 'string' },
            words: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
          },
          required: ['ending', 'words'],
        },
      },
    },
    required: ['groups'],
  },
};

function parseGroups(content) {
  if (!Array.isArray(content)) return null;
  for (const b of content) {
    if (b && b.type === 'tool_use' && b.name === TOOL_NAME) {
      const groups = b.input?.groups;
      if (!Array.isArray(groups)) return null;
      const cleaned = [];
      for (const g of groups) {
        if (!g || typeof g.ending !== 'string') continue;
        if (!Array.isArray(g.words)) continue;
        const words = g.words.filter((w) => typeof w === 'string' && w.length > 0);
        if (words.length >= 2) cleaned.push({ ending: g.ending, words });
      }
      return cleaned;
    }
  }
  return null;
}

// Crude Ukrainian POS guess from word ending. Used only for a rough diversity readout.
function guessPos(word) {
  const w = word.toLowerCase();
  if (/(ити|ати|яти|іти|ути|ювати)$/.test(w)) return 'verb-inf';
  if (/(ить|ать|ять|ують|ємо|імо|еш|їш|ється)$/.test(w)) return 'verb-conj';
  if (/(ий|ій|ська|цький|на|не|ний|ова|ого|ому|ими)$/.test(w)) return 'adj';
  if (/(но|то|ло|ко|ро|ма|ро|раз|потім|тут|там|зараз|вже)$/.test(w)) return 'adv-or-other';
  if (w.length <= 3) return 'short';
  return 'noun-or-other';
}

function summarizeRun(groups) {
  const allWords = groups.flatMap((g) => g.words);
  const posCount = {};
  for (const w of allWords) {
    const p = guessPos(w);
    posCount[p] = (posCount[p] || 0) + 1;
  }
  return { total: allWords.length, posCount };
}

function fmt(label, groups) {
  const lines = [];
  lines.push(`\n──── ${label} ────`);
  for (const g of groups) {
    const wordsStr = g.words.join(', ');
    lines.push(`  ${g.ending.padEnd(8)}  ${wordsStr}`);
  }
  const sum = summarizeRun(groups);
  const posStr = Object.entries(sum.posCount).map(([k, v]) => `${k}=${v}`).join('  ');
  lines.push(`  [total=${sum.total}  ${posStr}]`);
  return lines.join('\n');
}

async function callOne(client, name, theme, build) {
  const prompt = build(theme);
  const t0 = Date.now();
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    temperature: 1,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    messages: [{ role: 'user', content: prompt }],
  });
  const groups = parseGroups(res?.content) || [];
  const ms = Date.now() - t0;
  return { name, theme, ms, groups };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY missing');
    process.exit(1);
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const tasks = [];
  for (const v of VARIANTS) {
    for (const theme of THEMES) {
      tasks.push(callOne(client, v.name, theme, v.build));
    }
  }

  console.log(`Running ${tasks.length} calls in parallel...\n`);
  const results = await Promise.all(tasks);

  for (const theme of THEMES) {
    console.log(`\n════════════════════════════════════════════════════════════════════════`);
    console.log(`THEME: ${theme}`);
    console.log(`════════════════════════════════════════════════════════════════════════`);
    for (const v of VARIANTS) {
      const r = results.find((x) => x.name === v.name && x.theme === theme);
      console.log(fmt(`${v.name}  (${r.ms}ms)`, r.groups));
    }
  }

  console.log('\nDone.');
}

main().catch((err) => { console.error(err); process.exit(1); });
