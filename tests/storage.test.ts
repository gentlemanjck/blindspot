import { describe, expect, it } from 'vitest';
import { recordResult } from '../src/curriculum/progress.ts';
import type { KeyStat } from '../src/engine/index.ts';
import {
  addSession,
  defaultData,
  HISTORY_LIMIT,
  load,
  migrate,
  resetProgress,
  save,
  SCHEMA_VERSION,
  STORAGE_KEY,
  type HistoryEntry,
  type StorageLike,
} from '../src/storage/index.ts';

class MemoryStorage implements StorageLike {
  readonly map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

class ThrowingStorage implements StorageLike {
  getItem(): string | null {
    throw new Error('denied');
  }
  setItem(): void {
    throw new Error('quota');
  }
  removeItem(): void {
    throw new Error('denied');
  }
}

const AT = '2026-10-29T12:00:00.000Z';
const entry: HistoryEntry = {
  at: AT,
  mode: 'lesson',
  stageId: 1,
  exerciseType: 'keys',
  cpm: 120,
  rawCpm: 130,
  accuracy: 96,
  durationMs: 20_000,
};

describe('load and save', () => {
  it('returns defaults when nothing is stored', () => {
    const r = load(new MemoryStorage());
    expect(r).toMatchObject({ available: true, recovered: false });
    expect(r.data).toEqual(defaultData());
  });

  it('round-trips data', () => {
    const storage = new MemoryStorage();
    const data = addSession(defaultData(), entry, new Map());
    data.course = recordResult(data.course, 1, 0, { cpm: 120, accuracy: 96, passed: true }, AT);
    expect(save(storage, data)).toBe(true);
    expect(load(storage).data).toEqual(data);
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}').schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('recovers from corrupt JSON with defaults', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{not json');
    expect(load(storage)).toEqual({ data: defaultData(), available: true, recovered: true });
  });

  it('keeps working when storage throws or is missing', () => {
    expect(load(new ThrowingStorage())).toMatchObject({ available: false, data: defaultData() });
    expect(load(null)).toMatchObject({ available: false, data: defaultData() });
    expect(save(new ThrowingStorage(), defaultData())).toBe(false);
    expect(save(null, defaultData())).toBe(false);
  });
});

describe('migrate', () => {
  it('fills missing fields with defaults', () => {
    const data = migrate({ schemaVersion: 1, settings: { showKeyboard: false } });
    expect(data.settings.showKeyboard).toBe(false);
    expect(data.settings.passAccuracy).toBe(95);
    expect(data.course.stages[1]?.status).toBe('current');
    expect(data.history).toEqual([]);
  });

  it('drops invalid values instead of trusting them', () => {
    const data = migrate({
      schemaVersion: 1,
      settings: { passAccuracy: 'high', theme: 'neon', cpmTargets: [1, 'x'] },
      course: {
        stages: { 1: { status: 'weird', exercisesPassed: [0, 7, -1, 'a'], bestCpm: 'x' } },
      },
      history: [entry, { at: 5 }, null],
      keyStats: { а: { hits: 3, misses: 1, totalMs: 900, timedHits: 2 }, о: 'bad' },
    });
    expect(data.settings.passAccuracy).toBe(95);
    expect(data.settings.theme).toBe('auto');
    expect(data.settings.cpmTargets).toEqual([60, 100, 140, 160]);
    expect(data.course.stages[1]).toMatchObject({
      status: 'current',
      exercisesPassed: [0],
      bestCpm: 0,
    });
    expect(data.history).toEqual([entry]);
    expect(data.keyStats).toEqual({ а: { hits: 3, misses: 1, totalMs: 900, timedHits: 2 } });
  });

  it('opens the stage after a done one, so progress is never stuck', () => {
    const data = migrate({
      schemaVersion: 1,
      course: {
        stages: { 1: { status: 'done', exercisesPassed: [0, 1], bestCpm: 80, bestAccuracy: 97 } },
      },
    });
    expect(data.course.stages[1]?.status).toBe('done');
    expect(data.course.stages[2]?.status).toBe('current');
    expect(data.course.stages[3]?.status).toBe('locked');
  });

  it('adds stages that are missing from stored data as locked and ignores unknown ones', () => {
    const data = migrate({ schemaVersion: 1, course: { stages: { 99: { status: 'done' } } } });
    expect(data.course.stages[99]).toBeUndefined();
    expect(data.course.stages[19]?.status).toBe('locked');
  });

  it('keeps v1 progress when every exercise type became two exercises', () => {
    const data = migrate({
      schemaVersion: 1,
      course: {
        stages: {
          1: { status: 'done', exercisesPassed: [0, 1], bestCpm: 80, bestAccuracy: 97 },
          2: { status: 'current', exercisesPassed: [0, 1], bestCpm: 70, bestAccuracy: 96 },
        },
      },
    });
    expect(data.schemaVersion).toBe(SCHEMA_VERSION);
    expect(data.course.stages[1]).toMatchObject({ status: 'done', exercisesPassed: [0, 1, 2, 3] });
    expect(data.course.stages[2]).toMatchObject({ status: 'current', exercisesPassed: [0, 2] });
  });

  it('marks the hands screen as seen for v2 users who have already typed', () => {
    expect(migrate({ schemaVersion: 2, history: [entry] }).handsSeen).toBe(true);
    expect(migrate({ schemaVersion: 2, history: [] }).handsSeen).toBe(false);
  });

  it('reads the hands flag and ignores invalid values', () => {
    expect(migrate({ schemaVersion: SCHEMA_VERSION, handsSeen: true }).handsSeen).toBe(true);
    expect(migrate({ schemaVersion: SCHEMA_VERSION, handsSeen: 'yes' }).handsSeen).toBe(false);
  });

  it('starts fresh for unknown or future schema versions', () => {
    expect(
      migrate({ schemaVersion: SCHEMA_VERSION + 1, settings: { showKeyboard: false } }),
    ).toEqual(defaultData());
    expect(migrate('nonsense')).toEqual(defaultData());
  });
});

describe('addSession', () => {
  it('appends history and caps it', () => {
    let data = defaultData();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      data = addSession(data, { ...entry, cpm: i }, new Map());
    }
    expect(data.history).toHaveLength(HISTORY_LIMIT);
    expect(data.history.at(-1)?.cpm).toBe(HISTORY_LIMIT + 4);
    expect(data.history[0]?.cpm).toBe(5);
  });

  it('accumulates per-key stats across sessions', () => {
    const perKey = new Map<string, KeyStat>([
      ['а', { hits: 2, misses: 1, totalMs: 400, timedHits: 2 }],
    ]);
    let data = addSession(defaultData(), entry, perKey);
    data = addSession(data, entry, perKey);
    expect(data.keyStats['а']).toEqual({ hits: 4, misses: 2, totalMs: 800, timedHits: 4 });
  });

  it('does not change the input', () => {
    const before = defaultData();
    addSession(before, entry, new Map([['а', { hits: 1, misses: 0, totalMs: 0, timedHits: 0 }]]));
    expect(before).toEqual(defaultData());
  });
});

describe('resetProgress', () => {
  it('clears progress but keeps settings and the hands flag', () => {
    let data = addSession(defaultData(), entry, new Map());
    data = { ...data, settings: { ...data.settings, showKeyboard: false }, handsSeen: true };
    data.course = recordResult(data.course, 1, 0, { cpm: 120, accuracy: 96, passed: true }, AT);
    const reset = resetProgress(data);
    expect(reset).toEqual({ ...defaultData(), settings: data.settings, handsSeen: true });
  });
});
