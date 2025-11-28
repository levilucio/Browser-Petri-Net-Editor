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
 * On mobile, opens the menu first if needed.
 * Some buttons have different test IDs on mobile (e.g., toolbar-adt-manager vs toolbar-adt-manager-mobile).
 * Returns a wrapped locator that handles mobile-specific click behavior.
 * @param {import('@playwright/test').Page} page
 * @param {string} testId
 * @returns {Promise<import('@playwright/test').Locator>}
 */
export async function getVisibleToolbarButton(page, testId) {
	// On mobile, open the menu first if needed
	await openMobileMenuIfNeeded(page);
	
	const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
	
	// Check for the standard test ID
	let buttons = page.locator(`[data-testid="${testId}"]`);
	let count = await buttons.count();
	
	// Some buttons have a mobile variant (e.g., toolbar-adt-manager -> toolbar-adt-manager-mobile)
	const mobileVariant = `${testId}-mobile`;
	const mobileButtons = page.locator(`[data-testid="${mobileVariant}"]`);
	const mobileCount = await mobileButtons.count();
	
	// Combine both selectors
	if (mobileCount > 0) {
		buttons = page.locator(`[data-testid="${testId}"], [data-testid="${mobileVariant}"]`);
		count = await buttons.count();
	}
	
	// Try to find a visible one
	for (let i = 0; i < count; i++) {
		const button = buttons.nth(i);
		const isVisible = await button.isVisible().catch(() => false);
		if (isVisible) {
			// On mobile, use force click to bypass viewport restrictions
			if (isMobile) {
				// Create a wrapper that forces clicks on mobile
				return createMobileClickableButton(page, button);
			}
			return button;
		}
	}
	
	// Fallback: return first and wait for it to be visible
	const button = buttons.first();
	await button.waitFor({ state: 'visible' });
	
	if (isMobile) {
		return createMobileClickableButton(page, button);
	}
	return button;
}

/**
 * Creates a locator wrapper that uses JS click on mobile.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} locator
 * @returns {import('@playwright/test').Locator}
 */
function createMobileClickableButton(page, locator) {
	// Return the locator but the caller should use force: true when clicking
	// We'll handle this in the helper functions that use getVisibleToolbarButton
	return locator;
}

/**
 * Click on the Konva stage at a position relative to the stage.
 * Falls back to viewport coordinates if Konva container is not found.
 * On mobile, uses force click to bypass any overlays.
 * @param {import('@playwright/test').Page} page
 * @param {{ x: number, y: number }} position
 */
export async function clickStage(page, position) {
	const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
	const stage = page.locator('.konvajs-content');
	if (await stage.count()) {
		await stage.first().scrollIntoViewIfNeeded().catch(() => {});
		await page.waitForTimeout(150); // allow scroll to settle
		await stage.first().click({ position, force: isMobile });
		return;
	}
	const container = page.locator('.stage-container');
	if (await container.count()) {
		await container.first().scrollIntoViewIfNeeded().catch(() => {});
		await page.waitForTimeout(150);
		const box = await container.first().boundingBox();
		if (box) {
			await page.mouse.click(box.x + position.x, box.y + position.y);
			return;
		}
	}
	await page.mouse.click(position.x, position.y);
}


/**
 * Open the mobile menu if on a mobile viewport.
 * @param {import('@playwright/test').Page} page
 */
