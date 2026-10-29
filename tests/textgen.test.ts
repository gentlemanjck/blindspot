import { describe, expect, it } from 'vitest';
import { allowedChars, STAGES } from '../src/curriculum/ru.ts';
import words from '../src/data/words-ru.json';
import { exerciseTypes, generate, LINE_MAX, LINE_MIN } from '../src/textgen/index.ts';
import { createRng } from '../src/textgen/rng.ts';

const SEEDS = Array.from({ length: 100 }, (_, i) => i * 7919 + 1);
const WORDS = new Set(words);

describe('createRng', () => {
  it('is deterministic and stays in [0, 1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('exerciseTypes', () => {
  it('skips words and phrases while there are too few real words', () => {
    expect(exerciseTypes(1)).toEqual(['keys', 'combos']);
    expect(exerciseTypes(2)).toEqual(['keys', 'combos']);
  });

  it('has all four types once enough words are unlocked', () => {
    for (const stage of STAGES.filter((s) => s.id >= 3)) {
      expect(exerciseTypes(stage.id), `stage ${stage.id}`).toEqual([
        'keys',
        'combos',
        'words',
        'phrases',
      ]);
    }
  });
});

describe('generate', () => {
  it('never uses a locked character, keeps 40–60 chars and clean spacing', () => {
    for (const stage of STAGES) {
      const allowed = allowedChars(stage.id);
      for (const type of exerciseTypes(stage.id)) {
        for (const seed of SEEDS) {
          const line = generate(stage.id, type, seed);
          const where = `stage ${stage.id} ${type} seed ${seed}: "${line}"`;
          const locked = [...line].filter((ch) => !allowed.has(ch));
          expect(locked, where).toEqual([]);
          expect(line.length, where).toBeGreaterThanOrEqual(LINE_MIN);
          expect(line.length, where).toBeLessThanOrEqual(LINE_MAX);
          expect(line, where).toBe(line.trim());
          expect(line, where).not.toMatch(/ {2}/);
        }
      }
    }
  });

  it('is deterministic for a seed and varies between seeds', () => {
    expect(generate(5, 'words', 123)).toBe(generate(5, 'words', 123));
    const lines = new Set(SEEDS.slice(0, 20).map((s) => generate(5, 'words', s)));
    expect(lines.size).toBeGreaterThan(15);
  });

  it('keys exercise uses only the new keys on letter stages', () => {
    for (const seed of SEEDS) expect(generate(1, 'keys', seed)).toMatch(/^[ао ]+$/);
    for (const seed of SEEDS) expect(generate(9, 'keys', seed)).toMatch(/^[уш ]+$/);
  });

  it('combos weight the new keys at about half of the letters', () => {
    let total = 0;
    let fresh = 0;
    for (const seed of SEEDS) {
      for (const ch of generate(5, 'combos', seed).replace(/ /g, '')) {
        total++;
        if (ch === 'е' || ch === 'н') fresh++;
      }
    }
    expect(fresh / total).toBeGreaterThan(0.4);
    expect(fresh / total).toBeLessThan(0.6);
  });

  it('words exercise uses real words, mostly with the new letters', () => {
    let withNew = 0;
    let total = 0;
    for (const seed of SEEDS) {
      for (const word of generate(10, 'words', seed).split(' ')) {
        expect(WORDS.has(word), word).toBe(true);
        total++;
        if (/[сб]/.test(word)) withNew++;
      }
    }
    expect(withNew / total).toBeGreaterThan(0.5);
  });

  it('adds capitals from stage 16 and punctuation as it unlocks', () => {
    const all = (stage: number) => SEEDS.map((s) => generate(stage, 'phrases', s)).join(' ');
    expect(all(15)).not.toMatch(/[А-ЯЁ]/);
    expect(all(16)).toMatch(/[А-ЯЁ]/);
    expect(all(16)).not.toMatch(/[.,]/);
    expect(all(17)).toMatch(/\./);
    expect(all(17)).toMatch(/,/);
    expect(all(18)).toMatch(/[!?]/);
    expect(all(19)).toMatch(/\d/);
  });

  it('phrases on stage 16+ start every sentence with a capital', () => {
    for (const seed of SEEDS) {
      expect(generate(16, 'phrases', seed)).toMatch(/^[А-ЯЁ]/);
      for (const sentence of generate(17, 'phrases', seed).split(/[.!?] /)) {
        expect(sentence, sentence).toMatch(/^"?[А-ЯЁ]/);
      }
    }
  });

  it('keys exercise on stage 16 pairs capitals with their lowercase letters', () => {
    for (const seed of SEEDS) expect(generate(16, 'keys', seed)).toMatch(/^([А-ЯЁ][а-яё]+ ?)+$/);
  });
});
