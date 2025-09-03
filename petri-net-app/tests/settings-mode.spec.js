// @ts-check
import { test, expect } from '@playwright/test';

// Helpers to interact with the app state and UI
async function openSettings(page) {
  await page.getByTestId('toolbar-settings').click();
  await expect(page.getByText('Simulation Settings')).toBeVisible();
}

async function closeSettings(page) {
  await page.getByRole('button', { name: '×' }).click();
}

async function clearCanvas(page) {
  await page.getByRole('button', { name: 'Clear' }).click();
  // Wait a tick and verify state is empty
  await page.waitForTimeout(200);
  const counts = await page.evaluate(() => {
    // @ts-ignore - test hook
    const s = window.__PETRI_NET_STATE__ || { places: [], transitions: [], arcs: [] };
    return { p: s.places.length || 0, t: s.transitions.length || 0, a: s.arcs.length || 0 };
  });
  expect(counts.p + counts.t + counts.a).toBe(0);
}

async function addSimplePTNet(page) {
  // Add place
  await page.getByTestId('toolbar-place').click();
  await page.waitForTimeout(100);
  await page.mouse.click(200, 200);
  await page.waitForTimeout(100);
  // Add transition
  await page.getByTestId('toolbar-transition').click();
  await page.waitForTimeout(100);
  await page.mouse.click(320, 200);
  await page.waitForTimeout(100);
  // Add arc P->T
  await page.getByTestId('toolbar-arc').click();
  await page.waitForTimeout(100);
  await page.mouse.click(200, 200);
  await page.waitForTimeout(100);
  await page.mouse.click(320, 200);
  await page.waitForTimeout(200);
}

async function setNetModeToAlgebraicWhenEmpty(page) {
  await openSettings(page);
  const ptRadio = page.locator('input[type="radio"][name="netMode"][value="pt"]');
  const algRadio = page.locator('input[type="radio"][name="netMode"][value="algebraic-int"]');
  await expect(ptRadio).toBeEnabled();
  await expect(algRadio).toBeEnabled();
  await algRadio.check();
  await page.getByRole('button', { name: 'Save' }).click();
  // Give time for settings to persist
  await page.waitForTimeout(150);
}

async function createAlgebraicClue(page) {
  // Switch to algebraic mode while empty, then add a transition and place as a minimal net
  await setNetModeToAlgebraicWhenEmpty(page);
  await addSimplePTNet(page);
}

test.describe('Settings: net type switching rules', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Ensure empty canvas at start of each test
    await clearCanvas(page);
  });

  test('Empty canvas: can switch between P/T and Algebraic', async ({ page }) => {
    await openSettings(page);
    const ptRadio = page.locator('input[type="radio"][name="netMode"][value="pt"]');
    const algRadio = page.locator('input[type="radio"][name="netMode"][value="algebraic-int"]');

    await expect(ptRadio).toBeEnabled();
    await expect(algRadio).toBeEnabled();

    // Toggle to Algebraic and save
    await algRadio.check();
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(150);

    // Re-open settings and verify radios still enabled (canvas still empty)
    await openSettings(page);
    await expect(ptRadio).toBeEnabled();
    await expect(algRadio).toBeEnabled();
    await closeSettings(page);
  });

  test('Canvas has P/T net: net type radios are disabled (locked)', async ({ page }) => {
    await addSimplePTNet(page);
    await openSettings(page);
    const ptRadio = page.locator('input[type="radio"][name="netMode"][value="pt"]');
    const algRadio = page.locator('input[type="radio"][name="netMode"][value="algebraic-int"]');
    await expect(ptRadio).toBeDisabled();
    await expect(algRadio).toBeDisabled();
  });

  test('Canvas has Algebraic net: net type radios are disabled (locked)', async ({ page }) => {
    await createAlgebraicClue(page);
    await openSettings(page);
    const ptRadio = page.locator('input[type="radio"][name="netMode"][value="pt"]');
    const algRadio = page.locator('input[type="radio"][name="netMode"][value="algebraic-int"]');
    await expect(ptRadio).toBeDisabled();
    await expect(algRadio).toBeDisabled();
  });
});


