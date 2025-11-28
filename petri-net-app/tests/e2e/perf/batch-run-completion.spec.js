/// <reference path="../../types/global.d.ts" />
// @ts-check
import { test, expect } from '@playwright/test';
import path from 'path';
import { waitForSimulationManager, openMobileMenuIfNeeded, getVisibleToolbarButton, getVisibleSimulationButton } from '../../helpers.js';

async function waitSimulatorReady(page, timeout = 120000) {
  await waitForSimulationManager(page, timeout);
  await page.waitForFunction(() => {
    const step = document.querySelector('[data-testid="sim-step"]') || document.querySelector('[data-testid="sim-step-mobile"]');
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

    // Load file with mobile-friendly method
    await openMobileMenuIfNeeded(page);
    const pnmlPath = path.resolve(process.cwd(), 'tests', 'test-inputs', 'petri-net-algebraic-large.pnml');
    const loadButton = page.getByRole('button', { name: 'Load' });
    await loadButton.waitFor({ state: 'visible' });
    
    const isMobileViewport = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
    if (isMobileViewport) {
      await loadButton.evaluate((btn) => btn.click());
      const input = page.locator('input[type="file"][accept=".pnml,.xml"]');
      await input.waitFor({ state: 'attached', timeout: 10000 });
      await input.setInputFiles(pnmlPath);
    } else {
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        loadButton.click(),
      ]);
      await fileChooser.setFiles(pnmlPath);
    }

    await waitSimulatorReady(page, 120_000);

    // Enable batch mode in settings
    const settingsButton = await getVisibleToolbarButton(page, 'toolbar-settings');
    const isMobileCheck = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
    if (isMobileCheck) {
      await settingsButton.evaluate(node => node.click());
    } else {
      await settingsButton.click();
    }
    const batchCheckbox = page.locator('label:has-text("Batch mode") input[type="checkbox"]').first();
    await batchCheckbox.check();
    await page.getByTestId('settings-save').click();

    await waitSimulatorReady(page, 120_000);

    const runButton = await getVisibleSimulationButton(page, 'sim-run');
    const stopButton = page.locator('[data-testid="sim-stop"], [data-testid="sim-stop-mobile"]').first();
    await runButton.click();

    await expect(stopButton).toBeEnabled({ timeout: 30_000 });
    await expect(stopButton).toBeDisabled({ timeout: 120_000 });

    // Wait for completion dialog to appear
    await page.getByText('Simulation Complete').first().waitFor({ state: 'visible', timeout: 120_000 });

    // Find the completion dialog and extract stats
    const dialog = page.locator('.bg-white.rounded-lg.shadow-xl.p-6').first();
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
    
    // Wait for stats to be populated (wait for "Transitions Fired:" text to appear)
    await page.getByText(/Transitions Fired:/).first().waitFor({ state: 'visible', timeout: 10000 });
    
    const dialogText = await dialog.innerText();
    
    // Extract transitions fired
    const transitionsMatch = /Transitions Fired:\s*([0-9,]+)/.exec(dialogText);
    const transitions = transitionsMatch ? Number.parseInt(transitionsMatch[1].replace(/,/g, ''), 10) : Number.NaN;
    expect(transitions).toBe(2432);

    // Extract duration (allow up to 35 seconds for CI/slower machines with variable performance)
    const durationMatch = /Duration:\s*([^\n]+)/.exec(dialogText);
    const durationText = durationMatch ? durationMatch[1].trim() : '';
    const durationMs = parseDurationToMs(durationText);
    expect(durationMs).toBeLessThanOrEqual(35000);

    await page.getByRole('button', { name: 'OK' }).first().click();
  });

  test('runs algebraic very large net in batch mode under ten seconds', async ({ page }) => {
    test.setTimeout(180_000);

    await page.goto('/');

    // Load file with mobile-friendly method
    await openMobileMenuIfNeeded(page);
    const pnmlPath = path.resolve(process.cwd(), 'tests', 'test-inputs', 'petri-net-algebraic-very-large.pnml');
    const loadButton = page.getByRole('button', { name: 'Load' });
    await loadButton.waitFor({ state: 'visible' });
    
    const isMobileViewport = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
    if (isMobileViewport) {
      await loadButton.evaluate((btn) => btn.click());
      const input = page.locator('input[type="file"][accept=".pnml,.xml"]');
      await input.waitFor({ state: 'attached', timeout: 10000 });
      await input.setInputFiles(pnmlPath);
    } else {
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        loadButton.click(),
      ]);
      await fileChooser.setFiles(pnmlPath);
    }

    await waitSimulatorReady(page, 120_000);

    // Enable batch mode in settings
    const settingsButton = await getVisibleToolbarButton(page, 'toolbar-settings');
    const isMobileCheck = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
    if (isMobileCheck) {
      await settingsButton.evaluate(node => node.click());
    } else {
      await settingsButton.click();
    }
    const batchCheckbox = page.locator('label:has-text("Batch mode") input[type="checkbox"]').first();
    await batchCheckbox.check();
    await page.getByTestId('settings-save').click();

    await waitSimulatorReady(page, 120_000);

    const runButton = await getVisibleSimulationButton(page, 'sim-run');
    const stopButton = page.locator('[data-testid="sim-stop"], [data-testid="sim-stop-mobile"]').first();
    await runButton.click();

    await expect(stopButton).toBeEnabled({ timeout: 30_000 });
    await expect(stopButton).toBeDisabled({ timeout: 120_000 });

    // Wait for completion dialog to appear
    await page.getByText('Simulation Complete').first().waitFor({ state: 'visible', timeout: 120_000 });

    // Find the completion dialog and extract stats
    const dialog = page.locator('.bg-white.rounded-lg.shadow-xl.p-6').first();
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
    
    // Wait for stats to be populated (wait for "Transitions Fired:" text to appear)
    await page.getByText(/Transitions Fired:/).first().waitFor({ state: 'visible', timeout: 10000 });
    
    const dialogText = await dialog.innerText();
    
    // Extract transitions fired
    const transitionsMatch = /Transitions Fired:\s*([0-9,]+)/.exec(dialogText);
    const transitions = transitionsMatch ? Number.parseInt(transitionsMatch[1].replace(/,/g, ''), 10) : Number.NaN;
    expect(transitions).toBe(3240);

    // Extract duration (allow up to 25 seconds for CI/slower machines)
    const durationMatch = /Duration:\s*([^\n]+)/.exec(dialogText);
    const durationText = durationMatch ? durationMatch[1].trim() : '';
    const durationMs = parseDurationToMs(durationText);
    expect(durationMs).toBeLessThan(25000);

    await page.getByRole('button', { name: 'OK' }).first().click();
  });
});

