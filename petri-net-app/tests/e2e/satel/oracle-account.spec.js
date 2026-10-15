import { test, expect } from '@playwright/test';

async function openExamples(page) {
  const button = page.getByRole('button', { name: 'Examples', exact: true });
  if (await page.getByLabel('Open toolbar menu').isVisible()) await page.getByLabel('Open toolbar menu').click();
  await button.click();
}
async function openSatel(page) {
  const desktop = page.getByTestId('toolbar-satel');
  if (await desktop.isVisible()) await desktop.click();
  else {
    await page.getByLabel('Open toolbar menu').click();
    await page.getByTestId('toolbar-satel-mobile').click();
  }
}

test('reference suite survives loading a mutant and identifies the first mismatching observation', async ({ page }, testInfo) => {
  await page.goto('/');
  await openExamples(page);
  await page.getByTestId('example-oracle-account-reference').click();
  await openSatel(page);
  await page.getByRole('button', { name: 'Generate and validate on loaded reference' }).click();
  await expect(page.getByText('4/4 tests passed the reference oracle')).toBeVisible();
  const pairs = page.getByTestId('satel-pair-formula');
  await expect(pairs).toHaveCount(12);
  await expect(pairs.nth(7)).toContainText('withdraw(10) with ack(1) // paidAmount(10)');
  const equalityTest = page.locator('details').filter({ has: page.locator('summary', { hasText: /^Amount\(10\) · reference passed$/ }) }).first();
  await equalityTest.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('instantiated-pairs.png') });
  await page.getByRole('button', { name: 'V2 intentions' }).click();
  await expect(page.getByRole('button', { name: '+ Create V2 Intention' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Create V1/ })).toHaveCount(0);
  await page.getByLabel('Close SATEL').click();
  await openExamples(page);
  await page.getByTestId('example-oracle-account-reject-exact-balance').click();
  await openSatel(page);
  await page.getByRole('button', { name: 'Replay frozen suite on loaded APN' }).click();
  const result = page.getByTestId('oracle-target-results');
  await expect(result).toContainText('3 passed · 1 failed · 0 errors');
  await expect(result).toContainText('fail at step 2');
  await expect(result).toContainText('observation-mismatch');
  await expect(page.getByText('4/4 tests passed the reference oracle')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('oracle-mutant.png') });
});
