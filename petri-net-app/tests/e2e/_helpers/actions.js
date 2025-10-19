// @ts-check
import { waitForAppReady, getPetriNetState, waitForState, clickStage } from '../../helpers.js';

/**
 * Rectangle select on Konva stage.
 * @param {import('@playwright/test').Page} page
 * @param {{x:number,y:number}} start
 * @param {{x:number,y:number}} end
 */
export async function rectangleSelect(page, start, end) {
  const stage = page.locator('.konvajs-content');
  await stage.dispatchEvent('mousedown', { clientX: start.x, clientY: start.y, buttons: 1 });
  await stage.dispatchEvent('mousemove', { clientX: end.x, clientY: end.y, buttons: 1 });
  await stage.dispatchEvent('mouseup', { clientX: end.x, clientY: end.y });
}

/**
 * Drag from a start position by a delta on Konva stage.
 * @param {import('@playwright/test').Page} page
 * @param {{x:number,y:number}} start
 * @param {{dx:number,dy:number}} delta
 */
export async function dragBy(page, start, delta) {
  const stage = page.locator('.konvajs-content');
  const end = { x: start.x + delta.dx, y: start.y + delta.dy };
  await stage.dispatchEvent('mousedown', { clientX: start.x, clientY: start.y, buttons: 1 });
  await stage.dispatchEvent('mousemove', { clientX: end.x, clientY: end.y, buttons: 1 });
  await stage.dispatchEvent('mouseup', { clientX: end.x, clientY: end.y });
}

/** Click transition button in Enabled Transitions panel by label or id */
export async function fireTransition(page, nameOrId) {
  await page.getByTestId(`enabled-${nameOrId}`).click();
}

export { waitForAppReady, getPetriNetState, waitForState, clickStage };


