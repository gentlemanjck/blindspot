// Builds src/data/words-ru.json from the hermitdave/FrequencyWords Russian list (CC BY-SA 4.0).
// Run: node scripts/build-words.ts [path-to-ru_50k.txt]
// Without a path the list is downloaded. See src/data/README.md for source and licence.

import { readFile, writeFile } from 'node:fs/promises';

const SOURCE_URL =
  'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ru/ru_50k.txt';
const OUT = 'src/data/words-ru.json';
const LIMIT = 10_000;

/** Single-letter Russian words that are real words. */
const SINGLE = new Set(['а', 'в', 'и', 'к', 'о', 'с', 'у', 'я']);

/** Obscene and crude roots; a word matching any of these is dropped. */
const BLOCKED = [
  /ху[йяеёи]/,
  /пизд/,
  /бля/,
  /^(за|по|на|вы|от|до|у|при|раз|съ|из|подъ|недо)?[её]б[аеиуоёлн]/,
  /[ъь]еб/,
  /муд[аои]/,
  /^сук[аиеу]/,
  /^сучк/,
  /шлюх/,
  /залуп/,
  /пид[оа]р/,
  /педик/,
  /гандон/,
  /дерьм/,
  /говн/,
  /жоп/,
  /^(на|об|за|вы|по)?ср[аи]/,
  /херн/,
  /^хер/,
  /трах/,
  /сиськ/,
  /член/,
];

async function main(): Promise<void> {
  const path = process.argv[2];
  const raw = path ? await readFile(path, 'utf8') : await (await fetch(SOURCE_URL)).text();

  const words: string[] = [];
  const seen = new Set<string>();
  for (const line of raw.split('\n')) {
    const word = line.split(' ')[0]?.trim().toLowerCase() ?? '';
    if (!/^[а-яё]+$/.test(word)) continue;
    if (word.length === 1 && !SINGLE.has(word)) continue;
    // Drop interjections like "ааа" and vowel-less fragments like "дл".
    if (/(.)\1\1/.test(word) || /^(.)\1+$/.test(word) || /([аоуыэ])\1$/.test(word)) continue;
    if (word.length > 1 && !/[аеёиоуыэюя]/.test(word)) continue;
    if (BLOCKED.some((re) => re.test(word))) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    words.push(word);
    if (words.length >= LIMIT) break;
  }

  await writeFile(OUT, JSON.stringify(words) + '\n');
  console.log(`${words.length} words -> ${OUT}`);
}

await main();
