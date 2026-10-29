// Pass criteria and course progress (SPEC §4). Pure functions; storage comes in phase 6.

import { exerciseTypes } from '../textgen/index.ts';
import { COURSE_COMPLETE_STAGE, cpmTarget, STAGES, type PassCriteria, type Stage } from './ru.ts';

export type StageStatus = 'locked' | 'current' | 'done';

export interface StageProgress {
  status: StageStatus;
  /** Indices into exerciseTypes(stageId), sorted. */
  exercisesPassed: number[];
  bestCpm: number;
  bestAccuracy: number;
}

export interface CourseProgress {
  stages: Record<number, StageProgress>;
  /** ISO time when stage COURSE_COMPLETE_STAGE was finished. */
  completedAt?: string;
}

export interface ExerciseResult {
  cpm: number;
  accuracy: number;
  passed: boolean;
}

export interface Evaluation {
  passed: boolean;
  accuracyOk: boolean;
  cpmOk: boolean;
  cpmTarget: number;
}

/** After this many failures in a row the lesson shows a "slow down" hint. */
export const HINT_AFTER_FAILURES = 3;

export function evaluate(
  result: { cpm: number; accuracy: number },
  stage: Stage,
  criteria: PassCriteria,
): Evaluation {
  const target = cpmTarget(stage, criteria);
  const accuracyOk = result.accuracy >= criteria.passAccuracy;
  const cpmOk = result.cpm >= target;
  return { passed: accuracyOk && cpmOk, accuracyOk, cpmOk, cpmTarget: target };
}

export function shouldShowHint(failuresInRow: number): boolean {
  return failuresInRow >= HINT_AFTER_FAILURES;
}

export function initialProgress(): CourseProgress {
  const stages: Record<number, StageProgress> = {};
  for (const stage of STAGES) {
    stages[stage.id] = {
      status: stage.id === STAGES[0]?.id ? 'current' : 'locked',
      exercisesPassed: [],
      bestCpm: 0,
      bestAccuracy: 0,
    };
  }
  return { stages };
}

/** Returns new progress with the result applied; the input is not changed. */
export function recordResult(
  progress: CourseProgress,
  stageId: number,
  exerciseIndex: number,
  result: ExerciseResult,
  at: string,
): CourseProgress {
  const current = progress.stages[stageId];
  if (!current || current.status === 'locked' || !result.passed) return progress;

  const passed = [...new Set([...current.exercisesPassed, exerciseIndex])].sort((a, b) => a - b);
  const updated: StageProgress = {
    status: current.status,
    exercisesPassed: passed,
    bestCpm: Math.max(current.bestCpm, result.cpm),
    bestAccuracy: Math.max(current.bestAccuracy, result.accuracy),
  };
  const stages = { ...progress.stages, [stageId]: updated };

  if (updated.status === 'current' && passed.length >= exerciseTypes(stageId).length) {
    updated.status = 'done';
    const next = stages[stageId + 1];
    if (next?.status === 'locked') stages[stageId + 1] = { ...next, status: 'current' };
  }

  const next: CourseProgress = { ...progress, stages };
  if (!next.completedAt && remainingStages(next).length === 0) next.completedAt = at;
  return next;
}

/** Stages still needed to complete the course (for the speed test lock screen). */
export function remainingStages(progress: CourseProgress): number[] {
  return STAGES.filter(
    (s) => s.id <= COURSE_COMPLETE_STAGE && progress.stages[s.id]?.status !== 'done',
  ).map((s) => s.id);
}

export function isCourseComplete(progress: CourseProgress): boolean {
  return remainingStages(progress).length === 0;
}
