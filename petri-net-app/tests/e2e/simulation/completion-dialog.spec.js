// @ts-check
import { test, expect } from '@playwright/test';
import { waitForAppReady, loadPNML, enableBatchMode, readCompletionStats } from '../../helpers.js';

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

test.describe('Simulation - Completion dialog content and formatting', () => {
  test('algebraic large net: dialog shows formatted transitions and duration', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/');
    await waitForAppReady(page);

    await loadPNML(page, 'petri-net-algebraic-large.pnml');
    await waitSimulatorReady(page, 120000);
    await enableBatchMode(page);
    await waitSimulatorReady(page, 120000);

    const runButton = page.getByTestId('sim-run');
    const stopButton = page.getByTestId('sim-stop');
    await runButton.click();

    await expect(stopButton).toBeEnabled({ timeout: 30000 });
    await expect(stopButton).toBeDisabled({ timeout: 120000 });

    await page.getByText('Simulation Complete').waitFor({ state: 'visible', timeout: 120000 });

    const stats = await readCompletionStats(page);
    expect(stats.transitions).toBe(2432);
    expect(stats.durationMs).toBeLessThanOrEqual(6000);

    // Verify OK button closes dialog
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByText('Simulation Complete')).not.toBeVisible({ timeout: 2000 });
  });

  test('algebraic very large net: dialog shows correct stats under 10s', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/');
    await waitForAppReady(page);

    await loadPNML(page, 'petri-net-algebraic-very-large.pnml');
    await waitSimulatorReady(page, 120000);
    await enableBatchMode(page);
    await waitSimulatorReady(page, 120000);

    const runButton = page.getByTestId('sim-run');
    const stopButton = page.getByTestId('sim-stop');
    await runButton.click();

    await expect(stopButton).toBeEnabled({ timeout: 30000 });
    await expect(stopButton).toBeDisabled({ timeout: 120000 });

    await page.getByText('Simulation Complete').waitFor({ state: 'visible', timeout: 120000 });

    const stats = await readCompletionStats(page);
    expect(stats.transitions).toBe(3240);
    expect(stats.durationMs).toBeLessThan(10000);

    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByText('Simulation Complete')).not.toBeVisible({ timeout: 2000 });
  });
});

