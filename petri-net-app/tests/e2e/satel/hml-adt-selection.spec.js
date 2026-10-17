import { test, expect } from '@playwright/test';

async function load(page, id) {
  if (await page.getByLabel('Open toolbar menu').isVisible()) await page.getByLabel('Open toolbar menu').click();
  await page.getByRole('button', { name: 'Examples', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find an example' }).fill('HML ADT selection');
  await page.getByTestId(`example-hml-adt-${id}`).click();
}
async function satel(page) {
  if (await page.getByTestId('toolbar-satel').isVisible()) await page.getByTestId('toolbar-satel').click();
  else { await page.getByLabel('Open toolbar menu').click(); await page.getByTestId('toolbar-satel-mobile').click(); }
}
for (const [kind, intention, mutant] of [['string', 'progress', 'wrong-value'], ['list', 'progress', 'missing-finish'], ['pair', 'no-dead-end', 'wrong-value']]) {
  test(`${kind}: joint algebraic selection and frozen mutant replay`, async ({ page }, testInfo) => {
    test.setTimeout(90000);
    await page.goto('/'); await load(page, `${kind}-reference`); await satel(page);
    await page.getByRole('button', { name: 'Generated tests', exact: true }).click();
    await page.getByLabel('Intention to generate').selectOption(`hml-adt-${kind}-${intention}`);
    await page.getByRole('button', { name: 'Generate tests', exact: true }).click();
    await expect(page.getByText('1/1 tests passed the reference oracle')).toBeVisible({ timeout: 45000 });
    await page.getByText('Why this test was selected', { exact: true }).click();
    const explanation = page.getByLabel('Test generation explanation');
    await expect(explanation).toContainText('solved jointly from sequence and HML property');
    await expect(explanation).toContainText('HML selection unfolded');
    await expect(explanation).toContainText('x ↦');
    await explanation.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`joint-hml-${kind}.png`) });
    await page.getByLabel('Close SATEL').click(); await load(page, `${kind}-${mutant}`); await satel(page);
    await page.getByRole('button', { name: 'Replay results', exact: true }).click();
    await page.getByRole('button', { name: 'Replay frozen suite on loaded APN' }).click();
    await expect(page.getByTestId('oracle-target-results')).toContainText('0 passed · 1 failed · 0 errors');
    await expect(page.getByLabel('Property explanation')).toContainText('expected to be true, but it is false');
  });
}
