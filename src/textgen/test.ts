// Seeded text for the speed test (SPEC §5): frequent words or public-domain passages, with
// capitals and punctuation switched on or off.

import passages from '../data/passages-ru.json';
import words from '../data/words-ru.json';
import { chance, createRng, int, pick, type Rng } from './rng.ts';

export const TOP_WORDS: readonly string[] = words.slice(0, 1000);

export interface TestTextOptions {
  source: 'words' | 'classics';
  capitals: boolean;
  punctuation: boolean;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** An endless, reproducible stream of words; `words(n)` takes the next n. */
export class TestText {
  private readonly rng: Rng;
  private readonly opts: TestTextOptions;
  private readonly queue: string[] = [];
  private readonly order: number[];
  private passage = 0;

  constructor(seed: number, opts: TestTextOptions) {
    this.rng = createRng(seed);
    this.opts = opts;
    // Shuffled passage order (Fisher–Yates).
    this.order = passages.map((_, i) => i);
    for (let i = this.order.length - 1; i > 0; i--) {
      const j = int(this.rng, 0, i);
      [this.order[i], this.order[j]] = [this.order[j] as number, this.order[i] as number];
    }
  }

  words(n: number): string[] {
    while (this.queue.length < n) {
      if (this.opts.source === 'words') this.sentence();
      else this.nextPassage();
    }
    return this.queue.splice(0, n);
  }

  private sentence(): void {
    const { rng, opts } = this;
    const n = int(rng, 4, 10);
    for (let i = 0; i < n; i++) {
      let w = pick(rng, TOP_WORDS);
      if (i === 0 && opts.capitals) w = capitalize(w);
      if (opts.punctuation) {
        if (i === n - 1) w += pick(rng, ['.', '.', '.', '!', '?']);
        else if (i > 0 && chance(rng, 0.15)) w += ',';
      }
      this.queue.push(w);
    }
  }

  private nextPassage(): void {
    const p = passages[this.order[this.passage++ % this.order.length] ?? 0];
    let text = p?.text ?? '';
    if (!this.opts.punctuation) text = text.replace(/-/g, ' ').replace(/[.,!?:;"]/g, '');
    if (!this.opts.capitals) text = text.toLowerCase();
    this.queue.push(...text.split(/\s+/).filter(Boolean));
  }
}
