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
  // Exercise the actual GUI file path, including its PNML method metadata.
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  if (await page.getByLabel('Open toolbar menu').isVisible()) await page.getByLabel('Open toolbar menu').click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const download = await downloaded, savedPath = testInfo.outputPath('account.pnml');
  await download.saveAs(savedPath);
  if (await page.getByLabel('Open toolbar menu').isVisible()) await page.getByLabel('Open toolbar menu').click();
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await (await choosing).setFiles(savedPath);
  await expect(page.getByText(/Petri net loaded successfully with 4 places/)).toBeVisible();
  await openSatel(page);
  await page.getByRole('button', { name: 'Generate and validate on loaded reference' }).click();
  await expect(page.getByText('4/4 tests passed the reference oracle')).toBeVisible();
  await expect(page.getByText('Initial marking M₀', { exact: true })).toHaveCount(4);
  await expect(page.getByLabel('SATEL Testing')).not.toContainText('V2');
  const pairs = page.getByTestId('satel-pair-formula');
  await expect(pairs).toHaveCount(12);
  await expect(page.getByLabel('SATEL Testing')).not.toContainText('HML(');
  await expect(pairs.nth(7)).toContainText('withdraw(10) with ack(1) // paidAmount(10)');
  const equalityTest = page.locator('details').filter({ has: page.locator('summary', { hasText: /^Amount\(10\) · reference passed$/ }) }).first();
  await equalityTest.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('instantiated-pairs.png') });
  await page.getByRole('button', { name: 'Intentions' }).click();
  await expect(page.getByRole('button', { name: '+ Create Intention' })).toBeVisible();
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
  await page.getByLabel('Close SATEL').click();
  await openExamples(page);
  await page.getByTestId('example-oracle-account-wrong-initial-balance').click();
  await openSatel(page);
  await page.getByRole('button', { name: 'Replay frozen suite on loaded APN' }).click();
  await expect(page.getByTestId('oracle-target-results')).toContainText('0 passed · 4 failed · 0 errors');
});

test('public calls accept arguments and preserve the marking between calls', async ({ page }, testInfo) => {
  await page.goto('/');
  await openExamples(page);
  await page.getByTestId('example-oracle-account-reference').click();
  await page.getByRole('button', { name: 'Call public method', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Call public method' });
  await dialog.getByLabel('deposit argument n').fill('10');
  await dialog.getByRole('button', { name: 'Call deposit', exact: true }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'deposit(10)' })).toContainText('ack ↦ ⟦1⟧');
  await dialog.getByLabel('withdraw argument n').fill('10');
  await dialog.getByRole('button', { name: 'Call withdraw', exact: true }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'withdraw(10)' })).toContainText('paidAmount ↦ ⟦10⟧');
  await dialog.getByRole('button', { name: 'Call withdraw', exact: true }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'withdraw(10)' })).toContainText('ack ↦ ⟦0⟧');
  await dialog.getByRole('button', { name: 'Call query', exact: true }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'query()' })).toContainText('balanceResult ↦ ⟦0⟧');
  await page.screenshot({ path: testInfo.outputPath('public-calls.png') });
  await page.getByLabel('Close method calls').click();
  await openSatel(page);
  await page.getByRole('button', { name: 'I/O', exact: true }).click();
  await expect(page.getByLabel('SATEL Testing')).toContainText('Public methods (4)');
  await expect(page.getByLabel('SATEL Testing')).toContainText('withdraw(n: Nat)');
});

test('observations are edited as places and token multisets without JSON', async ({ page }, testInfo) => {
  await page.goto('/'); await openExamples(page);
  await page.getByTestId('example-oracle-account-reference').click(); await openSatel(page);
  await page.getByRole('button', { name: 'Intentions', exact: true }).click();
  await page.getByRole('button', { name: '+ Create Intention' }).click();
  await page.getByRole('button', { name: '+ Add Pair' }).click();
  await page.getByLabel('Pair 1 argument n').fill('10');
  const observation = page.getByRole('region', { name: 'Pair 1 observation' });
  await expect(observation).not.toContainText('JSON');
  await page.getByLabel('Pair 1 check outputs at ack').check();
  await page.getByLabel('Pair 1 expected outputs at ack').fill('1,');
  await expect(page.getByRole('button', { name: 'Save Intention' })).toBeDisabled();
  await page.getByLabel('Pair 1 expected outputs at ack').fill('1');
  await observation.getByText('Marking after this call (optional)', { exact: true }).click();
  await page.getByLabel('Pair 1 marking check at balance', { exact: true }).selectOption('equals');
  await page.getByLabel('Pair 1 expected marking at balance', { exact: true }).fill('10');
  await page.getByLabel('Pair 1 marking check at ack').selectOption('equals');
  await page.getByLabel('Pair 1 expected marking at ack').fill('1');
  await observation.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('place-observation-editor.png') });
  await page.getByRole('button', { name: 'Save Intention' }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Pair 1 expected marking at balance', { exact: true })).toHaveValue('10');
  await page.getByRole('button', { name: 'Save Intention' }).click();
  await page.getByRole('button', { name: 'Generate and validate suite' }).click();
  await expect(page.getByText('1 tests admitted by the reference oracle.')).toBeVisible();
  await expect(page.getByTestId('satel-pair-formula')).toContainText('deposit(10) with ack(1)');
});
