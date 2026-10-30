import type { Page } from '@playwright/test';

/**
 * Types the current exercise. Playwright cannot press Cyrillic keys on a US keyboard, so the
 * keydown events the app listens to are dispatched directly, a few ms apart.
 */
export async function typeExercise(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const line = document.querySelector<HTMLElement>('[data-testid=text-line]');
    const text = line?.dataset['text'] ?? '';
    for (const key of text) {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
      await new Promise((r) => setTimeout(r, 5));
    }
  });
}

/**
 * Marks the "hands on the keyboard" screen as seen, so tests can open exercise 1 of stage 1
 * directly. Only seeds empty storage, so reloads keep the progress a test has made.
 */
export async function skipHands(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      const key = 'typing-trainer:v1';
      if (localStorage.getItem(key) === null)
        localStorage.setItem(key, JSON.stringify({ schemaVersion: 3, handsSeen: true }));
    } catch {
      // Storage blocked: the hands screen shows once per page load instead.
    }
  });
}
