// Persistence in localStorage under one key (SPEC §8). Pure functions over a StorageLike, so
// tests use an in-memory fake and a broken or missing storage never crashes the app.

import {
  initialProgress,
  type CourseProgress,
  type StageProgress,
  type StageStatus,
} from '../curriculum/progress.ts';
import { DEFAULT_CRITERIA, EXERCISE_TYPES, STAGES, type ExerciseType } from '../curriculum/ru.ts';
import type { KeyStat } from '../engine/index.ts';
import { exerciseTypes } from '../textgen/index.ts';

export const STORAGE_KEY = 'typing-trainer:v1';
export const SCHEMA_VERSION = 1;
export const HISTORY_LIMIT = 500;

export type Theme = 'auto' | 'light' | 'dark';

export interface TestSettings {
  lengthType: 'time' | 'words';
  length: number;
  source: 'words' | 'classics';
  capitals: boolean;
  punctuation: boolean;
  /** Accept е for ё. */
  yoOptional: boolean;
}

export interface Settings {
  showKeyboard: boolean;
  theme: Theme;
  passAccuracy: number;
  cpmTargets: number[];
  test: TestSettings;
  /** Dev builds only: open the speed test without finishing the course (SPEC §5). */
  devUnlock: boolean;
}

export interface HistoryEntry {
  /** ISO time. */
  at: string;
  mode: 'lesson' | 'test';
  stageId?: number;
  exerciseType?: ExerciseType;
  cpm: number;
  rawCpm: number;
  accuracy: number;
  durationMs: number;
  /** Speed test configuration key. */
  config?: string;
}

export interface RecordEntry {
  cpm: number;
  accuracy: number;
  at: string;
}

export interface AppData {
  schemaVersion: typeof SCHEMA_VERSION;
  settings: Settings;
  course: CourseProgress;
  keyStats: Record<string, KeyStat>;
  /** Oldest first, at most HISTORY_LIMIT entries. */
  history: HistoryEntry[];
  records: Record<string, RecordEntry>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LoadResult {
  data: AppData;
  /** False when storage is missing or throws: progress will not be saved. */
  available: boolean;
  /** True when stored data was unreadable and defaults were used. */
  recovered: boolean;
}

export function defaultData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      showKeyboard: true,
      theme: 'auto',
      passAccuracy: DEFAULT_CRITERIA.passAccuracy,
      cpmTargets: [...DEFAULT_CRITERIA.cpmTargets],
      test: {
        lengthType: 'time',
        length: 30,
        source: 'words',
        capitals: false,
        punctuation: false,
        yoOptional: true,
      },
      devUnlock: false,
    },
    course: initialProgress(),
    keyStats: {},
    history: [],
    records: {},
  };
}

export function load(storage: StorageLike | null): LoadResult {
  if (!storage) return { data: defaultData(), available: false, recovered: false };
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { data: defaultData(), available: false, recovered: false };
  }
  if (raw === null) return { data: defaultData(), available: true, recovered: false };
  try {
    return { data: migrate(JSON.parse(raw)), available: true, recovered: false };
  } catch {
    return { data: defaultData(), available: true, recovered: true };
  }
}

/** Returns false when the data could not be written. */
export function save(storage: StorageLike | null, data: AppData): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Appends a finished exercise or test to history and adds its key stats. */
export function addSession(
  data: AppData,
  entry: HistoryEntry,
  perKey: ReadonlyMap<string, KeyStat>,
): AppData {
  const keyStats = { ...data.keyStats };
  for (const [ch, s] of perKey) {
    const prev = keyStats[ch] ?? { hits: 0, misses: 0, totalMs: 0, timedHits: 0 };
    keyStats[ch] = {
      hits: prev.hits + s.hits,
      misses: prev.misses + s.misses,
      totalMs: prev.totalMs + s.totalMs,
      timedHits: prev.timedHits + s.timedHits,
    };
  }
  return { ...data, keyStats, history: [...data.history, entry].slice(-HISTORY_LIMIT) };
}

/** Clears course, stats, history and records; keeps settings. */
export function resetProgress(data: AppData): AppData {
  return { ...defaultData(), settings: data.settings };
}

// ---------- Migration and validation ----------

/**
 * Turns whatever was stored into valid AppData. Each future schema change adds a step
 * `n → n + 1` here; unknown or newer versions start fresh rather than misreading data.
 */
export function migrate(raw: unknown): AppData {
  if (!isObject(raw) || raw['schemaVersion'] !== SCHEMA_VERSION) return defaultData();
  const d = defaultData();
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: readSettings(raw['settings'], d.settings),
    course: readCourse(raw['course']),
    keyStats: readKeyStats(raw['keyStats']),
    history: readHistory(raw['history']),
    records: readRecords(raw['records']),
  };
}

type Obj = Record<string, unknown>;

const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, def: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : def;
const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);
const oneOf = <T extends string>(v: unknown, options: readonly T[], def: T): T =>
  options.includes(v as T) ? (v as T) : def;
const obj = (v: unknown): Obj => (isObject(v) ? v : {});

