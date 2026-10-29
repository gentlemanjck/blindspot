import { expect, test, type Page } from '@playwright/test';

/**
 * Types the current exercise. Playwright cannot press Cyrillic keys on a US keyboard, so the
 * keydown events the app listens to are dispatched directly, a few ms apart.
 */
async function typeExercise(page: Page): Promise<void> {
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

test('completing stage 1 by typing unlocks stage 2', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-stage="2"]')).toHaveClass(/locked/);

  await page.getByRole('link', { name: 'Начать с этапа 1' }).click();
  await expect(page).toHaveURL(/#\/lesson\/1\/1$/);

  await typeExercise(page);
  await expect(page.getByRole('dialog')).toContainText('зн/мин');
  await page.getByRole('button', { name: 'Дальше' }).click();
  await expect(page).toHaveURL(/#\/lesson\/1\/2$/);

  await typeExercise(page);
  await expect(page.getByRole('dialog')).toContainText('зн/мин');
  await page.getByRole('button', { name: 'Дальше' }).click();

  // Stage 1 has two exercises, so "Next" leads to stage 2.
  await expect(page).toHaveURL(/#\/lesson\/2\/1$/);
  await page.getByRole('link', { name: 'Курс' }).click();
  await expect(page.locator('[data-stage="1"]')).toHaveClass(/done/);
  await expect(page.locator('[data-stage="2"]')).toHaveClass(/current/);
});

test('a wrong key does not advance and is counted as an error', async ({ page }) => {
  await page.goto('/#/lesson/1/1');
  const line = page.getByTestId('text-line');
  await expect(line.locator('.cell.cur')).toHaveCount(1);
  await page.evaluate(() =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'л', bubbles: true })),
  );
  await expect(line.locator('.cell').first()).toHaveClass(/cur/);
  await expect(line.locator('.cell').first()).toHaveClass(/err/);
});

test('Latin input shows the layout warning', async ({ page }) => {
  await page.goto('/#/lesson/1/1');
  await page.keyboard.press('f');
  await expect(page.getByRole('status')).toContainText('русскую раскладку');
  await expect(page.getByTestId('text-line').locator('.cell').first()).not.toHaveClass(/err/);
});

test('a locked stage redirects to the course map', async ({ page }) => {
  await page.goto('/#/lesson/5/1');
  await expect(page).toHaveURL(/#\/$/);
});
