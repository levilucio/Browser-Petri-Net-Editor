// @ts-check
import { test, expect } from '@playwright/test';
import { waitForAppReady, loadPNML } from '../../helpers.js';

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

test.describe('Simulation - Run and Cancel', () => {
  test('clicking Stop mid-run halts simulation without completion dialog', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await waitForAppReady(page);

    await loadPNML(page, 'petri-net-algebraic-large.pnml');
    await waitSimulatorReady(page, 120000);

    // Enable batch mode
    await page.getByTestId('toolbar-settings').click();
    const batchCheckbox = page.locator('label:has-text("Batch mode") input[type="checkbox"]').first();
    await batchCheckbox.check();
    await page.getByTestId('settings-save').click();
    await waitSimulatorReady(page, 120000);

    const runButton = page.getByTestId('sim-run');
    const stopButton = page.getByTestId('sim-stop');
    await runButton.click();

    await expect(stopButton).toBeEnabled({ timeout: 30000 });
    await page.waitForTimeout(500);
    await stopButton.click();

    await expect(stopButton).toBeDisabled({ timeout: 10000 });

    // Assert no completion dialog appeared
    const dialog = page.getByText('Simulation Complete');
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
  });
});

