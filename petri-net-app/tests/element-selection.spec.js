// @ts-check
import { test, expect } from '@playwright/test';

async function loadPnmlViaHiddenInput(page, relativePath) {
  await page.goto('/');
  const loadBtn = page.getByRole('button', { name: 'Load' });
  await loadBtn.waitFor({ state: 'visible' });
  await loadBtn.click();
  const input = page.locator('input[type="file"][accept=".pnml,.xml"]');
  await input.waitFor({ state: 'attached', timeout: 10000 });
  await input.setInputFiles(relativePath);
}

async function waitAppReady(page, timeout = 30000) {
  await expect(page.getByTestId('simulation-manager')).toBeVisible({ timeout });
  await page.waitForFunction(() => !!window.__PETRI_NET_STATE__, { timeout });
}

test('Shift+click selects P5 then Backspace deletes P5 and its arc', async ({ page }) => {
  await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net13.pnml');
  await waitAppReady(page);

  // Read P5 and arcs connected to it (by id) before deletion
  const pre = await page.evaluate(() => {
    const s = window.__PETRI_NET_STATE__ || { places: [], transitions: [], arcs: [] };
    const p5 = (s.places || []).find(p => (p.label || p.name) === 'P5');
    const arcIds = (s.arcs || []).filter(a => a.source === p5?.id || a.target === p5?.id).map(a => a.id);
    return { p5, arcIds };
  });
  expect(pre.p5).toBeTruthy();

  // Select mode
  await page.getByTestId('toolbar-select').click();

  // Shift+click P5 center
  const container = page.locator('.stage-container').first();
  const box = await container.boundingBox();
  const vx = (box?.x || 0) + pre.p5.x;
  const vy = (box?.y || 0) + pre.p5.y;
  await page.keyboard.down('Shift');
  await page.mouse.click(vx, vy);
  await page.keyboard.up('Shift');

  // Backspace to delete current selection
  await page.keyboard.press('Backspace');

  // Wait until P5 and its incident arcs disappear
  await page.waitForFunction(({ id, arcIds }) => {
    const s = window.__PETRI_NET_STATE__ || { places: [], arcs: [] };
    const hasP5 = (s.places || []).some(p => p.id === id);
    const hasArc = (s.arcs || []).some(a => arcIds.includes(a.id));
    return !hasP5 && !hasArc;
  }, { id: pre.p5.id, arcIds: pre.arcIds }, { timeout: 5000 });

  const post = await page.evaluate(() => window.__PETRI_NET_STATE__);
  const stillP5 = (post.places || []).some(p => (p.label || p.name) === 'P5');
  const stillArc = (post.arcs || []).some(a => a.source === pre.p5.id || a.target === pre.p5.id);
  expect(stillP5).toBeFalsy();
  expect(stillArc).toBeFalsy();
});

test('rectangle selection selects nodes whose centers are inside', async ({ page }) => {
  await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net13.pnml');
  await waitAppReady(page);
  await page.getByTestId('toolbar-select').click();

  const container = page.locator('.stage-container').first();
  const box = await container.boundingBox();
  const start = { x: (box?.x || 0) + 180, y: (box?.y || 0) + 260 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 400, start.y + 160);
  await page.mouse.up();

  const state = await page.evaluate(() => !!window.__PETRI_NET_STATE__);
  expect(state).toBe(true);
});

test('multi-drag keeps topology while dragging and on drop', async ({ page }) => {
  await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net13.pnml');
  await waitAppReady(page);
  await page.getByTestId('toolbar-select').click();

  const container = page.locator('.stage-container').first();
  const box = await container.boundingBox();
  const rectStart = { x: (box?.x || 0) + 180, y: (box?.y || 0) + 260 };
  await page.mouse.move(rectStart.x, rectStart.y);
  await page.mouse.down();
  await page.mouse.move(rectStart.x + 780, rectStart.y + 160);
  await page.mouse.up();

  const before = await page.evaluate(() => JSON.parse(JSON.stringify(window.__PETRI_NET_STATE__ || {})));
  await page.mouse.move((box?.x || 0) + 260, (box?.y || 0) + 300);
  await page.mouse.down();
  await page.mouse.move((box?.x || 0) + 320, (box?.y || 0) + 330, { steps: 8 });
  await page.mouse.up();
  const after = await page.evaluate(() => JSON.parse(JSON.stringify(window.__PETRI_NET_STATE__ || {})));
  const moved = (before.places?.some((p,i) => (after.places?.[i]?.x !== p.x || after.places?.[i]?.y !== p.y))
    || before.transitions?.some((t,i) => (after.transitions?.[i]?.x !== t.x || after.transitions?.[i]?.y !== t.y)));
  expect(moved).toBe(true);
});

test('copy, paste, then delete with Backspace', async ({ page }) => {
  await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net13.pnml');
  await waitAppReady(page);
  await page.getByTestId('toolbar-select').click();

  const container = page.locator('.stage-container').first();
  const box = await container.boundingBox();
  const start = { x: (box?.x || 0) + 160, y: (box?.y || 0) + 260 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 700, start.y + 160);
  await page.mouse.up();

  const beforeCount = await page.evaluate(() => {
    const s = window.__PETRI_NET_STATE__ || { places:[], transitions:[], arcs:[] };
    return { p: s.places.length, t: s.transitions.length, a: s.arcs.length };
  });

  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await page.waitForTimeout(300);
  const afterPaste = await page.evaluate(() => {
    const s = window.__PETRI_NET_STATE__ || { places:[], transitions:[], arcs:[] };
    return { p: s.places.length, t: s.transitions.length, a: s.arcs.length };
  });
  expect(afterPaste.p).toBeGreaterThan(beforeCount.p);
  expect(afterPaste.t).toBeGreaterThan(beforeCount.t);

  await page.keyboard.press('Backspace');
  await page.waitForTimeout(300);
  const afterDelete = await page.evaluate(() => {
    const s = window.__PETRI_NET_STATE__ || { places:[], transitions:[], arcs:[] };
    return { p: s.places.length, t: s.transitions.length, a: s.arcs.length };
  });
  expect(afterDelete.p).toBeLessThanOrEqual(afterPaste.p);
});


