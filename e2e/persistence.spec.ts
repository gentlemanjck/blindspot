import { expect, test } from '@playwright/test';
import { typeExercise } from './helpers.ts';

test('progress survives a page reload', async ({ page }) => {
  await page.goto('./#/lesson/1/1');
  await typeExercise(page);
  await expect(page.getByRole('dialog')).toContainText('зн/мин');

  await page.goto('./');
  await page.reload();
  await expect(page.locator('[data-stage="1"]')).toContainText('1 из 2');
  await expect(page.getByRole('link', { name: 'Продолжить этап 1' })).toHaveAttribute(
    'href',
    '#/lesson/1/2',
  );
  await expect(page.getByText('Прогресс не сохранится')).toBeHidden();
});

test('the app works with localStorage blocked and says progress will not be saved', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('./');
  await expect(page.getByText('Прогресс не сохранится')).toBeVisible();

  await page.getByRole('link', { name: 'Начать с этапа 1' }).click();
  await typeExercise(page);
  await expect(page.getByRole('dialog')).toContainText('зн/мин');
  await page.getByRole('button', { name: 'Дальше' }).click();
  await expect(page).toHaveURL(/#\/lesson\/1\/2$/);
  expect(errors).toEqual([]);
});
