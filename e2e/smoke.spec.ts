import { expect, test } from '@playwright/test';

test('app opens', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Слепая печать' })).toBeVisible();
});
