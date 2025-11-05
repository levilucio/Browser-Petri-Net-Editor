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

    const beforeB = await getPetriNetState(pageB);
    const beforeCountsB = {
      p: beforeB.places.length || 0,
      t: beforeB.transitions.length || 0,
      a: beforeB.arcs.length || 0,
    };

    // Simulate a remote tab broadcasting a clipboard payload (PT net)
    await pageA.evaluate(() => {
      const channel = new BroadcastChannel('petri-net-shared-clipboard');
      const payload = {
        places: [{ id: 'p1', x: 100, y: 100 }],
        transitions: [{ id: 't1', x: 200, y: 100 }],
        arcs: [{ id: 'a1', source: 'p1', target: 't1' }],
      };
      channel.postMessage({
        type: 'PETRI_NET_CLIPBOARD_UPDATE',
        payload,
        netMode: 'pt',
        instanceId: 'remote-tab',
        timestamp: Date.now(),
      });
    });

    // Paste on B (PT mode)
    await pageB.getByTestId('toolbar-select').click();
    await clickStage(pageB, { x: 200, y: 220 });
    const isMacB = await pageB.evaluate(() => navigator.platform.toUpperCase().includes('MAC'));
    const attemptPaste = async () => {
      if (isMacB) {
        await pageB.keyboard.down('Meta'); await pageB.keyboard.press('v'); await pageB.keyboard.up('Meta');
      } else {
        await pageB.keyboard.down('Control'); await pageB.keyboard.press('v'); await pageB.keyboard.up('Control');
      }
    };
    // Try up to 3 times to account for timing of shared clipboard propagation
    let ok = false;
    for (let i = 0; i < 3; i++) {
      await attemptPaste();
      await pageB.waitForTimeout(200);
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

    // Re-broadcast the clipboard so page C receives it
    await pageA.evaluate(() => {
      const channel = new BroadcastChannel('petri-net-shared-clipboard');
      const payload = {
        places: [{ id: 'p1', x: 100, y: 100 }],
        transitions: [{ id: 't1', x: 200, y: 100 }],
        arcs: [{ id: 'a1', source: 'p1', target: 't1' }],
      };
      channel.postMessage({ type: 'PETRI_NET_CLIPBOARD_UPDATE', payload, netMode: 'pt', instanceId: 'remote-tab', timestamp: Date.now() });
    });

    const preC = await getPetriNetState(pageC);
    const cBefore = { p: preC.places.length, t: preC.transitions.length, a: preC.arcs.length };
    if (isMacB) {
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


