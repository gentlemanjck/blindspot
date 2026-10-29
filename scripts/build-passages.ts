// Builds src/data/passages-ru.json from public-domain works on Russian Wikisource.
// Run: node scripts/build-passages.ts
// Paragraphs are normalised to characters the course teaches (SPEC §9); see src/data/README.md.

import { writeFile } from 'node:fs/promises';

const OUT = 'src/data/passages-ru.json';
const API = 'https://ru.wikisource.org/w/api.php';
const MIN = 150;
const MAX = 420;
const PER_WORK = 10;

const WORKS = [
  { title: 'Каштанка (Чехов)', source: 'А. П. Чехов, «Каштанка»' },
  { title: 'Ванька (Чехов, 1886)', source: 'А. П. Чехов, «Ванька»' },
  { title: 'Толстый и тонкий (Чехов)/ПСС 1903 (ВТ)', source: 'А. П. Чехов, «Толстый и тонкий»' },
  {
    title: 'Повести покойного Ивана Петровича Белкина (Пушкин)/Метель',
    source: 'А. С. Пушкин, «Метель»',
  },
  { title: 'Кавказский пленник (Толстой)', source: 'Л. Н. Толстой, «Кавказский пленник»' },
];

/** Letters, space and the punctuation taught in stages 17–18. */
const ALLOWED = /^[а-яёА-ЯЁ .,!?:;\-"]+$/;

export function normalise(text: string): string {
  return text
    .replace(/[«»„“”]/g, '"')
    .replace(/[—–]/g, '-')
    .replace(/…/g, '...')
    .replace(/\*/g, '')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[\u0301]/g, '') // stress marks
    .replace(/\s+/g, ' ')
    .replace(/ ([.,!?:;])/g, '$1')
    .trim();
}

function stripHtml(html: string): string[] {
  const text = html
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/g, '')
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/g, '')
    .replace(/<\/p>|<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
  return text.split('\n');
}

async function fetchWork(title: string): Promise<string[]> {
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: 'parse',
    page: title,
    prop: 'text',
    format: 'json',
    formatversion: '2',
  }).toString();
  const res = await fetch(url, {
    headers: { 'User-Agent': 'typing-trainer/0.1 (learning project)' },
  });
  const data = (await res.json()) as { parse?: { text: string } };
  if (!data.parse) throw new Error(`No text for ${title}`);
  return stripHtml(data.parse.text);
}

async function main(): Promise<void> {
  const passages: { text: string; source: string; url: string }[] = [];
  for (const work of WORKS) {
    // Wikisource rate-limits bursts of API calls.
    await new Promise((r) => setTimeout(r, 3000));
    const lines = await fetchWork(work.title);
    const url = `https://ru.wikisource.org/wiki/${encodeURIComponent(work.title.replace(/ /g, '_'))}`;
    let taken = 0;
    for (const line of lines) {
      const text = normalise(line);
      if (text.length < MIN || text.length > MAX || !ALLOWED.test(text)) continue;
      // Wikisource licence boilerplate under the text.
      if (/авторск|лицензи|общественн(ым|ое) достояни/i.test(text)) continue;
      passages.push({ text, source: work.source, url });
      if (++taken >= PER_WORK) break;
    }
    console.log(`${work.source}: ${taken}`);
  }
  await writeFile(OUT, JSON.stringify(passages, null, 1) + '\n');
  console.log(`${passages.length} passages -> ${OUT}`);
}

await main();
