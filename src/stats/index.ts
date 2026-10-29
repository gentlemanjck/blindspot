// Figures for the progress and settings screens, computed from stored data (SPEC §7, §8).

import type { PassCriteria } from '../curriculum/ru.ts';
import type { KeyStat } from '../engine/index.ts';
import { locate } from '../layouts/ru-mac-iso.ts';
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

export interface KeyHeat {
  /** Physical key (KeyboardEvent.code). */
  code: string;
  hits: number;
  misses: number;
  /** 0–100. */
  accuracy: number;
  meanMs: number | null;
}

/**
 * Per-key stats summed by physical key for the keyboard heatmap: "а" and "А" are one key.
 * Keys pressed fewer than `minPresses` times are left out.
 */
export function keyHeat(stats: Record<string, KeyStat>, minPresses: number): KeyHeat[] {
  const byCode = new Map<string, KeyStat>();
  for (const [char, s] of Object.entries(stats)) {
    const code = locate(char)?.key.code;
    if (!code) continue;
    const sum = byCode.get(code) ?? { hits: 0, misses: 0, totalMs: 0, timedHits: 0 };
    byCode.set(code, {
      hits: sum.hits + s.hits,
      misses: sum.misses + s.misses,
      totalMs: sum.totalMs + s.totalMs,
      timedHits: sum.timedHits + s.timedHits,
    });
  }
  return [...byCode]
    .filter(([, s]) => s.hits + s.misses >= minPresses)
    .map(([code, s]) => ({
      code,
      hits: s.hits,
      misses: s.misses,
      accuracy: (s.hits / (s.hits + s.misses)) * 100,
      meanMs: s.timedHits ? s.totalMs / s.timedHits : null,
    }));
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
