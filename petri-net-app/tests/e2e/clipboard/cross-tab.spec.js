// @ts-check
import { test, expect } from '@playwright/test';
import { waitForAppReady, getPetriNetState, clickStage, getVisibleToolbarButton, waitForState } from '../../helpers.js';

test.describe('Clipboard - Cross-tab shared clipboard', () => {
  test('copy in tab A, paste in tab B (same origin); APN mismatch blocks paste', async ({ browser }) => {
    // Cross-tab + BroadcastChannel + canvas interactions can be timing-sensitive on CI / slower machines.
    test.setTimeout(90_000);

    const context = await browser.newContext();
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    const safeClickStage = async (page, pos, opts = {}) => {
      const retries = opts.retries ?? 6;
      const delayMs = opts.delayMs ?? 200;

      // Make sure stage is present before attempting clicks.
      await page.waitForSelector('.konvajs-content', { state: 'visible', timeout: 10_000 });

      let lastErr;
      for (let i = 0; i < retries; i++) {
        try {
          await clickStage(page, pos);
          return;
        } catch (e) {
          lastErr = e;
          await page.waitForTimeout(delayMs);
        }
      }
      throw lastErr ?? new Error('safeClickStage failed');
    };

    // Open both pages
    await pageA.goto('/');
    await waitForAppReady(pageA);
    await pageB.goto('/');
    await waitForAppReady(pageB);

    // Tab A: Create a place, transition, and arc through the UI
    const placeButtonA = await getVisibleToolbarButton(pageA, 'toolbar-place');
    await placeButtonA.click();
    await safeClickStage(pageA, { x: 100, y: 100 });
    await waitForState(pageA, s => s.places.length === 1);

    const transitionButtonA = await getVisibleToolbarButton(pageA, 'toolbar-transition');
    await transitionButtonA.click();
    await safeClickStage(pageA, { x: 200, y: 100 });
    await waitForState(pageA, s => s.transitions.length === 1);

    const arcButtonA = await getVisibleToolbarButton(pageA, 'toolbar-arc');
    await arcButtonA.click();
    await safeClickStage(pageA, { x: 100, y: 100 }); // from place
    await safeClickStage(pageA, { x: 200, y: 100 }); // to transition
    await waitForState(pageA, s => s.arcs.length === 1);

    // Verify elements were created in tab A
    const stateA = await getPetriNetState(pageA);
    expect(stateA.places.length).toBe(1);
    expect(stateA.transitions.length).toBe(1);
    expect(stateA.arcs.length).toBe(1);

    // Select all elements manually (Ctrl+A not implemented)
    const selectButtonA = await getVisibleToolbarButton(pageA, 'toolbar-select');
    await selectButtonA.click();
    await pageA.waitForTimeout(300);
    
    const isMac = await pageA.evaluate(() => navigator.platform.toUpperCase().includes('MAC'));
    
    // Select transition first (click offset from arc line)
    await safeClickStage(pageA, { x: 200, y: 110 });
    await pageA.waitForTimeout(200);
    
    // Add place to selection with Shift+Click
    await pageA.keyboard.down('Shift');
    await safeClickStage(pageA, { x: 100, y: 110 });
    await pageA.keyboard.up('Shift');
    await pageA.waitForTimeout(200);

    // Copy the selection
    if (isMac) {
      await pageA.keyboard.down('Meta');
      await pageA.keyboard.press('c');
      await pageA.keyboard.up('Meta');
    } else {
      await pageA.keyboard.down('Control');
      await pageA.keyboard.press('c');
      await pageA.keyboard.up('Control');
    }
    await pageA.waitForTimeout(500);
    
    // Wait for BroadcastChannel to propagate the clipboard across tabs
    await pageB.waitForFunction(
      () => window.__PETRI_NET_CLIPBOARD__?.current?.payload != null,
      null,
      { timeout: 10_000 }
    );

    const beforeB = await getPetriNetState(pageB);
    const beforeCountsB = {
      p: beforeB.places.length || 0,
      t: beforeB.transitions.length || 0,
      a: beforeB.arcs.length || 0,
    };

    // Paste on B (PT mode)
    await pageB.bringToFront();
    const selectButtonB = await getVisibleToolbarButton(pageB, 'toolbar-select');
    await selectButtonB.click();
    await safeClickStage(pageB, { x: 200, y: 220 });
    const attemptPaste = async () => {
      if (isMac) {
        await pageB.keyboard.down('Meta'); await pageB.keyboard.press('v'); await pageB.keyboard.up('Meta');
      } else {
        await pageB.keyboard.down('Control'); await pageB.keyboard.press('v'); await pageB.keyboard.up('Control');
      }
    };
    // Try multiple times; validate via state polling to reduce flakiness.
    let ok = false;
    for (let i = 0; i < 6; i++) {
      await attemptPaste();
      try {
        await waitForState(
          pageB,
          (s) =>
            s.places.length === beforeCountsB.p + 1 &&
            s.transitions.length === beforeCountsB.t + 1 &&
            s.arcs.length === beforeCountsB.a + 1,
          { timeout: 2000, interval: 100 }
        );
        ok = true;
        break;
      } catch (_) {
        await pageB.waitForTimeout(250);
      }
    }
    expect(ok).toBeTruthy();

    // Open a fresh tab C and switch it to APN before paste to validate mismatch without clearing B
    const pageC = await context.newPage();
    await pageC.goto('/');
    await waitForAppReady(pageC);
    
    // On mobile, settings is in the menu drawer, so we need to open it first
    const isMobile = await pageC.evaluate(() => window.matchMedia('(pointer: coarse)').matches);
    if (isMobile) {
      // Open the mobile menu
      const menuButton = pageC.getByRole('button', { name: /Menu/i }).or(pageC.locator('button:has-text("Menu")'));
      await menuButton.waitFor({ state: 'visible' });
      await menuButton.click();
      await pageC.waitForTimeout(300); // Wait for drawer animation
    }
    
    // Get the visible settings button (there may be two - one for desktop, one for mobile)
    const settingsButton = await getVisibleToolbarButton(pageC, 'toolbar-settings');
    await settingsButton.click();
    const apnRadio = pageC.locator('input[type="radio"][name="netMode"][value="algebraic-int"]');
    await apnRadio.check();
    await pageC.getByTestId('settings-save').click();

    /** @type {string[]} */
    const logs = [];
    pageC.on('console', msg => logs.push(String(msg.text())));

    // Copy again from tab A to ensure clipboard is shared with new tab C
    await pageA.bringToFront();
    if (isMac) {
      await pageA.keyboard.down('Meta');
      await pageA.keyboard.press('c');
      await pageA.keyboard.up('Meta');
    } else {
      await pageA.keyboard.down('Control');
      await pageA.keyboard.press('c');
      await pageA.keyboard.up('Control');
    }
    await pageA.waitForTimeout(300);

    // Ensure pageC has received clipboard before attempting paste
    await pageC.waitForFunction(
      () => window.__PETRI_NET_CLIPBOARD__?.current?.payload != null,
      null,
      { timeout: 10_000 }
    );

    const preC = await getPetriNetState(pageC);
    const cBefore = { p: preC.places.length, t: preC.transitions.length, a: preC.arcs.length };
    
    await pageC.bringToFront();
    if (isMac) {
      await pageC.keyboard.down('Meta'); await pageC.keyboard.press('v'); await pageC.keyboard.up('Meta');
    } else {
      await pageC.keyboard.down('Control'); await pageC.keyboard.press('v'); await pageC.keyboard.up('Control');
    }
    await pageC.waitForTimeout(300);
    const postC = await getPetriNetState(pageC);
    expect(postC.places.length).toBe(cBefore.p);
    expect(postC.transitions.length).toBe(cBefore.t);
    expect(postC.arcs.length).toBe(cBefore.a);
    expect(logs.some(t => /mismatch|Blocked paste/i.test(t))).toBeTruthy();

    await context.close();
  });
});


