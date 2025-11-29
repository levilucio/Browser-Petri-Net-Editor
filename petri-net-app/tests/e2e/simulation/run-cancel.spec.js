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

/**
 * Ensure the mobile simulation drawer is expanded so buttons are visible.
 * @param {import('@playwright/test').Page} page
 */
async function ensureMobileSimulationDrawerExpanded(page) {
  const mobileManager = page.locator('[data-testid="simulation-manager-mobile"]');
  if (!await mobileManager.count()) {
    return;
  }
  const stepButton = page.locator('[data-testid="sim-step-mobile"]');
  const isExpanded = await stepButton.isVisible().catch(() => false);
  if (isExpanded) {
    return;
  }

  const dragHandle = mobileManager.locator('button[title="Tap to expand/collapse"]').first();
  if (await dragHandle.count()) {
    await dragHandle.scrollIntoViewIfNeeded().catch(() => {});
    await dragHandle.click({ force: true });
  } else {
    await mobileManager.first().click({ force: true });
  }
  await page.waitForTimeout(350);
  await stepButton.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
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
    
    // On mobile, we need to use the mobile stop button and ensure drawer is expanded
    let stopButton;
    if (isMobile) {
      await ensureMobileSimulationDrawerExpanded(page);
      stopButton = page.locator('[data-testid="sim-stop-mobile"]').first();
      // If mobile stop button doesn't exist, fall back to desktop
      if (!await stopButton.count()) {
        stopButton = page.locator('[data-testid="sim-stop"]').first();
      }
    } else {
      stopButton = page.locator('[data-testid="sim-stop"]').first();
    }
    
    await runButton.click();

    // Wait for stop button to be enabled (simulation started)
    await expect(stopButton).toBeEnabled({ timeout: 30000 });
    await page.waitForTimeout(500);
    
    // On mobile, use evaluate click to bypass visibility issues
    if (isMobile) {
      await stopButton.evaluate(node => node.click());
    } else {
      await stopButton.click();
    }

    await expect(stopButton).toBeDisabled({ timeout: 10000 });

    // Assert no completion dialog appeared
    const dialog = page.getByText('Simulation Complete').first();
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
  });
});

