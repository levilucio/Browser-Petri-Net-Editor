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
test('edit and generate branching property; frozen replay distinguishes identical traces', async ({ page }, testInfo) => {
  await page.goto('/'); await load(page, 'branch-reference'); await satel(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await expect(page.getByLabel('Property 1 requirement', { exact: true })).toHaveValue('diamond');
  await expect(page.getByLabel('Property 1.1 requirement', { exact: true })).toHaveValue('and');
  await page.getByLabel('Branching property editor').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('branching-editor.png') });
  await page.getByRole('button', { name: 'Save Intention' }).click();
  await page.getByRole('button', { name: 'Generated tests', exact: true }).click();
  await page.getByRole('button', { name: 'Generate tests', exact: true }).click();
  await expect(page.getByText('1/1 tests passed the reference oracle')).toBeVisible();
  await expect(page.getByTestId('satel-hml-formula')).toContainText('∧');
  await expect(page.getByLabel('Property evaluation evidence')).toContainText('2 distinct successors found');
  await page.getByLabel('Close SATEL').click(); await load(page, 'branch-early-choice'); await satel(page);
  await page.getByRole('button', { name: 'Replay results', exact: true }).click();
  await page.getByRole('button', { name: 'Replay frozen suite on loaded APN' }).click();
  await expect(page.getByTestId('oracle-target-results')).toContainText('0 passed · 1 failed · 0 errors');
  await expect(page.getByLabel('Property evaluation evidence')).toContainText('Target property: false');
  await expect(page.getByLabel('Property explanation')).toContainText('every matching outcome fails the continuation');
  await expect(page.getByLabel('Property explanation')).toContainText('fire left()');
  await expect(page.getByLabel('Property explanation')).toContainText('fire right()');
  await page.getByRole('link', { name: 'Evidence 1.2.2', exact: true }).click();
  await expect(page.getByText('1.2.2 · diamond · false · right()', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('branching-counterexample.png') });
});
test('negative HML property detects a missing alternative; bag example validates multiplicity', async ({ page }) => {
  await page.goto('/'); await load(page, 'branch-reference'); await satel(page);
  await page.getByRole('button', { name: 'Generated tests', exact: true }).click();
  await page.getByLabel('Intention to generate').selectOption('branch-restricted');
  await page.getByRole('button', { name: 'Generate tests', exact: true }).click();
  await expect(page.getByText('1/1 tests passed the reference oracle')).toBeVisible();
  await expect(page.getByLabel('Branching property', { exact: true })).toContainText('expected false');
  await page.getByLabel('Close SATEL').click(); await load(page, 'branch-missing-restriction'); await satel(page);
  await page.getByRole('button', { name: 'Replay results', exact: true }).click();
  await page.getByRole('button', { name: 'Replay frozen suite on loaded APN' }).click();
  await expect(page.getByTestId('oracle-target-results')).toContainText('0 passed · 1 failed · 0 errors');
  await expect(page.getByLabel('Property evaluation evidence')).toContainText('Target property: true');
  await expect(page.getByLabel('Property explanation')).toContainText('expected to be false, but it is true');
  await expect(page.getByLabel('Property explanation')).toContainText('Every outcome of open()');
  await page.getByLabel('Close SATEL').click(); await load(page, 'bag-reference'); await satel(page);
  await page.getByRole('button', { name: 'Generated tests', exact: true }).click();
  await page.getByLabel('Intention to generate').selectOption('bag-orders');
  await page.getByRole('button', { name: 'Generate tests', exact: true }).click();
  await expect(page.getByText('1/1 tests passed the reference oracle')).toBeVisible();
});

test('output mismatch explanation opens the rejected firing and its marking', async ({ page }, testInfo) => {
  await page.goto('/'); await load(page, 'bag-reference'); await satel(page);
  await page.getByRole('button', { name: 'Generated tests', exact: true }).click();
  await page.getByLabel('Intention to generate').selectOption('bag-orders');
  await page.getByRole('button', { name: 'Generate tests', exact: true }).click();
  await expect(page.getByText('1/1 tests passed the reference oracle')).toBeVisible();
  await page.getByLabel('Close SATEL').click(); await load(page, 'bag-multiplicity'); await satel(page);
  await page.getByRole('button', { name: 'Replay results', exact: true }).click();
  await page.getByRole('button', { name: 'Replay frozen suite on loaded APN' }).click();
  await expect(page.getByLabel('Property explanation')).toContainText('this firing produced ⟦2⟧; the observation requires ⟦1⟧');
  const link = page.getByRole('link', { name: 'Evidence 1.1.1.outcome-1', exact: true });
  const id = (await link.getAttribute('href')).slice(1);
  await link.click();
  const outcome = page.locator(`[id="${id}"]`);
  await expect(outcome).toBeFocused();
  await expect(outcome).toContainText('rule take · outside observation filter');
  await expect(outcome).toContainText('x ↦ 2');
  await outcome.getByText('Resulting marking', { exact: true }).click();
  await expect(outcome).toContainText('stock ↦ ∅');
  await outcome.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('output-mismatch-explanation.png') });
});
