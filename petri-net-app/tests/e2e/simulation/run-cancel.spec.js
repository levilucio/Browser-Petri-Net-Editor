// @ts-check
import { test, expect } from '@playwright/test';
import { waitForAppReady, loadPNML, getVisibleToolbarButton, waitForSimulationManager, getVisibleSimulationButton } from '../../helpers.js';

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

test.describe('Simulation - Run and Cancel', () => {
  test('clicking Stop mid-run halts simulation without completion dialog', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await waitForAppReady(page);

    await loadPNML(page, 'petri-net-algebraic-large.pnml');
    await waitSimulatorReady(page, 120000);

    // Enable batch mode
    const settingsButton = await getVisibleToolbarButton(page, 'toolbar-settings');
    const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
    if (isMobile) {
      await settingsButton.evaluate(node => node.click());
    } else {
      await settingsButton.click();
    }
    await expect(page.getByText('Simulation Settings')).toBeVisible();
    const batchCheckbox = page.locator('label:has-text("Batch mode") input[type="checkbox"]').first();
    await batchCheckbox.check();
    await page.getByTestId('settings-save').click();
    await waitSimulatorReady(page, 120000);

    const runButton = await getVisibleSimulationButton(page, 'sim-run');
    const stopButton = page.locator('[data-testid="sim-stop"], [data-testid="sim-stop-mobile"]').first();
    await runButton.click();

    await expect(stopButton).toBeEnabled({ timeout: 30000 });
    await page.waitForTimeout(500);
    await stopButton.click();

    await expect(stopButton).toBeDisabled({ timeout: 10000 });

    // Assert no completion dialog appeared
    const dialog = page.getByText('Simulation Complete').first();
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
  });
});

