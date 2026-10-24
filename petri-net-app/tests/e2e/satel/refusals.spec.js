import { test, expect } from '@playwright/test';
async function load(page, filename, search = 'Refusal') {
  if (await page.getByLabel('Open toolbar menu').isVisible()) await page.getByLabel('Open toolbar menu').click();
  await page.getByRole('button', { name: 'Examples', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find an example' }).fill(search);
  await page.getByTestId(`example-${filename}`).click();
}
async function satel(page) {
  if (await page.getByTestId('toolbar-satel').isVisible()) await page.getByTestId('toolbar-satel').click();
  else { await page.getByLabel('Open toolbar menu').click(); await page.getByTestId('toolbar-satel-mobile').click(); }
}
test('refusal notation, reference admission, marking evidence and mutant replay', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.goto('/'); await load(page, 'refusal-quota-reference'); await satel(page);
  await page.getByRole('button', { name: 'Generated tests', exact: true }).click();
  await page.getByRole('button', { name: 'Generate tests', exact: true }).click();
  await expect(page.getByText('1/1 tests passed the reference oracle')).toBeVisible({ timeout: 40000 });
  await expect(page.getByTestId('satel-pair-formula').last()).toContainText('refused; marking unchanged');
  await page.getByText('Why this test was selected', { exact: true }).click();
  await expect(page.getByLabel('Test generation explanation')).toContainText('Final refusal covers 1 rules');
  await page.getByLabel('Pair 3', { exact: true }).getByText('Execution details', { exact: true }).click();
  await page.getByText('Marking after pair 3', { exact: true }).click();
  await expect(page.getByLabel('Pair 3', { exact: true })).toContainText('held ↦ ⟦3⟧');
  await page.screenshot({ path: testInfo.outputPath('refusal-evidence.png') });
  await page.getByLabel('Close SATEL').click(); await load(page, 'refusal-quota-mutant'); await satel(page);
  await page.getByRole('button', { name: 'Replay results', exact: true }).click();
  await page.getByRole('button', { name: 'Replay frozen suite on loaded APN' }).click();
  await expect(page.getByTestId('oracle-target-results')).toContainText('0 passed · 1 failed · 0 errors');
});
test('automatic companions explain relaxed terminal conditions and bounded coverage', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.goto('/'); await load(page, 'exercise-thermostat-reference', 'Thermostat'); await satel(page);
  await page.getByRole('button', { name: 'Generated tests', exact: true }).click();
  await page.getByLabel('Include bounded refusal tests').check();
  await page.getByRole('button', { name: 'Generate tests', exact: true }).click();
  await expect(page.getByText(/tests passed the reference oracle/)).toBeVisible({ timeout: 40000 });
  await expect(page.getByLabel('Negative selection coverage')).toContainText('1 candidates');
  await expect(page.getByTestId('satel-pair-formula').last()).toContainText('refused; marking unchanged');
  await page.getByText('Why this test was selected', { exact: true }).last().click();
  await expect(page.getByLabel('Test generation explanation').last()).toContainText('may lie outside the original intention');
  await page.screenshot({ path: testInfo.outputPath('automatic-refusal.png') });
});
