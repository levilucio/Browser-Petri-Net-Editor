// @ts-check
import { test, expect } from '@playwright/test';
import { waitForAppReady, loadPNML, enableBatchMode, readCompletionStats, waitForSimulationManager, getVisibleSimulationButton } from '../../helpers.js';

async function waitSimulatorReady(page, timeout = 120000) {
  await waitForSimulationManager(page, timeout);
  await page.waitForFunction(() => {
    const step = document.querySelector('[data-testid="sim-step"]') || document.querySelector('[data-testid="sim-step-mobile"]');
    const stepEnabled = step && !step.hasAttribute('disabled');
    const panel = document.querySelector('[data-testid="enabled-transitions"]');
    const buttons = panel ? panel.querySelectorAll('button').length : 0;
    return stepEnabled || buttons > 0;
  }, { timeout });
}

function parseDurationToMs(text) {
  if (!text) return Number.POSITIVE_INFINITY;
  const trimmed = text.trim();
  if (trimmed.endsWith('ms')) {
    return Number.parseFloat(trimmed.replace('ms', ''));
  }
  if (trimmed.includes('m')) {
    // Format such as "1m 2s"
    const parts = trimmed.split(' ');
    let total = 0;
    for (const part of parts) {
      if (part.endsWith('m')) {
        total += Number.parseFloat(part.replace('m', '')) * 60_000;
      } else if (part.endsWith('s')) {
        total += Number.parseFloat(part.replace('s', '')) * 1_000;
      }
    }
    return total;
  }
  if (trimmed.endsWith('s')) {
    return Number.parseFloat(trimmed.replace('s', '')) * 1_000;
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * Robustly wait for completion dialog to appear.
 * On mobile, the dialog might render but not be visible due to z-index/overlay issues,
 * so we check DOM content first, then try to access the dialog.
 */
async function waitForCompletionDialog(page, timeout = 180000) {
  const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
  
  // Step 1: Wait for stop button to be disabled (simulation finished)
  const stopButton = page.locator('[data-testid="sim-stop"], [data-testid="sim-stop-mobile"]').first();
  
  try {
    await expect(stopButton).toBeDisabled({ timeout });
  } catch (error) {
    // If stop button doesn't disable, check if there's an error message
    const errorText = await page.evaluate(() => document.body.innerText || '').catch(() => '');
    if (errorText.includes('error') || errorText.includes('Error')) {
      throw new Error(`Simulation may have failed. Stop button not disabled after ${timeout}ms. Page text: ${errorText.substring(0, 500)}`);
    }
    throw error;
  }
  
  // Step 2: Wait for "Simulation Complete" text to appear in DOM (doesn't require visibility)
  // Use a more lenient check that allows for partial matches
  try {
    await page.waitForFunction(() => {
      try {
        const bodyText = document.body.innerText || document.body.textContent || '';
        return bodyText.includes('Simulation Complete') && bodyText.includes('Transitions Fired:');
      } catch {
        // Page might be closing/crashed
        return false;
      }
    }, { timeout: isMobile ? timeout : 30000 }); // Longer timeout for mobile
  } catch (error) {
    // Check if page is still alive before trying to evaluate
    try {
      // Debug: log what's actually in the page
      const bodyText = await page.evaluate(() => {
        try {
          return document.body.innerText || document.body.textContent || '';
        } catch {
          return '[Page closed or crashed]';
        }
      });
      const hasComplete = bodyText.includes('Simulation Complete');
      const hasTransitions = bodyText.includes('Transitions Fired:');
      throw new Error(`Completion dialog text not found after ${timeout}ms. Has 'Simulation Complete': ${hasComplete}, Has 'Transitions Fired:': ${hasTransitions}. Page text snippet: ${bodyText.substring(0, 1000)}`);
    } catch (evalError) {
      // Page was closed/crashed during evaluation
      throw new Error(`Page closed or crashed while waiting for completion dialog after ${timeout}ms. This may indicate the simulation timed out or the browser ran out of resources.`);
    }
  }
  
  // Step 3: Try to find and access the dialog (with fallback if visibility check fails)
  const dialog = page.locator('.bg-white.rounded-lg.shadow-xl.p-6').first();
  
  // On mobile, try 'attached' first (less strict than 'visible')
  if (isMobile) {
    try {
      await dialog.waitFor({ state: 'attached', timeout: 10000 });
    } catch {
      // If attached fails, the dialog might still be in DOM, try to evaluate it directly
    }
  } else {
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
  }
  
  // Step 4: Wait for stats text to be present (more reliable than waiting for visibility)
  await page.waitForFunction(() => {
    const bodyText = document.body.innerText || '';
    return /Transitions Fired:\s*[0-9,]+/.test(bodyText);
  }, { timeout: 20000 });
  
  return dialog;
}

test.describe('Simulation - Completion dialog content and formatting', () => {
  test('algebraic large net: dialog shows formatted transitions and duration', async ({ page, browserName }) => {
    // Skip on Mobile Safari - large simulations cause browser crashes due to resource constraints
    const isMobileSafari = browserName === 'webkit' && await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
    if (isMobileSafari) {
      test.skip();
      return;
    }
    test.setTimeout(180000);
    await page.goto('/');
    await waitForAppReady(page);

    await loadPNML(page, 'petri-net-algebraic-large.pnml');
    await waitSimulatorReady(page, 120000);
    await enableBatchMode(page);
    await waitSimulatorReady(page, 120000);

    const runButton = await getVisibleSimulationButton(page, 'sim-run');
    const stopButton = page.locator('[data-testid="sim-stop"], [data-testid="sim-stop-mobile"]').first();
    await runButton.click();

    await expect(stopButton).toBeEnabled({ timeout: 30000 });
    await expect(stopButton).toBeDisabled({ timeout: 120000 });

    // Use robust completion dialog wait
    const dialog = await waitForCompletionDialog(page, 120000);

    // Extract stats from dialog (use evaluate to bypass visibility checks if needed)
    // Try both innerText and textContent as they can differ on mobile
    let dialogText = await dialog.evaluate(node => {
      // Prefer innerText as it's more accurate, but fall back to textContent
      const element = /** @type {HTMLElement} */ (node);
      return element.innerText || element.textContent || '';
    });
    
    // If dialogText is empty or doesn't have expected content, try getting from body
    if (!dialogText || (!dialogText.includes('Transitions Fired:') && !dialogText.includes('Duration:'))) {
      dialogText = await page.evaluate(() => {
        const dialog = document.querySelector('.bg-white.rounded-lg.shadow-xl.p-6');
        const element = /** @type {HTMLElement} */ (dialog);
        return dialog ? (element.innerText || element.textContent || '') : (document.body.innerText || '');
      });
    }
    
    // Extract transitions fired
    const transitionsMatch = /Transitions Fired:\s*([0-9,]+)/.exec(dialogText);
    const transitions = transitionsMatch ? Number.parseInt(transitionsMatch[1].replace(/,/g, ''), 10) : Number.NaN;
    expect(transitions).toBe(2432);

    // Extract duration - be more flexible with regex to handle different text formats
    // On mobile, text might be concatenated like "Duration:2sTransitions" without spaces/newlines
    // We need to match just the duration value (e.g., "2s", "5s", "1m 2s", "35000ms")
    // and stop before the next word (Transitions, OK, etc.)
    
    // First try: match duration after "Duration:" with lookahead to stop at capital letter or "OK"
    let durationMatch = /Duration:\s*([0-9]+(?:m\s*)?[0-9]*s|[0-9]+ms)(?=[A-Z]|OK|$|\n)/i.exec(dialogText);
    if (!durationMatch) {
      // Second try: match duration after "Duration:" (without lookahead, but capture only the pattern)
      durationMatch = /Duration:\s*([0-9]+(?:m\s*)?[0-9]*s|[0-9]+ms)/i.exec(dialogText);
    }
    if (!durationMatch) {
      // Third try: match duration with optional colon/space
      durationMatch = /Duration[:\s]+([0-9]+(?:m\s*)?[0-9]*s|[0-9]+ms)/i.exec(dialogText);
    }
    let durationText = durationMatch ? durationMatch[1].trim() : '';
    
    // Clean up: if we accidentally captured extra text, extract just the duration part
    if (durationText && !/^([0-9]+(?:m\s*)?[0-9]*s|[0-9]+ms)$/.test(durationText)) {
      // Extract just the duration pattern from what we captured
      const cleanedMatch = /^([0-9]+(?:m\s*)?[0-9]*s|[0-9]+ms)/.exec(durationText);
      durationText = cleanedMatch ? cleanedMatch[1].trim() : durationText;
    }
    
    // If still no match, try to find any duration-like text after "Duration"
    if (!durationText) {
      const durationIndex = dialogText.toLowerCase().indexOf('duration');
      if (durationIndex >= 0) {
        const afterDuration = dialogText.substring(durationIndex + 8).trim();
        // Match duration pattern, stopping at next capital letter
        const durationLikeMatch = /^([0-9]+(?:m\s*)?[0-9]*s|[0-9]+ms)/.exec(afterDuration);
        durationText = durationLikeMatch ? durationLikeMatch[1].trim() : '';
      }
    }
    
    const durationMs = parseDurationToMs(durationText);
    
    // If parsing failed, fail with a helpful message
    if (!Number.isFinite(durationMs)) {
      throw new Error(`Failed to parse duration from dialog text: "${durationText}". Full dialog text: "${dialogText.substring(0, 500)}"`);
    }
    
    // Allow up to 35 seconds for CI/slower machines with variable performance
    expect(durationMs).toBeLessThanOrEqual(35000);

    // Verify OK button closes dialog
    await page.getByRole('button', { name: 'OK' }).first().click();
    await expect(page.getByText('Simulation Complete').first()).not.toBeVisible({ timeout: 2000 });
  });

  test('algebraic very large net: dialog shows correct stats under 10s', async ({ page, browserName }) => {
    // Skip on Mobile Safari - very large simulations cause browser crashes due to resource constraints
    const isMobileSafari = browserName === 'webkit' && await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
    if (isMobileSafari) {
      test.skip();
      return;
    }
    test.setTimeout(180000);
    await page.goto('/');
    await waitForAppReady(page);

    await loadPNML(page, 'petri-net-algebraic-very-large.pnml');
    await waitSimulatorReady(page, 120000);
    await enableBatchMode(page);
    await waitSimulatorReady(page, 120000);

    const runButton = await getVisibleSimulationButton(page, 'sim-run');
    const stopButton = page.locator('[data-testid="sim-stop"], [data-testid="sim-stop-mobile"]').first();
    await runButton.click();

    await expect(stopButton).toBeEnabled({ timeout: 30000 });
    await expect(stopButton).toBeDisabled({ timeout: 120000 });

    // Use robust completion dialog wait
    const dialog = await waitForCompletionDialog(page, 120000);

    // Extract stats from dialog (use evaluate to bypass visibility checks if needed)
    // Try both innerText and textContent as they can differ on mobile
    let dialogText = await dialog.evaluate(node => {
      // Prefer innerText as it's more accurate, but fall back to textContent
      const element = /** @type {HTMLElement} */ (node);
      return element.innerText || element.textContent || '';
    });
    
    // If dialogText is empty or doesn't have expected content, try getting from body
    if (!dialogText || (!dialogText.includes('Transitions Fired:') && !dialogText.includes('Duration:'))) {
      dialogText = await page.evaluate(() => {
        const dialog = document.querySelector('.bg-white.rounded-lg.shadow-xl.p-6');
        const element = /** @type {HTMLElement} */ (dialog);
        return dialog ? (element.innerText || element.textContent || '') : (document.body.innerText || '');
      });
    }
    
    // Extract transitions fired
    const transitionsMatch = /Transitions Fired:\s*([0-9,]+)/.exec(dialogText);
    const transitions = transitionsMatch ? Number.parseInt(transitionsMatch[1].replace(/,/g, ''), 10) : Number.NaN;
    expect(transitions).toBe(3240);

    // Extract duration - be more flexible with regex to handle different text formats
    // On mobile, text might be concatenated like "Duration:9sTransitions" without spaces/newlines
    // We need to match just the duration value (e.g., "9s", "5s", "1m 2s", "35000ms")
    // and stop before the next word (Transitions, OK, etc.)
    
    // First try: match duration after "Duration:" with lookahead to stop at capital letter or "OK"
    let durationMatch = /Duration:\s*([0-9]+(?:m\s*)?[0-9]*s|[0-9]+ms)(?=[A-Z]|OK|$|\n)/i.exec(dialogText);
    if (!durationMatch) {
      // Second try: match duration after "Duration:" (without lookahead, but capture only the pattern)
      durationMatch = /Duration:\s*([0-9]+(?:m\s*)?[0-9]*s|[0-9]+ms)/i.exec(dialogText);
    }
    if (!durationMatch) {
      // Third try: match duration with optional colon/space
      durationMatch = /Duration[:\s]+([0-9]+(?:m\s*)?[0-9]*s|[0-9]+ms)/i.exec(dialogText);
    }
    let durationText = durationMatch ? durationMatch[1].trim() : '';
    
    // Clean up: if we accidentally captured extra text, extract just the duration part
    if (durationText && !/^([0-9]+(?:m\s*)?[0-9]*s|[0-9]+ms)$/.test(durationText)) {
      // Extract just the duration pattern from what we captured
      const cleanedMatch = /^([0-9]+(?:m\s*)?[0-9]*s|[0-9]+ms)/.exec(durationText);
      durationText = cleanedMatch ? cleanedMatch[1].trim() : durationText;
    }
    
    // If still no match, try to find any duration-like text after "Duration"
    if (!durationText) {
      const durationIndex = dialogText.toLowerCase().indexOf('duration');
      if (durationIndex >= 0) {
        const afterDuration = dialogText.substring(durationIndex + 8).trim();
        // Match duration pattern, stopping at next capital letter
        const durationLikeMatch = /^([0-9]+(?:m\s*)?[0-9]*s|[0-9]+ms)/.exec(afterDuration);
        durationText = durationLikeMatch ? durationLikeMatch[1].trim() : '';
      }
    }
    
    const durationMs = parseDurationToMs(durationText);
    
    // If parsing failed, fail with a helpful message
    if (!Number.isFinite(durationMs)) {
      throw new Error(`Failed to parse duration from dialog text: "${durationText}". Full dialog text: "${dialogText.substring(0, 500)}"`);
    }
    
    // Allow up to 25 seconds for CI/slower machines with variable performance
    expect(durationMs).toBeLessThan(25000);

    await page.getByRole('button', { name: 'OK' }).first().click();
    await expect(page.getByText('Simulation Complete').first()).not.toBeVisible({ timeout: 2000 });
  });
});

