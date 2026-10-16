import { test, expect } from '@playwright/test';
import { exerciseScenarios } from '../../../src/satel/examples/exercises/editor.js';

async function examples(page, search) {
  if (await page.getByLabel('Open toolbar menu').isVisible()) await page.getByLabel('Open toolbar menu').click();
  await page.getByRole('button', { name: 'Examples', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find an example' }).fill(search);
}
async function satel(page) {
  if (await page.getByTestId('toolbar-satel').isVisible()) await page.getByTestId('toolbar-satel').click();
  else { await page.getByLabel('Open toolbar menu').click(); await page.getByTestId('toolbar-satel-mobile').click(); }
}
const failures = { thermostat: [1, 3], door: [1, 1], tickets: [2, 2], labels: [3, 3], coordinates: [4, 4], queue: [3, 3], parcel: [4, 4], quota: [3, 1], kits: [2, 1], journal: [4, 4] };
for (const scenario of exerciseScenarios) test(`${scenario.name}: ${scenario.depth} pairs and both separately loaded mutants`, async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.goto('/'); await examples(page, scenario.name);
  await page.getByTestId(`example-exercise-${scenario.id}-reference`).click();
  await satel(page);
  await page.getByRole('button', { name: 'Intentions', exact: true }).click();
  await expect(page.getByLabel('SATEL Testing')).toContainText(scenario.name === 'Coordinate cursor' ? 'Coordinates' : scenario.name === 'Resource quota' ? 'Resource quota' : scenario.name);
  await page.getByRole('button', { name: 'Generated tests', exact: true }).click();
  await page.getByRole('button', { name: 'Generate tests', exact: true }).click();
  await expect(page.getByText(`${scenario.classes}/${scenario.classes} tests passed the reference oracle`)).toBeVisible({ timeout: 40000 });
  await expect(page.getByTestId('satel-pair-formula')).toHaveCount(scenario.classes * scenario.depth);
  await expect(page.getByLabel('Executable selection')).toContainText(`${scenario.classes} executable classes · 0 blocked classes · 0 unresolved searches`);
  if (scenario.id === 'journal') {
    await page.getByTestId('satel-pair-formula').nth(19).scrollIntoViewIfNeeded();
    await expect(page.getByTestId('satel-pair-formula').nth(19)).toContainText('source("sensor")');
    await page.screenshot({ path: testInfo.outputPath('journal-twenty-pairs.png') });
  }
  for (const [i, mutant] of scenario.mutants.entries()) {
    await page.getByLabel('Close SATEL').click(); await examples(page, scenario.name);
    await page.getByTestId(`example-exercise-${scenario.id}-${mutant.id}`).click(); await satel(page);
    await page.getByRole('button', { name: 'Replay results', exact: true }).click();
    await page.getByRole('button', { name: 'Replay frozen suite on loaded APN' }).click();
    const fail = failures[scenario.id][i];
    await expect(page.getByTestId('oracle-target-results')).toContainText(`${scenario.classes - fail} passed · ${fail} failed · 0 errors`);
  }
});
