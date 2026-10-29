// Seeded lesson text generators (SPEC §4). Every line uses only characters unlocked by the stage.

import {
  EXERCISE_TYPES,
  getStage,
  unlockedLetters,
  type ExerciseType,
  type Stage,
} from '../curriculum/ru.ts';
import words from '../data/words-ru.json';
import { chance, createRng, int, pick, pickSkewed, type Rng } from './rng.ts';

export const LINE_MIN = 40;
export const LINE_MAX = 60;

/** Multi-letter words a stage needs before words and phrases exercises make sense. */
const MIN_WORDS = 12;

const CAPITALS_FROM = 16;
const PUNCTUATION_FROM = 17;
const EXTRA_PUNCTUATION_FROM = 18;
const DIGITS_FROM = 19;

const poolCache = new Map<number, string[]>();
const derivedCache = new Map<number, { withNew: string[]; shortPool: string[] }>();

/** Frequency-ordered words made only of letters unlocked by the stage. */
function wordPool(stageId: number): string[] {
  let pool = poolCache.get(stageId);
  if (!pool) {
    const letters = new Set(unlockedLetters(stageId));
    pool = words.filter((w) => [...w].every((ch) => letters.has(ch)));
    poolCache.set(stageId, pool);
  }
  return pool;
}

export function exerciseTypes(stageId: number): ExerciseType[] {
  const enough = wordPool(stageId).filter((w) => w.length > 1).length >= MIN_WORDS;
  return enough ? [...EXERCISE_TYPES] : ['keys', 'combos'];
}

export function generate(stageId: number, type: ExerciseType, seed: number): string {
  const stage = getStage(stageId);
  const typeIndex = EXERCISE_TYPES.indexOf(type);
  const rng = createRng(seed ^ Math.imul(stageId, 7919) ^ Math.imul(typeIndex + 1, 104729));
  const gen = new Generator(stage, rng);
  switch (type) {
    case 'keys':
      return fillLine(
        rng,
        () => gen.keysToken(),
        () => gen.keysToken(true),
      );
    case 'combos':
      return fillLine(
        rng,
        () => gen.combosToken(),
        () => gen.combosToken(true),
      );
    case 'words':
      return fillLine(
        rng,
        () => gen.wordsToken(),
        () => gen.shortWord(),
      );
    case 'phrases':
      return stage.id >= CAPITALS_FROM
        ? fillLine(
            rng,
            () => gen.sentence(),
            () => gen.shortSentence(),
          )
        : fillLine(
            rng,
            () => gen.phraseWord(),
            () => gen.shortWord(),
          );
  }
}

/**
 * Joins tokens with spaces up to a random length in [LINE_MIN, LINE_MAX]. `short` must give
 * tokens of at most 4 characters, so the line can always reach LINE_MIN.
 */
