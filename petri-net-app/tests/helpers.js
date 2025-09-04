// @ts-check

/**
 * Wait until the application UI is ready for interaction.
 * Ensures toolbar and Konva stage are visible.
 * @param {import('@playwright/test').Page} page
 */
export async function waitForAppReady(page) {
	await page.waitForSelector('[data-testid="toolbar-place"]', { state: 'visible' });
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


