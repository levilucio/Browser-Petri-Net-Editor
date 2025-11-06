// @ts-check
import { test, expect } from '@playwright/test';
import { waitForAppReady, getPetriNetState, clickStage } from '../../helpers.js';

test.describe('Clipboard - Cross-tab shared clipboard', () => {
  test('copy in tab A, paste in tab B (same origin); APN mismatch blocks paste', async ({ browser }) => {
    const context = await browser.newContext();
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    // Open both pages
    await pageA.goto('/');
    await waitForAppReady(pageA);
    await pageB.goto('/');
    await waitForAppReady(pageB);

    // Tab A: Create a place, transition, and arc through the UI
    await pageA.getByTestId('toolbar-place').click();
    await clickStage(pageA, { x: 100, y: 100 });
    await pageA.waitForTimeout(300);

    await pageA.getByTestId('toolbar-transition').click();
    await clickStage(pageA, { x: 200, y: 100 });
    await pageA.waitForTimeout(300);

    await pageA.getByTestId('toolbar-arc').click();
    await clickStage(pageA, { x: 100, y: 100 }); // from place
    await clickStage(pageA, { x: 200, y: 100 }); // to transition
    await pageA.waitForTimeout(300);

    // Verify elements were created in tab A
    const stateA = await getPetriNetState(pageA);
    expect(stateA.places.length).toBe(1);
    expect(stateA.transitions.length).toBe(1);
    expect(stateA.arcs.length).toBe(1);

    // Select all elements manually (Ctrl+A not implemented)
    await pageA.getByTestId('toolbar-select').click();
    await pageA.waitForTimeout(300);
    
    const isMac = await pageA.evaluate(() => navigator.platform.toUpperCase().includes('MAC'));
    
    // Select transition first (click offset from arc line)
    await clickStage(pageA, { x: 200, y: 110 });
    await pageA.waitForTimeout(200);
    
    // Add place to selection with Shift+Click
    await pageA.keyboard.down('Shift');
    await clickStage(pageA, { x: 100, y: 110 });
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
    // Poll pageB to verify clipboard was received
    let clipboardReceived = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      await pageB.waitForTimeout(200);
      const hasClipboard = await pageB.evaluate(() => {
        return window.__PETRI_NET_CLIPBOARD__?.current?.payload != null;
      });
      if (hasClipboard) {
        clipboardReceived = true;
        break;
      }
    }
    expect(clipboardReceived).toBeTruthy();

    const beforeB = await getPetriNetState(pageB);
    const beforeCountsB = {
      p: beforeB.places.length || 0,
      t: beforeB.transitions.length || 0,
      a: beforeB.arcs.length || 0,
    };

    // Paste on B (PT mode)
    await pageB.bringToFront();
    await pageB.getByTestId('toolbar-select').click();
    await clickStage(pageB, { x: 200, y: 220 });
    const attemptPaste = async () => {
      if (isMac) {
        await pageB.keyboard.down('Meta'); await pageB.keyboard.press('v'); await pageB.keyboard.up('Meta');
      } else {
        await pageB.keyboard.down('Control'); await pageB.keyboard.press('v'); await pageB.keyboard.up('Control');
      }
    };
    // Try up to 3 times to account for any remaining timing issues
    let ok = false;
    for (let i = 0; i < 3; i++) {
      await attemptPaste();
      await pageB.waitForTimeout(300);
      const s = await getPetriNetState(pageB);
      if (s.places.length === beforeCountsB.p + 1 && s.transitions.length === beforeCountsB.t + 1 && s.arcs.length === beforeCountsB.a + 1) { ok = true; break; }
    }
    expect(ok).toBeTruthy();

    // Open a fresh tab C and switch it to APN before paste to validate mismatch without clearing B
    const pageC = await context.newPage();
    await pageC.goto('/');
    await waitForAppReady(pageC);
    await pageC.getByTestId('toolbar-settings').click();
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


