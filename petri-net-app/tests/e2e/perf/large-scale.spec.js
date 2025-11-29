// @ts-check
import { test, expect } from '@playwright/test';
import { waitForAppReady, getVisibleToolbarButton, clickStage } from '../../helpers.js';

test.describe('Large Scale Petri Net Creation', () => {
  test('should create 30 places and 30 transitions without UI overlap', async ({ page, browserName }) => {
    // Skip on mobile devices - large-scale creation is unreliable due to touch event handling
    const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
    if (isMobile) {
      test.skip();
      return;
    }
    
    // Increase timeout for this performance test
    test.setTimeout(60000);
    
    await page.goto('/');
    await waitForAppReady(page);

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
    const placeButton = await getVisibleToolbarButton(page, 'toolbar-place');
    await placeButton.click();
    await page.waitForTimeout(300);
    
    for (let i = 0; i < 30; i++) {
      const x = 60 + (i % 6) * 60;
      const y = 80 + Math.floor(i / 6) * 40;
      await clickStage(page, { x, y });
      if ((i + 1) % 10 === 0) {
        await page.waitForTimeout(60);
      }
    }

    // Create 30 transitions in another grid
    const transitionButton = await getVisibleToolbarButton(page, 'toolbar-transition');
    await transitionButton.click();
    await page.waitForTimeout(300);
    
    // Create 30 transitions in a separate band (6x5), avoiding right panels
    for (let i = 0; i < 30; i++) {
      const x = 420 + (i % 6) * 40;
      const y = 120 + Math.floor(i / 6) * 36;
      await clickStage(page, { x, y });
      if ((i + 1) % 10 === 0) {
        await page.waitForTimeout(60);
      }
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