function readSettings(raw: unknown, d: Settings): Settings {
  const s = obj(raw);
  const t = obj(s['test']);
  const targets = s['cpmTargets'];
  const validTargets =
    Array.isArray(targets) &&
    targets.length === d.cpmTargets.length &&
    targets.every((x) => typeof x === 'number' && Number.isFinite(x) && x >= 0);
  return {
    showKeyboard: bool(s['showKeyboard'], d.showKeyboard),
    theme: oneOf(s['theme'], ['auto', 'light', 'dark'], d.theme),
    passAccuracy: num(s['passAccuracy'], d.passAccuracy),
    cpmTargets: validTargets ? (targets as number[]) : d.cpmTargets,
    test: {
      lengthType: oneOf(t['lengthType'], ['time', 'words'], d.test.lengthType),
      length: num(t['length'], d.test.length),
      source: oneOf(t['source'], ['words', 'classics'], d.test.source),
      capitals: bool(t['capitals'], d.test.capitals),
      punctuation: bool(t['punctuation'], d.test.punctuation),
      yoOptional: bool(t['yoOptional'], d.test.yoOptional),
    },
    devUnlock: bool(s['devUnlock'], d.devUnlock),
  };
}

/** Rebuilds course progress against the current curriculum and repairs unlock order. */
function readCourse(raw: unknown): CourseProgress {
  const c = obj(raw);
  const stored = obj(c['stages']);
  const course = initialProgress();
  let previousDone = true;
  for (const stage of STAGES) {
    const s = obj(stored[stage.id]);
    const count = exerciseTypes(stage.id).length;
    const passed = Array.isArray(s['exercisesPassed'])
      ? [...new Set(s['exercisesPassed'])]
          .filter((i): i is number => Number.isInteger(i) && i >= 0 && i < count)
          .sort((a, b) => a - b)
      : [];
    let status: StageStatus = oneOf(s['status'], ['locked', 'current', 'done'], 'locked');
    if (status === 'locked' && previousDone) status = 'current';
    if (status !== 'locked' && !previousDone) status = 'locked';
    const progress: StageProgress = {
      status,
      exercisesPassed: passed,
      bestCpm: num(s['bestCpm'], 0),
      bestAccuracy: num(s['bestAccuracy'], 0),
    };
    course.stages[stage.id] = progress;
    previousDone = status === 'done';
  }
  if (typeof c['completedAt'] === 'string') course.completedAt = c['completedAt'];
  return course;
}

function readKeyStats(raw: unknown): Record<string, KeyStat> {
  const out: Record<string, KeyStat> = {};
  for (const [ch, v] of Object.entries(obj(raw))) {
    if (!isObject(v) || [...ch].length !== 1) continue;
    out[ch] = {
      hits: num(v['hits'], 0),
      misses: num(v['misses'], 0),
      totalMs: num(v['totalMs'], 0),
      timedHits: num(v['timedHits'], 0),
    };
  }
  return out;
}

function readHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: HistoryEntry[] = [];
  for (const v of raw) {
    if (!isObject(v) || typeof v['at'] !== 'string') continue;
    const mode = oneOf(v['mode'], ['lesson', 'test'], 'lesson');
    const e: HistoryEntry = {
      at: v['at'],
      mode,
      cpm: num(v['cpm'], 0),
      rawCpm: num(v['rawCpm'], 0),
      accuracy: num(v['accuracy'], 0),
      durationMs: num(v['durationMs'], 0),
    };
    if (typeof v['stageId'] === 'number') e.stageId = v['stageId'];
    if (EXERCISE_TYPES.includes(v['exerciseType'] as ExerciseType)) {
      e.exerciseType = v['exerciseType'] as ExerciseType;
    }
    if (typeof v['config'] === 'string') e.config = v['config'];
    out.push(e);
  }
  return out.slice(-HISTORY_LIMIT);
}

function readRecords(raw: unknown): Record<string, RecordEntry> {
  const out: Record<string, RecordEntry> = {};
  for (const [key, v] of Object.entries(obj(raw))) {
    if (!isObject(v) || typeof v['at'] !== 'string') continue;
    out[key] = { cpm: num(v['cpm'], 0), accuracy: num(v['accuracy'], 0), at: v['at'] };
  }
  return out;
}

// ---------- Speed test records ----------

/** One personal record per combination of options that changes the result. */
export function configKey(t: TestSettings): string {
  return [
    `${t.lengthType}${t.length}`,
    t.source,
    t.capitals ? 'caps' : '',
    t.punctuation ? 'punct' : '',
    t.yoOptional ? '' : 'yo',
  ]
    .filter(Boolean)
    .join('-');
}

/** Stores the result if it beats the record for `key` by CPM. */
export function updateRecord(
  records: Record<string, RecordEntry>,
  key: string,
  result: RecordEntry,
): { records: Record<string, RecordEntry>; isRecord: boolean } {
  const prev = records[key];
  if (prev && prev.cpm >= result.cpm) return { records, isRecord: false };
  return { records: { ...records, [key]: result }, isRecord: true };
}
