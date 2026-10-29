import { describe, expect, it } from 'vitest';
import { DEFAULT_CRITERIA, getStage } from '../src/curriculum/ru.ts';
import {
  evaluate,
  initialProgress,
  isCourseComplete,
  recordResult,
  remainingStages,
  shouldShowHint,
  type CourseProgress,
} from '../src/curriculum/progress.ts';
import { exerciseTypes } from '../src/textgen/index.ts';

const AT = '2026-10-29T12:00:00.000Z';

/** Passes every exercise of a stage. */
function passStage(progress: CourseProgress, stageId: number): CourseProgress {
  let p = progress;
  exerciseTypes(stageId).forEach((_, i) => {
    p = recordResult(p, stageId, i, { cpm: 300, accuracy: 100, passed: true }, AT);
  });
  return p;
}

describe('evaluate', () => {
  it('passes at exactly the thresholds', () => {
    expect(evaluate({ cpm: 60, accuracy: 95 }, getStage(1), DEFAULT_CRITERIA)).toEqual({
      passed: true,
      accuracyOk: true,
      cpmOk: true,
      cpmTarget: 60,
    });
  });

  it('reports which criterion failed', () => {
    expect(evaluate({ cpm: 200, accuracy: 94.9 }, getStage(1), DEFAULT_CRITERIA)).toMatchObject({
      passed: false,
      accuracyOk: false,
      cpmOk: true,
    });
    expect(evaluate({ cpm: 99, accuracy: 100 }, getStage(6), DEFAULT_CRITERIA)).toMatchObject({
      passed: false,
      cpmOk: false,
      cpmTarget: 100,
    });
  });

  it('uses the CPM target of the stage band', () => {
    const target = (id: number) =>
      evaluate({ cpm: 0, accuracy: 0 }, getStage(id), DEFAULT_CRITERIA).cpmTarget;
    expect([1, 5, 6, 10, 11, 15, 16, 19].map(target)).toEqual([
      60, 60, 100, 100, 140, 140, 160, 160,
    ]);
  });

  it('follows custom criteria from settings', () => {
    const criteria = { passAccuracy: 90, cpmTargets: [30, 30, 30, 30] };
    expect(evaluate({ cpm: 30, accuracy: 90 }, getStage(12), criteria).passed).toBe(true);
  });
});

describe('progress', () => {
  it('starts with stage 1 current and the rest locked', () => {
    const p = initialProgress();
    expect(p.stages[1]?.status).toBe('current');
    expect(p.stages[2]?.status).toBe('locked');
    expect(p.stages[19]?.status).toBe('locked');
  });

  it('records a passed exercise without finishing the stage', () => {
    const p = recordResult(initialProgress(), 1, 0, { cpm: 80, accuracy: 97, passed: true }, AT);
    expect(p.stages[1]).toMatchObject({
      status: 'current',
      exercisesPassed: [0],
      bestCpm: 80,
      bestAccuracy: 97,
    });
    expect(p.stages[2]?.status).toBe('locked');
  });

  it('ignores failed attempts for passing and bests', () => {
    const p = recordResult(initialProgress(), 1, 0, { cpm: 500, accuracy: 80, passed: false }, AT);
    expect(p.stages[1]).toMatchObject({ exercisesPassed: [], bestCpm: 0, bestAccuracy: 0 });
  });

  it('unlocks the next stage only when every exercise is passed', () => {
    let p = recordResult(initialProgress(), 1, 0, { cpm: 80, accuracy: 97, passed: true }, AT);
    p = recordResult(p, 1, 0, { cpm: 90, accuracy: 96, passed: true }, AT);
    expect(p.stages[2]?.status).toBe('locked');
    p = recordResult(p, 1, 1, { cpm: 70, accuracy: 99, passed: true }, AT);
    expect(p.stages[1]).toMatchObject({
      status: 'done',
      exercisesPassed: [0, 1],
      bestCpm: 90,
      bestAccuracy: 99,
    });
    expect(p.stages[2]?.status).toBe('current');
  });

  it('does not change the input object', () => {
    const before = initialProgress();
    recordResult(before, 1, 0, { cpm: 80, accuracy: 97, passed: true }, AT);
    expect(before.stages[1]?.exercisesPassed).toEqual([]);
  });

  it('ignores results for a locked stage', () => {
    const before = initialProgress();
    expect(recordResult(before, 3, 0, { cpm: 300, accuracy: 100, passed: true }, AT)).toEqual(
      before,
    );
  });

  it('keeps a replayed stage done and updates its bests', () => {
    let p = passStage(initialProgress(), 1);
    p = recordResult(p, 1, 0, { cpm: 400, accuracy: 100, passed: true }, AT);
    expect(p.stages[1]).toMatchObject({ status: 'done', bestCpm: 400 });
    expect(p.stages[2]?.status).toBe('current');
  });

  it('completes the course after stage 17 and lists remaining stages before that', () => {
    let p = initialProgress();
    for (let id = 1; id <= 16; id++) p = passStage(p, id);
    expect(isCourseComplete(p)).toBe(false);
    expect(remainingStages(p)).toEqual([17]);
    p = passStage(p, 17);
    expect(isCourseComplete(p)).toBe(true);
    expect(p.completedAt).toBe(AT);
    expect(remainingStages(p)).toEqual([]);
    expect(p.stages[18]?.status).toBe('current');
  });

  it('shows the hint after three failures', () => {
    expect(shouldShowHint(2)).toBe(false);
    expect(shouldShowHint(3)).toBe(true);
  });
});
