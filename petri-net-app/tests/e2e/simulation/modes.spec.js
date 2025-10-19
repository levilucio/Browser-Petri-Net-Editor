/// <reference path="../../types/global.d.ts" />
// @ts-check
import { test, expect } from '@playwright/test';
import { waitForAppReady } from '../../helpers.js';

async function openSettings(page) {
  await page.getByTestId('toolbar-settings').click();
  await expect(page.getByText('Simulation Settings')).toBeVisible();
}

async function clearCanvas(page) {
  await page.getByRole('button', { name: 'Clear' }).click();
  await page.waitForTimeout(200);
  const counts = await page.evaluate(() => {
    const s = /** @type {any} */ (window).__PETRI_NET_STATE__ || { places: [], transitions: [], arcs: [] };
    return { p: s.places.length || 0, t: s.transitions.length || 0, a: s.arcs.length || 0 };
  });
  expect(counts.p + counts.t + counts.a).toBe(0);
}

test.describe('Settings: net type switching rules', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('Empty canvas: can switch between P/T and Algebraic', async ({ page }) => {
    await clearCanvas(page);
    await openSettings(page);
    const ptRadio = page.locator('input[type="radio"][name="netMode"][value="pt"]');
    const algRadio = page.locator('input[type="radio"][name="netMode"][value="algebraic-int"]');
    await expect(ptRadio).toBeEnabled();
    await expect(algRadio).toBeEnabled();
    await page.getByTestId('settings-cancel').click();
  });

  test('Canvas has P/T net: net type radios are disabled (locked)', async ({ page }) => {
    // Create a PT net element (place)
    await page.getByTestId('toolbar-place').click();
    await page.locator('.konvajs-content').click({ position: { x: 120, y: 120 } });
    // Open settings
    await openSettings(page);
    const ptRadio = page.locator('input[type="radio"][name="netMode"][value="pt"]');
    const apnRadio = page.locator('input[type="radio"][name="netMode"][value="algebraic-int"]');
    await expect(ptRadio).toBeDisabled();
    await expect(apnRadio).toBeDisabled();
    await page.getByTestId('settings-cancel').click();
  });

  test('Canvas has Algebraic net: net type radios are disabled (locked)', async ({ page }) => {
    // Switch to APN first
    await openSettings(page);
    const apnRadio = page.locator('input[type="radio"][name="netMode"][value="algebraic-int"]');
    await apnRadio.check();
    await page.getByTestId('settings-save').click();
    // Add at least one element to the canvas so mode becomes locked
    await page.getByTestId('toolbar-place').click();
    await page.locator('.konvajs-content').click({ position: { x: 150, y: 150 } });
    // Open settings
    await openSettings(page);
    const ptRadio = page.locator('input[type="radio"][name="netMode"][value="pt"]');
    await expect(ptRadio).toBeDisabled();
    await expect(apnRadio).toBeDisabled();
    await page.getByTestId('settings-cancel').click();
  });
});


