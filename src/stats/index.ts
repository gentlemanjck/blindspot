// Figures for the progress and settings screens, computed from stored data (SPEC §7, §8).

import type { PassCriteria } from '../curriculum/ru.ts';
import type { KeyStat } from '../engine/index.ts';
import type { AppData, HistoryEntry } from '../storage/index.ts';

const RECENT = 20;

export interface Summary {
  lessons: number;
  tests: number;
  bestTestCpm: number | null;
  /** Mean accuracy of the last RECENT sessions. */
  recentAccuracy: number | null;
}

export function summary(data: AppData): Summary {
  const tests = data.history.filter((e) => e.mode === 'test');
  const recent = data.history.slice(-RECENT);
  return {
    lessons: data.history.length - tests.length,
    tests: tests.length,
    bestTestCpm: tests.length ? Math.max(...tests.map((e) => e.cpm)) : null,
    recentAccuracy: recent.length
      ? recent.reduce((sum, e) => sum + e.accuracy, 0) / recent.length
      : null,
  };
}

const EXERCISE: Record<string, string> = {
  keys: 'клавиши',
  combos: 'сочетания',
  words: 'слова',
  phrases: 'фразы',
};

/** "Урок 5, слова" or "Тест 30 с, частые слова". */
export function historyLabel(e: HistoryEntry): string {
  if (e.mode === 'lesson') {
    const type = e.exerciseType ? `, ${EXERCISE[e.exerciseType]}` : '';
    return `Урок ${e.stageId ?? ''}${type}`;
  }
  const m = /^(time|words)(\d+)-(words|classics)/.exec(e.config ?? '');
  if (!m) return 'Тест';
  const length = m[1] === 'time' ? `${m[2]} с` : `${m[2]} слов`;
  return `Тест ${length}, ${m[3] === 'words' ? 'частые слова' : 'классика'}`;
}

export interface KeyRow {
  char: string;
  hits: number;
  misses: number;
  /** 0–100. */
  accuracy: number;
  meanMs: number | null;
}

/** Keys pressed at least `minPresses` times, worst accuracy first, then slowest. */
export function keyAccuracy(stats: Record<string, KeyStat>, minPresses: number): KeyRow[] {
  return Object.entries(stats)
    .filter(([, s]) => s.hits + s.misses >= minPresses)
    .map(([char, s]) => ({
      char,
      hits: s.hits,
      misses: s.misses,
      accuracy: (s.hits / (s.hits + s.misses)) * 100,
      meanMs: s.timedHits ? s.totalMs / s.timedHits : null,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || (b.meanMs ?? 0) - (a.meanMs ?? 0));
}

const BANDS = ['1–5', '6–10', '11–15', '16–19'];

export type ParsedCriteria = { ok: true; criteria: PassCriteria } | { ok: false; error: string };

/** Validates the pass criteria typed in Settings. */
export function parseCriteria(accuracy: string, targets: string[]): ParsedCriteria {
  const whole = (s: string, min: number, max: number): number | null => {
    const n = Number(s.trim());
    return s.trim() !== '' && Number.isInteger(n) && n >= min && n <= max ? n : null;
  };
  const passAccuracy = whole(accuracy, 50, 100);
  if (passAccuracy === null) return { ok: false, error: 'Точность: целое число от 50 до 100.' };
  const cpmTargets: number[] = [];
  for (const [i, t] of targets.entries()) {
    const n = whole(t, 0, 1000);
    if (n === null) {
      return {
        ok: false,
        error: `Скорость для этапов ${BANDS[i] ?? ''}: целое число от 0 до 1000.`,
      };
    }
    cpmTargets.push(n);
  }
  return { ok: true, criteria: { passAccuracy, cpmTargets } };
}
