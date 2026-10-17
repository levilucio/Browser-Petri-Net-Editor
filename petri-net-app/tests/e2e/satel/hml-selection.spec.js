import { test, expect } from '@playwright/test';

async function load(page, id) {
  if (await page.getByLabel('Open toolbar menu').isVisible()) await page.getByLabel('Open toolbar menu').click();
  await page.getByRole('button', { name: 'Examples', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find an example' }).fill('HML selection');
  await page.getByTestId(`example-hml-selection-${id}`).click();
}
async function satel(page) {
  if (await page.getByTestId('toolbar-satel').isVisible()) await page.getByTestId('toolbar-satel').click();
  else { await page.getByLabel('Open toolbar menu').click(); await page.getByTestId('toolbar-satel-mobile').click(); }
}
for (const [intention, mutant, expected] of [['hml-select-progress', 'missing-finish', 'true'], ['hml-select-no-dead-end', 'wrong-receipt', 'false']]) {
  test(`joint HML selection ${expected}: reference admission and frozen mutant replay`, async ({ page }, testInfo) => {
    test.setTimeout(90000);
    await page.goto('/'); await load(page, 'reference'); await satel(page);
    await page.getByRole('button', { name: 'Generated tests', exact: true }).click();
    await page.getByLabel('Intention to generate').selectOption(intention);
    await page.getByRole('button', { name: 'Generate tests', exact: true }).click();
    await expect(page.getByText('1/1 tests passed the reference oracle')).toBeVisible({ timeout: 45000 });
    await expect(page.getByLabel('Executable selection')).toContainText('Joint sequence / HML selection: 1 executable classes');
    await page.getByText('Why this test was selected', { exact: true }).click();
    const explanation = page.getByLabel('Test generation explanation');
    await expect(explanation).toContainText('Static representative: 1');
    await expect(explanation).toContainText('solved jointly from sequence and HML property');
    await expect(explanation).toContainText(`additional property must be ${expected}`);
    await expect(explanation).toContainText(/n ↦ [345]/);
    await explanation.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`joint-hml-${expected}.png`) });
    await page.getByLabel('Close SATEL').click(); await load(page, mutant); await satel(page);
    await page.getByRole('button', { name: 'Replay results', exact: true }).click();
    await page.getByRole('button', { name: 'Replay frozen suite on loaded APN' }).click();
    await expect(page.getByTestId('oracle-target-results')).toContainText('0 passed · 1 failed · 0 errors');
    await expect(page.getByLabel('Property explanation')).toContainText('expected to be true, but it is false');
  });
}
