import { expect, test } from '@playwright/test';
import { typeExercise } from './helpers.ts';

test('the hands screen comes once, before the first exercise', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: 'Начать курс' }).click();
  await expect(page).toHaveURL(/#\/hands$/);
  await expect(page.getByRole('heading', { name: 'Руки на клавиатуре' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Исходная позиция' })).toContainText('А · О');

  await page.getByRole('link', { name: 'Понятно, к упражнению' }).click();
  await expect(page).toHaveURL(/#\/lesson\/1\/1$/);

  await page.goto('./');
  await page.getByRole('link', { name: 'Начать курс' }).click();
  await expect(page).toHaveURL(/#\/lesson\/1\/1$/);

  // The course map keeps a way back to it.
  await page.goto('./');
  await page.getByRole('link', { name: 'Как держать руки' }).click();
  await expect(page).toHaveURL(/#\/hands$/);
});

test('finishing stage 17 shows the course-complete poster', async ({ page }) => {
  const stages: Record<number, object> = {};
  for (let id = 1; id <= 16; id++) {
    stages[id] = { status: 'done', exercisesPassed: [], bestCpm: 150 + id, bestAccuracy: 97 };
  }
  stages[17] = { status: 'current', exercisesPassed: [0, 1, 2, 3, 4, 5, 6] };
  await page.addInitScript(
    (data) => {
      if (localStorage.getItem('typing-trainer:v1') === null)
        localStorage.setItem('typing-trainer:v1', data);
    },
    JSON.stringify({ schemaVersion: 3, handsSeen: true, course: { stages } }),
  );

  await page.goto('./#/lesson/17/8');
  await typeExercise(page);

  await expect(page).toHaveURL(/#\/complete$/);
  await expect(page.getByRole('heading', { name: 'Курс пройден' })).toBeVisible();
  await expect(page.getByText('Этап 17 из 17')).toBeVisible();
  await page.getByRole('link', { name: 'К тесту скорости' }).click();
  await expect(page).toHaveURL(/#\/test$/);
});

test('the course-complete poster is not open before the course is done', async ({ page }) => {
  await page.goto('./#/complete');
  await expect(page).toHaveURL(/#\/$/);
});

test('empty progress shows an illustration and empty figures', async ({ page }) => {
  await page.goto('./#/stats');
  await expect(page.getByRole('heading', { name: 'Здесь будет твой путь' })).toBeVisible();
  await expect(page.getByText('1 / 17')).toBeVisible();
  await page.getByRole('link', { name: 'Начать первое упражнение' }).click();
  await expect(page).toHaveURL(/#\/hands$/);
});
