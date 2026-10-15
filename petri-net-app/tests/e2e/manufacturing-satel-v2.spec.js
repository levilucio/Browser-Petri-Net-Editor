import { test, expect } from '@playwright/test';

test('manufacturing example loads model-owned V2 intentions', async ({ page }) => {
  await page.goto('/');
  const examples = page.getByRole('button', { name: 'Examples', exact: true });
  if (await page.getByLabel('Open toolbar menu').isVisible()) await page.getByLabel('Open toolbar menu').click();
  await examples.click();
  await page.getByTestId('example-manufacturing-workflow').click();
  const desktop = page.getByTestId('toolbar-satel');
  if (await desktop.isVisible()) await desktop.click();
  else {
    await page.getByLabel('Open toolbar menu').click();
    await page.getByTestId('toolbar-satel-mobile').click();
  }
  await page.getByRole('button', { name: 'V2 intentions' }).click();
  const panel = page.getByRole('complementary', { name: 'SATEL Testing' });
  await expect(panel.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(12);
  await expect(panel.getByRole('button', { name: 'Generate and validate V2 suite' })).toBeEnabled();
  await expect(panel.getByRole('button', { name: /Create V1/ })).toHaveCount(0);
  // Manufacturing semantic failures remain tracked by the unit suites; this UI
  // test must not assert that unvalidated candidates all pass.
});
