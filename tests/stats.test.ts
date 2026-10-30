import { describe, expect, it } from 'vitest';
import {
  courseSummary,
  historyLabel,
  keyAccuracy,
  keyHeat,
  parseCriteria,
  summary,
} from '../src/stats/index.ts';
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

describe('courseSummary', () => {
  it('is empty before the first exercise', () => {
    expect(courseSummary(defaultData())).toEqual({ bestCpm: null, meanAccuracy: null });
  });

  it('takes the best stage speed and the mean accuracy of course lessons only', () => {
    const data = defaultData();
    data.course.stages[3] = { status: 'done', exercisesPassed: [], bestCpm: 140, bestAccuracy: 98 };
    data.course.stages[17] = {
      status: 'done',
      exercisesPassed: [],
      bestCpm: 210,
      bestAccuracy: 96,
    };
    data.course.stages[19] = {
      status: 'done',
      exercisesPassed: [],
      bestCpm: 400,
      bestAccuracy: 99,
    };
    data.history = [lesson(90), lesson(100), { ...lesson(10), stageId: 18 }, test(500)];
    expect(courseSummary(data)).toEqual({ bestCpm: 210, meanAccuracy: 95 });
  });
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

describe('keyHeat', () => {
  it('sums lower and upper case into one physical key and drops rare keys', () => {
    const rows = keyHeat(
      {
        а: { hits: 8, misses: 1, totalMs: 1600, timedHits: 8 },
        А: { hits: 1, misses: 0, totalMs: 400, timedHits: 1 },
        ' ': { hits: 30, misses: 0, totalMs: 3000, timedHits: 30 },
        о: { hits: 5, misses: 0, totalMs: 500, timedHits: 5 },
      },
      10,
    );
    expect(rows).toEqual([
      { code: 'KeyF', hits: 9, misses: 1, accuracy: 90, meanMs: 2000 / 9 },
      { code: 'Space', hits: 30, misses: 0, accuracy: 100, meanMs: 100 },
    ]);
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
