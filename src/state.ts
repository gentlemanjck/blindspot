// App state shared by screens, loaded from and saved to localStorage (SPEC §8).

import type { PassCriteria } from './curriculum/ru.ts';
import { load, save, type AppData, type StorageLike, type Theme } from './storage/index.ts';

/** localStorage, or null when the browser blocks it (even reading the property can throw). */
function browserStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    const probe = '__typing-trainer-probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

const storage = browserStorage();
const loaded = load(storage);

export const store = {
  data: loaded.data,
  /** False when progress cannot be saved; the app shows a warning. */
  canSave: loaded.available,
  /** Failures in a row per exercise, `${stage}-${exercise}`; not persisted. */
  failures: new Map<string, number>(),
};

export function criteria(): PassCriteria {
  const s = store.data.settings;
  return { passAccuracy: s.passAccuracy, cpmTargets: s.cpmTargets };
}

/** Replaces the app data and writes it. Call after a finished exercise or test, not per key. */
export function commit(next: AppData): void {
  store.data = next;
  if (store.canSave) store.canSave = save(storage, next);
}

/** Sets the colour theme on the root element; 'auto' follows the system. */
export function applyTheme(theme: Theme): void {
  if (theme === 'auto') delete document.documentElement.dataset['theme'];
  else document.documentElement.dataset['theme'] = theme;
}
