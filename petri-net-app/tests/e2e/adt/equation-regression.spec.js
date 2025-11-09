// @ts-check
import { test, expect } from '@playwright/test';

test('sandbox equation solving returns solutions', async ({ page }) => {
  await page.goto('/');
  const adtButton = page.getByTestId('toolbar-adt-manager');
  if (await adtButton.count()) {
    await adtButton.click();
  }
  await expect(page.getByText('Sandbox')).toBeVisible();
  await page.getByTestId('sandbox-expr').fill('x + 2 = y');
  await page.getByTestId('sandbox-bindings').fill('');
  await page.getByTestId('sandbox-run').click();
  const solutions = page.getByTestId('sandbox-solutions');
  await expect(solutions).toBeVisible({ timeout: 7000 });
  await expect(page.getByTestId('sandbox-sol-entry').first()).toBeVisible();
});