function fillLine(rng: Rng, next: () => string, short: () => string): string {
  const target = int(rng, LINE_MIN, LINE_MAX);
  let line = '';
  const fits = (tok: string) => (line ? line.length + 1 : 0) + tok.length <= LINE_MAX;
  const add = (tok: string) => (line = line ? `${line} ${tok}` : tok);
  for (let attempts = 0; line.length < target && attempts < 50;) {
    const tok = next();
    if (fits(tok)) add(tok);
    else if (line.length >= LINE_MIN) break;
    else attempts++;
  }
  while (line.length < LINE_MIN) add(short());
  return line;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

class Generator {
  private readonly letters: string[];
  private readonly learned: string[];
  private readonly pool: string[];
  private readonly withNew: string[];
  private readonly shortPool: string[];
  private readonly stage: Stage;
  private readonly rng: Rng;

  constructor(stage: Stage, rng: Rng) {
    this.stage = stage;
    this.rng = rng;
    this.letters = unlockedLetters(stage.id);
    const fresh = new Set(stage.kind === 'letters' ? stage.newChars : []);
    this.learned = this.letters.filter((ch) => !fresh.has(ch));
    this.pool = wordPool(stage.id);
    let derived = derivedCache.get(stage.id);
    if (!derived) {
      derived = {
        withNew: this.pool.filter((w) => [...w].some((ch) => fresh.has(ch))),
        shortPool: this.pool.filter((w) => w.length <= 2),
      };
      derivedCache.set(stage.id, derived);
    }
    this.withNew = derived.withNew;
    this.shortPool = derived.shortPool;
  }

  private get capitals(): boolean {
    return this.stage.id >= CAPITALS_FROM;
  }

  private syllable(len: number, newShare: number): string {
    const { rng, stage, learned } = this;
    let s = '';
    for (let i = 0; i < len; i++) {
      const useNew = stage.kind === 'letters' && (learned.length === 0 || chance(rng, newShare));
      s += useNew ? pick(rng, stage.newChars) : pick(rng, learned.length ? learned : this.letters);
    }
    return s;
  }

  private number(maxDigits: number): string {
    const len = int(this.rng, 1, maxDigits);
    let s = String(int(this.rng, len > 1 ? 1 : 0, 9));
    for (let i = 1; i < len; i++) s += String(int(this.rng, 0, 9));
    return s;
  }

  /** Punctuation marks unlocked by the stage. */
  private marks(): string[] {
    if (this.stage.id >= EXTRA_PUNCTUATION_FROM) return ['.', ',', '!', '?', ':', ';', '-', '"'];
    if (this.stage.id >= PUNCTUATION_FROM) return ['.', ','];
    return [];
  }

  /** Attaches a mark to a word: a dash stands apart, quotes wrap the word. */
  private withMark(word: string, mark: string): string {
    if (mark === '-') return `${word} -`;
    if (mark === '"') return `"${word}"`;
    return word + mark;
  }

  keysToken(short = false): string {
    const { rng, stage } = this;
    switch (stage.kind) {
      case 'letters':
        return this.syllable(short ? 1 : int(rng, 2, 4), 1);
      case 'capitals': {
        const ch = pick(rng, this.letters);
        return ch.toUpperCase() + ch;
      }
      case 'punctuation': {
        const mark = pick(rng, stage.newChars);
        return this.withMark(
          pick(rng, this.letters) + (short ? '' : pick(rng, this.letters)),
          mark,
        );
      }
      case 'digits':
        return this.number(short ? 1 : 3);
    }
  }

  combosToken(short = false): string {
    const { rng, stage } = this;
    const len = short ? 2 : int(rng, 2, 4);
    switch (stage.kind) {
      case 'letters':
        return this.syllable(len, 0.5);
      case 'capitals':
        return capitalize(this.syllable(len, 0));
      case 'punctuation': {
        const s = this.syllable(short ? 1 : len, 0);
        return chance(rng, 0.5) ? this.withMark(s, pick(rng, stage.newChars)) : s;
      }
      case 'digits':
        return chance(rng, 0.5) ? this.number(short ? 2 : 4) : this.syllable(len, 0);
    }
  }

  private pickWord(newBias: number): string {
    const { rng } = this;
    const source = this.withNew.length && chance(rng, newBias) ? this.withNew : this.pool;
    return pickSkewed(rng, source);
  }

  /** A word decorated with the features unlocked so far (capitals, marks, digits). */
  private decorated(word: string, pNumber: number, pCapital: number, pMark: number): string {
    const { rng } = this;
    if (this.stage.id >= DIGITS_FROM && chance(rng, pNumber)) return this.number(4);
    let w = word;
    if (this.capitals && chance(rng, pCapital)) w = capitalize(w);
    const marks = this.marks();
    if (marks.length && chance(rng, pMark)) w = this.withMark(w, pick(rng, marks));
    return w;
  }

  wordsToken(): string {
    return this.decorated(this.pickWord(0.7), 0.3, 0.5, 0.4);
  }

  phraseWord(): string {
    return this.pickWord(0.4);
  }

  shortWord(): string {
    return pick(this.rng, this.shortPool);
  }

  /** A sentence: capital first, marks inside and at the end as the stage allows. */
  sentence(): string {
    const { rng, stage } = this;
    const n = int(rng, 2, 6);
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      let w: string = this.pickWord(0.3);
      const last = i === n - 1;
      if (stage.id >= DIGITS_FROM && chance(rng, 0.15)) w = this.number(4);
      else if (stage.id >= EXTRA_PUNCTUATION_FROM && chance(rng, 0.1)) w = `"${w}"`;
      if (!last && stage.id >= PUNCTUATION_FROM && chance(rng, 0.2)) {
        const inner =
          stage.id >= EXTRA_PUNCTUATION_FROM ? pick(rng, [',', ',', ':', ';', ' -']) : ',';
        w += inner;
      }
      parts.push(w);
    }
    return this.finishSentence(parts.join(' '));
  }

  shortSentence(): string {
    return this.finishSentence(this.shortWord()).slice(0, 4);
  }

  private finishSentence(body: string): string {
    const { rng, stage } = this;
    const text = body.startsWith('"') ? '"' + capitalize(body.slice(1)) : capitalize(body);
    if (stage.id >= EXTRA_PUNCTUATION_FROM) return text + pick(rng, ['.', '.', '!', '?']);
    if (stage.id >= PUNCTUATION_FROM) return text + '.';
    return text;
  }
}
