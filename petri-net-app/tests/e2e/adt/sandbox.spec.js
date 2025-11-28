// @ts-check
import { test, expect } from '@playwright/test';
import { waitForAppReady, getVisibleToolbarButton } from '../../helpers.js';

async function openAdtPanel(page) {
  await page.goto('/');
  await waitForAppReady(page);
  // Open ADT panel via toolbar button labeled "ADT" if present
  const adtButton = await getVisibleToolbarButton(page, 'toolbar-adt-manager');
  // On mobile, use force click to bypass viewport restrictions
  const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
  if (isMobile) {
    await adtButton.click({ force: true });
  } else {
    await adtButton.click();
  }
  // Wait for sandbox input
  await expect(page.getByText('Sandbox')).toBeVisible();
}

async function setSandboxInputs(page, expr, bindings) {
  // Expression input is the first text input under Sandbox
  const exprInput = page.getByTestId('sandbox-expr');
  await exprInput.fill(expr);
  if (bindings !== undefined) {
    await page.getByTestId('sandbox-bindings').fill(bindings);
  }
}

async function clickRunAndResult(page) {
  const runBtn = page.getByTestId('sandbox-run');
  await runBtn.click();
  const res = page.getByTestId('sandbox-result');
  await expect(res).toBeVisible({ timeout: 5000 });
  return await res.textContent();
}

test.describe('ADT Sandbox - reduction and solving', () => {
  test('boolean reduction: x < y and (y < 3 or z == 30) -> T', async ({ page }) => {
    await openAdtPanel(page);
    await setSandboxInputs(page, 'x < y and (y < 3 or z == 30)', 'x=3, y=4, z=30');
    const text = await clickRunAndResult(page);
    expect(text).toMatch(/Result:\s*T/);
  });

  test('term reduction: (1, length([2,3,4])) -> (1, 3)', async ({ page }) => {
    await openAdtPanel(page);
    await setSandboxInputs(page, '(1, length([2,3,4]))', '');
    const text = await clickRunAndResult(page);
    expect(text).toMatch(/Result:\s*\(1,\s*3\)/);
  });

  // Equation tests using Z3 are intentionally omitted for now
});