export async function openMobileMenuIfNeeded(page) {
  // Check if we're on a mobile viewport (< 1024px) which uses the mobile menu
  const isMobileViewport = await page.evaluate(() => {
    return window.matchMedia('(max-width: 1023px)').matches;
  });
  
  if (isMobileViewport) {
    // Check if menu button is visible (the Menu button that opens the drawer)
    const menuButton = page.getByRole('button', { name: /Menu/i }).or(page.locator('button:has-text("Menu")'));
    
    if (await menuButton.count() > 0) {
      const isMenuButtonVisible = await menuButton.isVisible().catch(() => false);
      
      if (isMenuButtonVisible) {
        // Check if drawer is already open by checking if drawer content (Load button) is visible
        const drawerContent = page.locator('.lg\\:hidden').getByRole('button', { name: 'Load' });
        const isContentVisible = await drawerContent.count() > 0 && await drawerContent.isVisible({ timeout: 100 }).catch(() => false);
        
        if (!isContentVisible) {
          // Check if backdrop exists - if it does, drawer might be partially open, close it first
          const backdrop = page.locator('.lg\\:hidden .opacity-40');
          const backdropExists = await backdrop.count() > 0;
          
          if (backdropExists) {
            // Click backdrop to close drawer, then open it again
            await backdrop.click({ force: true });
            await page.waitForTimeout(200);
          }
          
          // Use force click to bypass any overlays
          await menuButton.click({ force: true });
          // Wait for drawer content to appear (drawer is open)
          try {
            await drawerContent.waitFor({ state: 'visible', timeout: 2000 });
          } catch {
            // Fallback: wait for drawer heading
            const drawerHeading = page.locator('.lg\\:hidden').getByText('Menu').filter({ hasText: /^Menu$/ });
            await drawerHeading.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {
              // Final fallback - just wait a bit
              return page.waitForTimeout(500);
            });
          }
        }
      }
    }
  }
}

/**
 * Load a PNML file using the app's Load button.
 * Uses setInputFiles on the dynamically created input element instead of filechooser event.
 * This works better on mobile browsers, especially in headless mode.
 * @param {import('@playwright/test').Page} page
 * @param {string} filename - relative to tests/test-inputs
 */
export async function loadPNML(page, filename) {
  const path = await import('path');
  
  // On mobile, open the menu first
  await openMobileMenuIfNeeded(page);
  
  const loadBtn = page.getByRole('button', { name: 'Load' });
  await loadBtn.waitFor({ state: 'visible' });
  
  // On mobile, the button might be in a drawer. Use JavaScript click to bypass viewport checks
  const isMobileViewport = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
  if (isMobileViewport) {
    // Use JavaScript click which works even if element is outside viewport
    await loadBtn.evaluate((btn) => btn.click());
  } else {
    await loadBtn.click();
  }
  
  // Wait for the dynamically created file input to appear
  const input = page.locator('input[type="file"][accept=".pnml,.xml"]');
  await input.waitFor({ state: 'attached', timeout: 10000 });
  
  // Use setInputFiles directly instead of filechooser event (works better on mobile)
  const fullPath = path.resolve(process.cwd(), 'tests', 'test-inputs', filename);
  await input.setInputFiles(fullPath);
}

/**
 * Enable batch mode via Settings dialog and save.
 * @param {import('@playwright/test').Page} page
 */
