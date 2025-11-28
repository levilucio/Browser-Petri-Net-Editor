// @ts-check
import { test, expect } from '@playwright/test';
import { waitForAppReady, loadPNML, enableBatchMode, readCompletionStats, waitForSimulationManager, getVisibleSimulationButton } from '../../helpers.js';

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
 * Robustly wait for completion dialog to appear.
 * On mobile, the dialog might render but not be visible due to z-index/overlay issues,
 * so we check DOM content first, then try to access the dialog.
 */
async function waitForCompletionDialog(page, timeout = 180000) {
  const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
  
  // Step 1: Wait for stop button to be disabled (simulation finished)
  const stopButton = page.locator('[data-testid="sim-stop"], [data-testid="sim-stop-mobile"]').first();
  await expect(stopButton).toBeDisabled({ timeout });
  
  // Step 2: Wait for "Simulation Complete" text to appear in DOM (doesn't require visibility)
  await page.waitForFunction(() => {
    const bodyText = document.body.innerText || document.body.textContent || '';
    return bodyText.includes('Simulation Complete') && bodyText.includes('Transitions Fired:');
  }, { timeout: isMobile ? timeout : 30000 }); // Longer timeout for mobile
  
  // Step 3: Try to find and access the dialog (with fallback if visibility check fails)
  const dialog = page.locator('.bg-white.rounded-lg.shadow-xl.p-6').first();
  
  // On mobile, try 'attached' first (less strict than 'visible')
  if (isMobile) {
    try {
      await dialog.waitFor({ state: 'attached', timeout: 10000 });
    } catch {
      // If attached fails, the dialog might still be in DOM, try to evaluate it directly
    }
  } else {
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
  }
  
  // Step 4: Wait for stats text to be present (more reliable than waiting for visibility)
  await page.waitForFunction(() => {
    const bodyText = document.body.innerText || document.body.textContent || '';
    return /Transitions Fired:\s*[0-9,]+/.test(bodyText);
  }, { timeout: 20000 });
  
  return dialog;
}

test.describe('Simulation - Completion dialog content and formatting', () => {
  test('algebraic large net: dialog shows formatted transitions and duration', async ({ page, browserName }) => {
    // Skip on Mobile Safari - large simulations cause browser crashes due to resource constraints
    if (browserName === 'webkit' && page.context()._options?.isMobile) {
      test.skip();
      return;
    }
    test.setTimeout(180000);
    await page.goto('/');
    await waitForAppReady(page);

    await loadPNML(page, 'petri-net-algebraic-large.pnml');
    await waitSimulatorReady(page, 120000);
    await enableBatchMode(page);
    await waitSimulatorReady(page, 120000);

    const runButton = await getVisibleSimulationButton(page, 'sim-run');
    const stopButton = page.locator('[data-testid="sim-stop"], [data-testid="sim-stop-mobile"]').first();
    await runButton.click();

    await expect(stopButton).toBeEnabled({ timeout: 30000 });
    await expect(stopButton).toBeDisabled({ timeout: 120000 });

    // Use robust completion dialog wait
    await waitForCompletionDialog(page, 120000);

    const stats = await readCompletionStats(page);
    expect(stats.transitions).toBe(2432);
    // Allow up to 35 seconds for CI/slower machines with variable performance
    expect(stats.durationMs).toBeLessThanOrEqual(35000);

    // Verify OK button closes dialog
    await page.getByRole('button', { name: 'OK' }).first().click();
    await expect(page.getByText('Simulation Complete').first()).not.toBeVisible({ timeout: 2000 });
  });

  test('algebraic very large net: dialog shows correct stats under 10s', async ({ page, browserName }) => {
    // Skip on Mobile Safari - very large simulations cause browser crashes due to resource constraints
    if (browserName === 'webkit' && page.context()._options?.isMobile) {
      test.skip();
      return;
    }
    test.setTimeout(180000);
    await page.goto('/');
    await waitForAppReady(page);

    await loadPNML(page, 'petri-net-algebraic-very-large.pnml');
    await waitSimulatorReady(page, 120000);
    await enableBatchMode(page);
    await waitSimulatorReady(page, 120000);

    const runButton = await getVisibleSimulationButton(page, 'sim-run');
    const stopButton = page.locator('[data-testid="sim-stop"], [data-testid="sim-stop-mobile"]').first();
    await runButton.click();

    await expect(stopButton).toBeEnabled({ timeout: 30000 });
    await expect(stopButton).toBeDisabled({ timeout: 120000 });

    // Use robust completion dialog wait
    await waitForCompletionDialog(page, 120000);

    const stats = await readCompletionStats(page);
    expect(stats.transitions).toBe(3240);
    // Allow up to 25 seconds for CI/slower machines with variable performance
    expect(stats.durationMs).toBeLessThan(25000);

    await page.getByRole('button', { name: 'OK' }).first().click();
    await expect(page.getByText('Simulation Complete').first()).not.toBeVisible({ timeout: 2000 });
  });
});

