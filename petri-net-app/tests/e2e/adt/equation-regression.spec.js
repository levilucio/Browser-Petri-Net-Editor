// @ts-check
import { test, expect } from '@playwright/test';
import { getVisibleToolbarButton, waitForAppReady } from '../../helpers.js';

test('sandbox equation solving returns solutions', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);
  
  // getVisibleToolbarButton will automatically open mobile menu if needed
  const adtButton = await getVisibleToolbarButton(page, 'toolbar-adt-manager');
  // On mobile, use force click to bypass viewport restrictions
  const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
  if (isMobile) {
    await adtButton.click({ force: true });
  } else {
    await adtButton.click();
  }
  await expect(page.getByText('Sandbox')).toBeVisible();
  await page.getByTestId('sandbox-expr').fill('x + 2 = y');
  await page.getByTestId('sandbox-bindings').fill('');
  const runBtn = page.getByTestId('sandbox-run');
  if (isMobile) {
    await runBtn.evaluate(node => node.click());
  } else {
    await runBtn.click();
  }
  const solutions = page.getByTestId('sandbox-solutions');
  // Wait at least 5 seconds for Z3 to solve the equation
  await expect(solutions).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('sandbox-sol-entry').first()).toBeVisible({ timeout: 5000 });
});

