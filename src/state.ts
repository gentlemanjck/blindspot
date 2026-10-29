// App state shared by screens. In memory for now; phase 6 adds localStorage (SPEC §8).

import { initialProgress, type CourseProgress } from './curriculum/progress.ts';
import { DEFAULT_CRITERIA, type PassCriteria } from './curriculum/ru.ts';

export interface Settings {
  showKeyboard: boolean;
  criteria: PassCriteria;
}

export const store = {
  progress: initialProgress() as CourseProgress,
  settings: { showKeyboard: true, criteria: DEFAULT_CRITERIA } as Settings,
  /** Failures in a row per exercise, `${stage}-${exercise}`; not persisted. */
  failures: new Map<string, number>(),
};
