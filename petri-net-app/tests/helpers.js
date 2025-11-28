// @ts-check

/**
 * Wait until the application UI is ready for interaction.
 * Ensures toolbar and Konva stage are visible.
 * On desktop, waits for toolbar-place in the toolbar.
 * On mobile, waits for toolbar-place in FloatingEditorControls.
 * @param {import('@playwright/test').Page} page
 */
export async function waitForAppReady(page) {
	// Wait for toolbar-place button to be visible
	// There may be 2 (desktop and mobile), so we use the helper to get the visible one
	const placeButton = await getVisibleToolbarButton(page, 'toolbar-place');
	await placeButton.waitFor({ state: 'visible' });
	
	// Prefer Konva content; fall back to stage container if needed
	try {
		await page.waitForSelector('.konvajs-content', { state: 'visible' });
	} catch (_) {
		await page.waitForSelector('.stage-container', { state: 'visible' });
	}
}

/**
 * Get the Petri net state exposed on window.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{places: any[], transitions: any[], arcs: any[]}>}
 */
export async function getPetriNetState(page) {
	return await page.evaluate(() => {
		// @ts-ignore - Custom property added for testing
		return window.__PETRI_NET_STATE__ || { places: [], transitions: [], arcs: [] };
	});
}

/**
 * Polls the app state until the predicate returns true or times out.
 * @template T
 * @param {import('@playwright/test').Page} page
 * @param {(state: {places: any[], transitions: any[], arcs: any[]}) => boolean} predicate
 * @param {{ timeout?: number, interval?: number }} [options]
 * @returns {Promise<{places: any[], transitions: any[], arcs: any[]}>}
 */
export async function waitForState(page, predicate, options) {
	const timeout = options?.timeout ?? 7000;
	const interval = options?.interval ?? 100;
	const start = Date.now();
	while (Date.now() - start < timeout) {
		const state = await getPetriNetState(page);
		if (predicate(state)) return state;
		await page.waitForTimeout(interval);
	}
	throw new Error('State condition not met within timeout');
}

/**
 * Get a visible toolbar button by test ID.
 * Handles cases where there may be multiple buttons (desktop and mobile).
 * @param {import('@playwright/test').Page} page
 * @param {string} testId
 * @returns {Promise<import('@playwright/test').Locator>}
 */
export async function getVisibleToolbarButton(page, testId) {
	const buttons = page.locator(`[data-testid="${testId}"]`);
	const count = await buttons.count();
	
	// Try to find a visible one
	for (let i = 0; i < count; i++) {
		const button = buttons.nth(i);
		const isVisible = await button.isVisible().catch(() => false);
		if (isVisible) {
			return button;
		}
	}
	
	// Fallback: return first and wait for it to be visible
	const button = buttons.first();
	await button.waitFor({ state: 'visible' });
	return button;
}

/**
 * Click on the Konva stage at a position relative to the stage.
 * Falls back to viewport coordinates if Konva container is not found.
 * @param {import('@playwright/test').Page} page
 * @param {{ x: number, y: number }} position
 */
export async function clickStage(page, position) {
	const stage = page.locator('.konvajs-content');
	if (await stage.count()) {
		await stage.first().click({ position });
		return;
	}
	const container = page.locator('.stage-container');
	if (await container.count()) {
		const box = await container.first().boundingBox();
		if (box) {
			await page.mouse.click(box.x + position.x, box.y + position.y);
			return;
		}
	}
	await page.mouse.click(position.x, position.y);
}


/**
 * Load a PNML file using the app's Load button.
 * @param {import('@playwright/test').Page} page
 * @param {string} filename - relative to tests/test-inputs
 */
export async function loadPNML(page, filename) {
  const path = await import('path');
  const loadBtn = page.getByRole('button', { name: 'Load' });
  await loadBtn.waitFor({ state: 'visible' });
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    loadBtn.click(),
  ]);
  const fullPath = path.resolve(process.cwd(), 'tests', 'test-inputs', filename);
  await fileChooser.setFiles(fullPath);
}

/**
 * Enable batch mode via Settings dialog and save.
 * @param {import('@playwright/test').Page} page
 */
export async function enableBatchMode(page) {
  const settingsButton = await getVisibleToolbarButton(page, 'toolbar-settings');
  await settingsButton.click();
  const batchCheckbox = page.locator('label:has-text("Batch mode") input[type="checkbox"]').first();
  await batchCheckbox.check();
  await page.getByTestId('settings-save').click();
}

/**
 * Wait for a run cycle where Stop becomes enabled and then disabled.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').expect} expect
 */
export async function waitStopCycle(page, expect) {
  const stopButton = page.getByTestId('sim-stop');
  await stopButton.waitFor({ state: 'visible' });
  await expect(stopButton).toBeEnabled({ timeout: 30000 });
  await expect(stopButton).toBeDisabled({ timeout: 120000 });
}

/**
 * Parse completion dialog to extract transitions and durationMs.
 * @param {import('@playwright/test').Page} page
 */
export async function readCompletionStats(page) {
  const dialog = page.locator('.bg-white.rounded-lg.shadow-xl.p-6').first();
  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  
  // Wait for stats to be populated (wait for "Transitions Fired:" text to appear)
  await page.getByText(/Transitions Fired:/).first().waitFor({ state: 'visible', timeout: 10000 });
  
  const text = await dialog.innerText();
  const tMatch = /Transitions Fired:\s*([0-9,]+)/.exec(text);
  const transitions = tMatch ? Number.parseInt(tMatch[1].replace(/,/g, ''), 10) : 0;
  const dMatch = /Duration:\s*([^\n]+)/.exec(text);
  const dTxt = dMatch ? dMatch[1].trim() : '';
  const ms = (() => {
    const trimmed = dTxt.trim();
    if (!trimmed) return Number.POSITIVE_INFINITY;
    if (trimmed.endsWith('ms')) return Number.parseFloat(trimmed.replace('ms', ''));
    if (trimmed.includes('m')) {
      const parts = trimmed.split(' ');
      let total = 0;
      for (const p of parts) {
        if (p.endsWith('m')) total += Number.parseFloat(p.replace('m', '')) * 60000;
        else if (p.endsWith('s')) total += Number.parseFloat(p.replace('s', '')) * 1000;
      }
      return total;
    }
    if (trimmed.endsWith('s')) return Number.parseFloat(trimmed.replace('s', '')) * 1000;
    return Number.POSITIVE_INFINITY;
  })();
  return { transitions, durationMs: ms };
}


