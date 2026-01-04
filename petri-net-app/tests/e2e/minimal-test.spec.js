// Minimal test to verify Playwright works
import { test } from '@playwright/test';

test('minimal test', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(1000);
});
