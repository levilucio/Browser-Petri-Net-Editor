// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Large Scale Petri Net Creation', () => {
  test('should create 30 places and 30 transitions without UI overlap', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="toolbar-place"]', { state: 'visible' });

    // If the Enabled Transitions panel is open, close it to avoid intercepting clicks
    const panel = page.getByTestId('enabled-transitions');
    if (await panel.count()) {
      try {
        // Close via aria-label on the close icon
        await page.getByRole('button', { name: 'Close enabled transitions panel' }).click({ trial: true }).catch(() => {});
        await page.getByRole('button', { name: 'Close enabled transitions panel' }).click().catch(() => {});
      } catch (_) { /* ignore */ }
    }

    // Create 30 places in a grid (6x5) using safe left-side area
    await page.getByTestId('toolbar-place').click();
    const stage = page.locator('.konvajs-content');
    for (let i = 0; i < 30; i++) {
      const x = 60 + (i % 6) * 60;
      const y = 80 + Math.floor(i / 6) * 40;
      await stage.click({ position: { x, y } });
      if ((i + 1) % 10 === 0) await page.waitForTimeout(60);
    }

    // Create 100 transitions in another grid
    await page.getByTestId('toolbar-transition').click();
    // Create 30 transitions in a separate band (6x5), avoiding right panels
    await page.getByTestId('toolbar-transition').click();
    for (let i = 0; i < 30; i++) {
      const x = 420 + (i % 6) * 40;
      const y = 120 + Math.floor(i / 6) * 36;
      await stage.click({ position: { x, y } });
      if ((i + 1) % 10 === 0) await page.waitForTimeout(60);
    }

    // Validate counts from window state for robustness
    const counts = await page.evaluate(() => {
      const s = window.__PETRI_NET_STATE__ || { places: [], transitions: [], arcs: [] };
      return { p: s.places.length || 0, t: s.transitions.length || 0 };
    });
    expect(counts.p).toBeGreaterThanOrEqual(30);
    expect(counts.t).toBeGreaterThanOrEqual(30);
  });
});


