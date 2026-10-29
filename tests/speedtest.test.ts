import { describe, expect, it } from 'vitest';
import { worstKeys, type KeyStat } from '../src/engine/index.ts';
import { configKey, updateRecord } from '../src/storage/index.ts';
import { TestText, TOP_WORDS } from '../src/textgen/test.ts';

const SEEDS = Array.from({ length: 50 }, (_, i) => i * 104729 + 3);
const ALLOWED = /^[а-яёА-ЯЁ .,!?:;\-"]+$/;
const TOP = new Set(TOP_WORDS);

const plain = { source: 'words', capitals: false, punctuation: false } as const;

describe('TestText', () => {
  it('gives exactly the requested number of words', () => {
    for (const seed of SEEDS) {
      expect(new TestText(seed, plain).words(25)).toHaveLength(25);
      expect(new TestText(seed, { ...plain, source: 'classics' }).words(100)).toHaveLength(100);
    }
  });

  it('is deterministic for a seed', () => {
    expect(new TestText(7, plain).words(50)).toEqual(new TestText(7, plain).words(50));
    expect(new TestText(7, plain).words(50)).not.toEqual(new TestText(8, plain).words(50));
  });

  it('continues the same stream on later calls', () => {
    const a = new TestText(9, plain);
    const b = new TestText(9, plain);
    expect([...a.words(10), ...a.words(10)]).toEqual(b.words(20));
  });

  it('uses only top-1000 words in lowercase without punctuation by default', () => {
    for (const seed of SEEDS) {
      for (const w of new TestText(seed, plain).words(50)) expect(TOP.has(w), w).toBe(true);
    }
  });

  for (const source of ['words', 'classics'] as const) {
    it(`${source}: respects the capitals and punctuation toggles`, () => {
      const text = (capitals: boolean, punctuation: boolean) =>
        SEEDS.map((s) =>
          new TestText(s, { source, capitals, punctuation }).words(60).join(' '),
        ).join(' ');
      const none = text(false, false);
      expect(none).toMatch(/^[а-яё ]+$/);
      const caps = text(true, false);
      expect(caps).toMatch(/[А-ЯЁ]/);
      expect(caps).not.toMatch(/[.,!?:;"-]/);
      const punct = text(false, true);
      expect(punct).not.toMatch(/[А-ЯЁ]/);
      expect(punct).toMatch(/[.,]/);
      const both = text(true, true);
      expect(both).toMatch(ALLOWED);
      expect(both).toMatch(/[А-ЯЁ]/);
      expect(both).toMatch(/[.,]/);
    });
  }

  it('never yields empty words', () => {
    for (const seed of SEEDS) {
      for (const source of ['words', 'classics'] as const) {
        for (const w of new TestText(seed, { source, capitals: true, punctuation: false }).words(
          80,
        )) {
          expect(w.length, `"${w}"`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('configKey', () => {
  it('distinguishes every option that changes the result', () => {
    const base = {
      lengthType: 'time',
      length: 30,
      source: 'words',
      capitals: false,
      punctuation: false,
      yoOptional: true,
    } as const;
    const keys = new Set([
      configKey(base),
      configKey({ ...base, length: 60 }),
      configKey({ ...base, lengthType: 'words' }),
      configKey({ ...base, source: 'classics' }),
      configKey({ ...base, capitals: true }),
      configKey({ ...base, punctuation: true }),
      configKey({ ...base, yoOptional: false }),
    ]);
    expect(keys.size).toBe(7);
    expect(configKey(base)).toBe(configKey({ ...base }));
  });
});

describe('updateRecord', () => {
  const at = '2026-10-29T12:00:00.000Z';

  it('sets the first record and beats it only with a higher CPM', () => {
    let r = updateRecord({}, 'k', { cpm: 200, accuracy: 95, at });
    expect(r).toEqual({ records: { k: { cpm: 200, accuracy: 95, at } }, isRecord: true });
    const same = updateRecord(r.records, 'k', { cpm: 200, accuracy: 99, at });
    expect(same.isRecord).toBe(false);
    expect(same.records).toBe(r.records);
    r = updateRecord(r.records, 'k', { cpm: 250, accuracy: 90, at });
    expect(r.isRecord).toBe(true);
    expect(r.records['k']?.cpm).toBe(250);
  });
});

describe('worstKeys', () => {
  const s = (hits: number, misses: number, totalMs: number): KeyStat => ({
    hits,
    misses,
    totalMs,
    timedHits: hits,
  });

  it('ranks by misses, then by mean time', () => {
    const perKey = new Map([
      ['а', s(10, 0, 1000)], // 100 ms
      ['б', s(5, 2, 1000)],
      ['в', s(5, 0, 3000)], // 600 ms
      ['г', s(5, 3, 500)],
      [' ', s(10, 0, 2000)], // 200 ms
    ]);
    expect(worstKeys(perKey, 3)).toEqual(['г', 'б', 'в']);
  });
});
