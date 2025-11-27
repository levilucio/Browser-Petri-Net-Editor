/// <reference path="../../types/global.d.ts" />
// @ts-check
import { test, expect } from '@playwright/test';
import path from 'path';

async function waitSimulatorReady(page, timeout = 120000) {
  await expect(page.getByTestId('simulation-manager')).toBeVisible({ timeout });
  await page.waitForFunction(() => {
    const step = document.querySelector('[data-testid="sim-step"]');
    const stepEnabled = step && !step.hasAttribute('disabled');
    const panel = document.querySelector('[data-testid="enabled-transitions"]');
    const buttons = panel ? panel.querySelectorAll('button').length : 0;
    return stepEnabled || buttons > 0;
  }, { timeout });
}

function parseDurationToMs(text) {
  if (!text) return Number.POSITIVE_INFINITY;
  const trimmed = text.trim();
  if (trimmed.endsWith('ms')) {
    return Number.parseFloat(trimmed.replace('ms', ''));
  }
  if (trimmed.includes('m')) {
    // Format such as "1m 2s"
    const parts = trimmed.split(' ');
    let total = 0;
    for (const part of parts) {
      if (part.endsWith('m')) {
        total += Number.parseFloat(part.replace('m', '')) * 60_000;
      } else if (part.endsWith('s')) {
        total += Number.parseFloat(part.replace('s', '')) * 1_000;
      }
    }
    return total;
  }
  if (trimmed.endsWith('s')) {
    return Number.parseFloat(trimmed.replace('s', '')) * 1_000;
  }
  return Number.POSITIVE_INFINITY;
}

test.describe('Batch run completion dialog', () => {
  test('runs algebraic large net in batch mode under six seconds', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto('/');

    const pnmlPath = path.resolve(process.cwd(), 'tests', 'test-inputs', 'petri-net-algebraic-large.pnml');
    const loadButton = page.getByRole('button', { name: 'Load' });
    await loadButton.waitFor({ state: 'visible' });
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      loadButton.click(),
    ]);
    await fileChooser.setFiles(pnmlPath);

    await waitSimulatorReady(page, 120_000);

    // Enable batch mode in settings
    await page.getByTestId('toolbar-settings').click();
    const batchCheckbox = page.locator('label:has-text("Batch mode") input[type="checkbox"]').first();
    await batchCheckbox.check();
    await page.getByTestId('settings-save').click();

    await waitSimulatorReady(page, 120_000);

    const runButton = page.getByTestId('sim-run');
    const stopButton = page.getByTestId('sim-stop');
    await runButton.click();

    await expect(stopButton).toBeEnabled({ timeout: 30_000 });
    await expect(stopButton).toBeDisabled({ timeout: 120_000 });

    // Wait for completion dialog to appear
    await page.getByText('Simulation Complete').waitFor({ state: 'visible', timeout: 120_000 });

    // Find the completion dialog and extract stats
    const dialog = page.locator('.bg-white.rounded-lg.shadow-xl.p-6');
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
    
    // Wait for stats to be populated (wait for "Transitions Fired:" text to appear)
    await page.getByText(/Transitions Fired:/).waitFor({ state: 'visible', timeout: 10000 });
    
    const dialogText = await dialog.innerText();
    
    // Extract transitions fired
    const transitionsMatch = /Transitions Fired:\s*([0-9,]+)/.exec(dialogText);
    const transitions = transitionsMatch ? Number.parseInt(transitionsMatch[1].replace(/,/g, ''), 10) : Number.NaN;
    expect(transitions).toBe(2432);

    // Extract duration (allow up to 6 seconds for CI/slower machines)
    const durationMatch = /Duration:\s*([^\n]+)/.exec(dialogText);
    const durationText = durationMatch ? durationMatch[1].trim() : '';
    const durationMs = parseDurationToMs(durationText);
    expect(durationMs).toBeLessThanOrEqual(6000);

    await page.getByRole('button', { name: 'OK' }).click();
  });

  test('runs algebraic very large net in batch mode under ten seconds', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto('/');

    const pnmlPath = path.resolve(process.cwd(), 'tests', 'test-inputs', 'petri-net-algebraic-very-large.pnml');
    const loadButton = page.getByRole('button', { name: 'Load' });
    await loadButton.waitFor({ state: 'visible' });
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      loadButton.click(),
    ]);
    await fileChooser.setFiles(pnmlPath);

    await waitSimulatorReady(page, 120_000);

    // Enable batch mode in settings
    await page.getByTestId('toolbar-settings').click();
    const batchCheckbox = page.locator('label:has-text("Batch mode") input[type="checkbox"]').first();
    await batchCheckbox.check();
    await page.getByTestId('settings-save').click();

    await waitSimulatorReady(page, 120_000);

    const runButton = page.getByTestId('sim-run');
    const stopButton = page.getByTestId('sim-stop');
    await runButton.click();

    await expect(stopButton).toBeEnabled({ timeout: 30_000 });
    await expect(stopButton).toBeDisabled({ timeout: 120_000 });

    // Wait for completion dialog to appear
    await page.getByText('Simulation Complete').waitFor({ state: 'visible', timeout: 120_000 });

    // Find the completion dialog and extract stats
    const dialog = page.locator('.bg-white.rounded-lg.shadow-xl.p-6');
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
    
    // Wait for stats to be populated (wait for "Transitions Fired:" text to appear)
    await page.getByText(/Transitions Fired:/).waitFor({ state: 'visible', timeout: 10000 });
    
    const dialogText = await dialog.innerText();
    
    // Extract transitions fired
    const transitionsMatch = /Transitions Fired:\s*([0-9,]+)/.exec(dialogText);
    const transitions = transitionsMatch ? Number.parseInt(transitionsMatch[1].replace(/,/g, ''), 10) : Number.NaN;
    expect(transitions).toBe(3240);

    // Extract duration
    const durationMatch = /Duration:\s*([^\n]+)/.exec(dialogText);
    const durationText = durationMatch ? durationMatch[1].trim() : '';
    const durationMs = parseDurationToMs(durationText);
    expect(durationMs).toBeLessThan(10000);

    await page.getByRole('button', { name: 'OK' }).click();
  });
});

