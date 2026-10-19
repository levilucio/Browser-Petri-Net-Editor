import { test, expect } from '@playwright/test';
async function load(page, id) {
  if (await page.getByLabel('Open toolbar menu').isVisible()) await page.getByLabel('Open toolbar menu').click();
  await page.getByRole('button', { name: 'Examples', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find an example' }).fill('Nondeterminism');
  await page.getByTestId(`example-nondeterminism-${id}`).click();
}
async function satel(page) {
  if (await page.getByTestId('toolbar-satel').isVisible()) await page.getByTestId('toolbar-satel').click();
  else { await page.getByLabel('Open toolbar menu').click(); await page.getByTestId('toolbar-satel-mobile').click(); }
}
test('black-box campaign keeps the saved oracle and exposes multiplicity failures', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.goto('/'); await load(page, 'bag-reference'); await satel(page);
  await page.getByRole('button', { name: 'Generated tests', exact: true }).click();
  await page.getByRole('button', { name: 'Generate tests', exact: true }).click();
  await expect(page.getByText('1/1 tests passed the reference oracle')).toBeVisible();
  await page.getByRole('button', { name: 'Black-box runs', exact: true }).click();
  await page.getByLabel('Black-box repetitions', { exact: true }).selectOption('4');
  await page.getByRole('button', { name: 'Run black-box campaign' }).click();
  await expect(page.getByTestId('black-box-summary')).toContainText('4 compatible executions · 0 observable mismatches');
  await expect(page.getByLabel('Observed black-box execution')).toContainText('take() with picked(');
  await page.getByLabel('Close SATEL').click(); await load(page, 'bag-missing-choice'); await satel(page);
  await expect(page.getByTestId('black-box-summary')).toContainText('4 compatible executions');
  await page.getByLabel('Black-box system', { exact: true }).selectOption('bag-missing-duplicate');
  await page.getByRole('button', { name: 'Run black-box campaign' }).click();
  await expect(page.getByTestId('black-box-summary')).toContainText('4 observable mismatches');
  await expect(page.getByLabel('Observed black-box execution')).toContainText('every compatible reference state accepts it');
  await page.getByTestId('black-box-summary').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('black-box-failure.png') });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download campaign evidence' }).click();
  expect((await download).suggestedFilename()).toBe('satel-black-box-campaign.json');
});

test('same-prefix continuations are not pooled into an HML proof', async ({ page }) => {
  await page.goto('/'); await load(page, 'branch-reference'); await satel(page);
  await page.getByRole('button', { name: 'Generated tests', exact: true }).click();
  await page.getByRole('button', { name: 'Generate tests', exact: true }).click();
  await expect(page.getByText('1/1 tests passed the reference oracle')).toBeVisible();
  await page.getByRole('button', { name: 'Black-box runs', exact: true }).click();
  await page.getByLabel('Black-box repetitions', { exact: true }).selectOption('4');
  await page.getByRole('button', { name: 'Run black-box campaign' }).click();
  await expect(page.getByTestId('black-box-summary')).toContainText('8 compatible executions · 0 observable mismatches');
  await expect(page.getByTestId('black-box-summary')).toContainText('0 witnessed · 0 counterexamples · 8 inconclusive');
});
