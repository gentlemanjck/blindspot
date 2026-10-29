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
