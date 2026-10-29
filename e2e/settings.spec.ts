import { expect, test } from '@playwright/test';
import { typeExercise } from './helpers.ts';

test('a finished exercise shows up in the progress history', async ({ page }) => {
  await page.goto('/#/stats');
  await expect(page.getByText('после первого упражнения')).toBeVisible();

  await page.goto('/#/lesson/1/1');
  await typeExercise(page);
  await expect(page.getByRole('dialog')).toContainText('зн/мин');

  await page.goto('/#/stats');
  await expect(page.getByRole('table').first()).toContainText('Урок 1, клавиши');
  await expect(page.getByRole('button', { name: 'Показать ещё' })).toBeHidden();
});

test('a stricter accuracy criterion fails an exercise with one mistake', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByLabel('Точность').fill('100');
  await page.getByRole('button', { name: 'Сохранить критерии' }).click();
  await expect(page.getByText('Критерии сохранены.')).toBeVisible();

  await page.goto('/#/lesson/1/1');
  await page.evaluate(() =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'л', bubbles: true })),
  );
  await typeExercise(page);
  const result = page.getByRole('dialog');
  await expect(result).toContainText('нужно 100 %');
  await expect(page.getByRole('button', { name: 'Дальше' })).toHaveCount(0);
});

test('invalid criteria are explained and not saved', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByLabel('Этапы 6–10').fill('5000');
  await page.getByRole('button', { name: 'Сохранить критерии' }).click();
  await expect(page.getByText('Скорость для этапов 6–10: целое число от 0 до 1000.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Этапы 6–10')).toHaveValue('100');
});

test('the theme applies at once and survives a reload', async ({ page }) => {
  await page.goto('/#/settings');
  // e2e runs the production build, where the dev-only unlock must not exist.
  await expect(page.getByText('Для разработки')).toHaveCount(0);
  await page.getByRole('radio', { name: 'Тёмная' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('radio', { name: 'Тёмная' })).toHaveAttribute('aria-checked', 'true');
});

test('resetting progress asks first and returns the course to stage 1', async ({ page }) => {
  await page.goto('/#/lesson/1/1');
  await typeExercise(page);
  await expect(page.getByRole('dialog')).toContainText('зн/мин');

  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Сбросить прогресс' }).click();
  await page.getByRole('button', { name: 'Отмена' }).click();
  await page.goto('/');
  await expect(page.locator('[data-stage="1"]')).toContainText('1 из 2');

  await page.goto('/#/settings');
  await page.getByRole('button', { name: 'Сбросить прогресс' }).click();
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await expect(page.getByText('Прогресс сброшен.')).toBeVisible();
  await page.goto('/');
  await expect(page.locator('[data-stage="1"]')).toContainText('0 из 2');
  await page.goto('/#/stats');
  await expect(page.getByText('после первого упражнения')).toBeVisible();
});