export async function enableBatchMode(page) {
  const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
  const settingsButton = await getVisibleToolbarButton(page, 'toolbar-settings');
  if (isMobile) {
    await settingsButton.evaluate(node => node.click());
  } else {
    await settingsButton.click();
  }
  await page.getByText('Simulation Settings').waitFor({ state: 'visible' });
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
 * Wait for the simulation manager to be ready.
 * On desktop, waits for simulation-manager to be visible.
 * On mobile, waits for simulation-manager-mobile and expands it if collapsed.
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout
 */
export async function waitForSimulationManager(page, timeout = 60000) {
  const isMobileViewport = await page.evaluate(() => {
    return window.matchMedia('(max-width: 1023px)').matches;
  });
  
  if (isMobileViewport) {
    // On mobile, check for simulation-manager-mobile
    const mobileManager = page.locator('[data-testid="simulation-manager-mobile"]');
    await mobileManager.waitFor({ state: 'attached', timeout });
    
    await ensureMobileSimulationDrawerExpanded(page);
  } else {
    // On desktop, wait for simulation-manager
    const desktopManager = page.locator('[data-testid="simulation-manager"]');
    await desktopManager.waitFor({ state: 'visible', timeout });
  }
}

/**
 * Get the visible simulation button by test ID.
 * On mobile, prioritizes mobile variants (e.g., sim-step-mobile over sim-step).
 * @param {import('@playwright/test').Page} page
 * @param {string} testId - Base test ID (e.g., 'sim-step')
 * @returns {Promise<import('@playwright/test').Locator>}
 */
export async function getVisibleSimulationButton(page, testId) {
  const isMobileViewport = await page.evaluate(() => {
    return window.matchMedia('(max-width: 1023px)').matches;
  });

  if (isMobileViewport) {
    await ensureMobileSimulationDrawerExpanded(page);
  }

  const mobileButton = page.locator(`[data-testid="${testId}-mobile"]`);
  const desktopButton = page.locator(`[data-testid="${testId}"]`);
  
  if (isMobileViewport) {
    // On mobile, prioritize mobile variant
    const mobileCount = await mobileButton.count();
    if (mobileCount > 0) {
      for (let i = 0; i < mobileCount; i++) {
        const button = mobileButton.nth(i);
        if (await button.isVisible().catch(() => false)) {
          await button.scrollIntoViewIfNeeded().catch(() => {});
          return button;
        }
      }
      await mobileButton.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      await mobileButton.first().scrollIntoViewIfNeeded().catch(() => {});
      return mobileButton.first();
    }
    
    const desktopCount = await desktopButton.count();
    if (desktopCount > 0) {
      for (let i = 0; i < desktopCount; i++) {
        const button = desktopButton.nth(i);
        if (await button.isVisible().catch(() => false)) {
          await button.scrollIntoViewIfNeeded().catch(() => {});
          return button;
        }
      }
    }
    
    const combined = page.locator(`[data-testid="${testId}"], [data-testid="${testId}-mobile"]`);
    await combined.first().waitFor({ state: 'visible', timeout: 10000 });
    await combined.first().scrollIntoViewIfNeeded().catch(() => {});
    return combined.first();
  }
  
  // Desktop: use desktop variant
  await desktopButton.first().waitFor({ state: 'visible', timeout: 10000 });
  await desktopButton.first().scrollIntoViewIfNeeded().catch(() => {});
  return desktopButton.first();
}

/**
 * Parse completion dialog to extract transitions and durationMs.
 * @param {import('@playwright/test').Page} page
 */
export async function readCompletionStats(page) {
  const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
  const dialog = page.locator('.bg-white.rounded-lg.shadow-xl.p-6').first();
  
  // On mobile, use 'attached' instead of 'visible' to be more lenient
  if (isMobile) {
    await dialog.waitFor({ state: 'attached', timeout: 10000 }).catch(() => {
      // If attached fails, the dialog might still be in DOM, try to evaluate it directly
    });
  } else {
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
  }
  
  // Wait for stats to be populated (wait for "Transitions Fired:" text to appear in DOM, not just visible)
  await page.waitForFunction(() => {
    const bodyText = document.body.innerText || document.body.textContent || '';
    return /Transitions Fired:\s*[0-9,]+/.test(bodyText);
  }, { timeout: 10000 });
  
  // Use evaluate to get text content directly, bypassing visibility checks on mobile
  const text = await dialog.evaluate(node => node.innerText || node.textContent || '');
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

/**
 * Ensure the mobile simulation drawer is expanded so buttons are visible.
 * @param {import('@playwright/test').Page} page
 */
async function ensureMobileSimulationDrawerExpanded(page) {
  const mobileManager = page.locator('[data-testid="simulation-manager-mobile"]');
  if (!await mobileManager.count()) {
    return;
  }
  const stepButton = page.locator('[data-testid="sim-step-mobile"]');
  const isExpanded = await stepButton.isVisible().catch(() => false);
  if (isExpanded) {
    return;
  }

  const dragHandle = mobileManager.locator('button[title="Tap to expand/collapse"]').first();
  if (await dragHandle.count()) {
    await dragHandle.scrollIntoViewIfNeeded().catch(() => {});
    await dragHandle.click({ force: true });
  } else {
    await mobileManager.first().click({ force: true });
  }
  await page.waitForTimeout(350);
  await stepButton.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
}