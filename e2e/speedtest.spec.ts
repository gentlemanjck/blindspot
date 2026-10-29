import { expect, test, type Page } from '@playwright/test';

/** Types the first n characters of the test text at once (the fake clock does not advance). */
async function typeChars(page: Page, n: number): Promise<void> {
  await page.evaluate((count) => {
    const text = document.querySelector<HTMLElement>('[data-testid=text-line]')?.dataset['text'];
    for (const key of (text ?? '').slice(0, count)) {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
    }
  }, n);
}

test('the speed test is locked until the course is complete', async ({ page }) => {
  await page.goto('/#/test');
  await expect(page.getByText('Откроется, когда вы пройдёте этапы 1–17')).toBeVisible();
  await expect(page.getByTestId('text-line')).toHaveCount(0);
});

test('a 15 second test ends with a result', async ({ page }) => {
  await page.clock.install();
  await page.goto('/?unlock=1#/test');
  await page.getByRole('button', { name: '15', exact: true }).click();
  await expect(page.getByRole('button', { name: '15', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await typeChars(page, 40);
  await page.clock.runFor(16_000);

  const result = page.getByRole('dialog');
  await expect(result).toContainText('Новый рекорд');
  await expect(result).toContainText('зн/мин');
  await expect(result).toContainText('Ошибок: 0');
});

test('Tab restarts with new text, and options persist', async ({ page }) => {
  await page.goto('/?unlock=1#/test');
  const line = page.getByTestId('text-line');
  const before = await line.getAttribute('data-text');
  await page.keyboard.press('Tab');
  await expect(line).not.toHaveAttribute('data-text', before ?? '');

  await page.getByRole('button', { name: 'Слова', exact: true }).click();
  await page.getByRole('button', { name: '25', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '25', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect((await line.getAttribute('data-text'))?.split(' ')).toHaveLength(25);
});
