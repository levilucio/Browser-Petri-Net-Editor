// @ts-check
import { test, expect } from '@playwright/test';
import { waitForAppReady, loadPNML, getVisibleToolbarButton } from '../../helpers.js';

test.describe('Settings - Batch mode and simulation mode coupling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('batch mode enables non-visual and selects maximal mode; toggling off re-enables non-visual', async ({ page }) => {
    await loadPNML(page, 'petri-net1.pnml');

    const settingsButton = await getVisibleToolbarButton(page, 'toolbar-settings');
    await settingsButton.click();
    await expect(page.getByText('Simulation Settings')).toBeVisible();

    const batch = page.locator('label:has-text("Batch mode") input[type="checkbox"]').first();
    const maximal = page.locator('input[type="radio"][name="simulationMode"][value="maximal"]');
    const nonVisual = page.locator('label:has-text("Use non-visual execution for Run") input[type="checkbox"]').first();

    await batch.check();
    await expect(maximal).toBeChecked();
    await expect(nonVisual).toBeDisabled();
    await expect(nonVisual).toBeChecked();

    await page.getByTestId('settings-save').click();

    // Re-open and turn batch off
    const settingsButton2 = await getVisibleToolbarButton(page, 'toolbar-settings');
    await settingsButton2.click();
    await expect(page.getByText('Simulation Settings')).toBeVisible();
    await batch.uncheck();
    await expect(nonVisual).toBeEnabled();
    await page.getByTestId('settings-save').click();
  });
});


