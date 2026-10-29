import { describe, expect, it } from 'vitest';
import { historyLabel, keyAccuracy, parseCriteria, summary } from '../src/stats/index.ts';
import { defaultData, type HistoryEntry } from '../src/storage/index.ts';

const at = '2026-10-29T12:00:00.000Z';
const lesson = (accuracy: number): HistoryEntry => ({
  at,
  mode: 'lesson',
  stageId: 5,
  exerciseType: 'words',
  cpm: 100,
  rawCpm: 110,
  accuracy,
  durationMs: 20_000,
});
const test = (cpm: number, config = 'time30-words'): HistoryEntry => ({
  at,
  mode: 'test',
  cpm,
  rawCpm: cpm,
  accuracy: 90,
  durationMs: 30_000,
  config,
});

describe('summary', () => {
  it('is empty for no history', () => {
    expect(summary(defaultData())).toEqual({
      lessons: 0,
      tests: 0,
      bestTestCpm: null,
      recentAccuracy: null,
    });
  });

  it('counts sessions, finds the best test and averages the last 20 accuracies', () => {
    const history = [
      ...Array.from({ length: 10 }, () => lesson(50)),
      ...Array.from({ length: 18 }, () => lesson(100)),
      test(250),
      test(300),
    ];
    expect(summary({ ...defaultData(), history })).toEqual({
      lessons: 28,
      tests: 2,
      bestTestCpm: 300,
      recentAccuracy: (18 * 100 + 2 * 90) / 20,
    });
  });
});

describe('historyLabel', () => {
  it('names lessons and tests in plain Russian', () => {
    expect(historyLabel(lesson(95))).toBe('Урок 5, слова');
    expect(historyLabel(test(1, 'time30-words'))).toBe('Тест 30 с, частые слова');
    expect(historyLabel(test(1, 'words50-classics-caps-punct'))).toBe('Тест 50 слов, классика');
    expect(historyLabel({ ...test(1), config: 'garbage' })).toBe('Тест');
  });
});

describe('keyAccuracy', () => {
  it('drops rarely typed keys and lists the worst first', () => {
    const rows = keyAccuracy(
      {
        а: { hits: 95, misses: 5, totalMs: 9500, timedHits: 95 },
        б: { hits: 18, misses: 2, totalMs: 7200, timedHits: 18 },
        в: { hits: 3, misses: 3, totalMs: 300, timedHits: 3 },
        г: { hits: 18, misses: 2, totalMs: 1800, timedHits: 18 },
      },
      10,
    );
    expect(rows.map((r) => r.char)).toEqual(['б', 'г', 'а']);
    expect(rows[0]).toEqual({ char: 'б', hits: 18, misses: 2, accuracy: 90, meanMs: 400 });
  });
});

describe('parseCriteria', () => {
  it('accepts whole numbers in range', () => {
    expect(parseCriteria('95', ['60', '100', '140', '160'])).toEqual({
      ok: true,
      criteria: { passAccuracy: 95, cpmTargets: [60, 100, 140, 160] },
    });
  });

  it('explains what is wrong', () => {
    expect(parseCriteria('120', ['60', '100', '140', '160'])).toEqual({
      ok: false,
      error: 'Точность: целое число от 50 до 100.',
    });
    expect(parseCriteria('95', ['60', 'быстро', '140', '160'])).toEqual({
      ok: false,
      error: 'Скорость для этапов 6–10: целое число от 0 до 1000.',
    });
  });
});
