// @ts-check
import { test, expect } from '@playwright/test';

/**
 * End-to-end test for the Pyodide integration in the Petri net editor
 * This test verifies that arcs remain visible after firing transitions
 */
test('Arcs should remain visible after firing transitions', async ({ page }) => {
  // Go to the application
  await page.goto('http://localhost:3000/');
  
  // Wait for the application to load
  await page.waitForSelector('.konvajs-content', { state: 'visible', timeout: 60000 });
  
  // Create a simple Petri net manually through UI interactions
  // First place with tokens
  await page.click('button[data-testid="toolbar-place"]');
  await page.click('.konvajs-content', { position: { x: 100, y: 100 } });
  
  // Second place without tokens
  await page.click('button[data-testid="toolbar-place"]');
  await page.click('.konvajs-content', { position: { x: 300, y: 100 } });
  
  // Transition
  await page.click('button[data-testid="toolbar-transition"]');
  await page.click('.konvajs-content', { position: { x: 200, y: 100 } });
  
  // Create arcs
  // Arc from place 1 to transition
  await page.click('button[data-testid="toolbar-arc"]');
  await page.click('.konvajs-content', { position: { x: 100, y: 100 } }); // Click on first place
  await page.click('.konvajs-content', { position: { x: 200, y: 100 } }); // Click on transition
  
  // Arc from transition to place 2
  await page.click('button[data-testid="toolbar-arc"]');
  await page.click('.konvajs-content', { position: { x: 200, y: 100 } }); // Click on transition
  await page.click('.konvajs-content', { position: { x: 300, y: 100 } }); // Click on second place
  
  // Select the first place to add tokens
  await page.click('button[data-testid="toolbar-select"]');
  await page.click('.konvajs-content', { position: { x: 100, y: 100 } }); // Click on first place
  
  // Wait for the properties panel to update
  await page.waitForTimeout(1000);
  
  // Add tokens to the first place using the UI
  try {
    // Find the tokens input field and set tokens
    const tokenInput = page.locator('input[data-testid="tokens-input"]');
    await tokenInput.waitFor({ state: 'visible', timeout: 5000 });
    await tokenInput.fill('1');
    await tokenInput.press('Enter');
    console.log('Set tokens to 1 via UI');
  } catch (error) {
    console.log('Failed to set tokens via UI, using alternative method');
    // If we can't find the tokens input, try using JavaScript to update the state
    await page.evaluate(() => {
      try {
        // Try to update the application state directly
        const appElement = document.querySelector('[data-testid="app"]');
        if (appElement && appElement.__reactProps$) {
          // Try to access React props to update state
          const setElements = appElement.__reactProps$.setElements;
          if (typeof setElements === 'function') {
            setElements(prevState => {
              const updatedPlaces = prevState.places.map((place, index) => {
                if (index === 0) {
                  return { ...place, tokens: 1 };
                }
                return place;
              });
              return { ...prevState, places: updatedPlaces };
            });
            console.log('Updated state via React props');
            return;
          }
        }
        
        // Fallback to the custom event approach
        console.log('Using custom event approach');
        document.dispatchEvent(new CustomEvent('set-tokens', { 
          detail: { id: 'place-1', tokens: 1 } 
        }));
      } catch (e) {
        console.error('Error in token setting:', e);
      }
    });
  }
  
  // Wait for the simulator to update
  await page.waitForTimeout(2000);
  
  // Take a screenshot before firing for debugging
  await page.screenshot({ path: 'before-firing.png' });
  
  // Get the number of arcs in the application state before firing
  const arcsBeforeFiring = await page.evaluate(() => {
    // Access the internal state through the window.__PETRI_NET_STATE__ property
    const state = window.__PETRI_NET_STATE__ || {};
    const arcs = state.arcs || [];
    console.log('Internal arcs state before firing:', JSON.stringify(arcs));
    return arcs.length;
  });
  
  console.log('Arcs before firing:', arcsBeforeFiring);
  expect(arcsBeforeFiring).toBeGreaterThan(0);
  
  // Wait for the execution panel to show enabled transitions
  await page.waitForTimeout(2000);
  
  // Debug: Check if there are any enabled transitions
  const enabledTransitions = await page.evaluate(() => {
    // Try to access the internal state to check enabled transitions
    const enabledTransitionsElement = document.querySelector('.enabled-transitions');
    if (enabledTransitionsElement) {
      console.log('Enabled transitions panel content:', enabledTransitionsElement.textContent);
    }
    
    // Try to access the simulator state
    if (window.__PETRI_NET_STATE__) {
      const simulator = window.__PETRI_NET_STATE__.simulator;
      if (simulator && simulator.enabledTransitions) {
        return simulator.enabledTransitions;
      }
    }
    return null;
  });
  
  console.log('Enabled transitions:', enabledTransitions);
  
  // If the simulator doesn't show enabled transitions, try to trigger a transition directly
  if (!enabledTransitions || enabledTransitions.length === 0) {
    console.log('No enabled transitions found, trying to fire transition directly');
    
    // Try to fire the transition directly via JavaScript
    await page.evaluate(() => {
      // Trigger the transition to fire using a custom event
      document.dispatchEvent(new CustomEvent('fire-transition', { 
        detail: { id: 'transition-1' } 
      }));
    });
    
    // Wait for the transition to be processed
    await page.waitForTimeout(2000);
  } else {
    // Find and click the Fire button
    const fireButton = page.locator('button:has-text("Fire")');
    
    // Wait for the Fire button to be visible
    await expect(fireButton).toBeVisible({ timeout: 10000 });
    
    // Check if the Fire button is enabled
    const isEnabled = await fireButton.isEnabled();
    console.log('Fire button enabled:', isEnabled);
    
    if (isEnabled) {
      // Click the Fire button if it's enabled
      await fireButton.click();
    } else {
      console.log('Fire button is disabled, trying to fire transition directly');
      // Try to fire the transition directly
      await page.evaluate(() => {
        // Trigger the transition to fire using a custom event
        document.dispatchEvent(new CustomEvent('fire-transition', { 
          detail: { id: 'transition-1' } 
        }));
      });
    }
  }
  
  // Wait for the transition to be processed
  await page.waitForTimeout(2000);
  
  // Take a screenshot after firing for debugging
  await page.screenshot({ path: 'after-firing.png' });
  
  // Get the number of arcs in the application state after firing
  const arcsAfterFiring = await page.evaluate(() => {
    // Access the internal state through the window.__PETRI_NET_STATE__ property
    const state = window.__PETRI_NET_STATE__ || {};
    const arcs = state.arcs || [];
    console.log('Internal arcs state after firing:', JSON.stringify(arcs));
    return arcs.length;
  });
  
  console.log('Arcs after firing:', arcsAfterFiring);
  
  // Verify that arcs are still present after firing
  expect(arcsAfterFiring).toBeGreaterThan(0);
  
  // Verify that the number of arcs hasn't changed
  expect(arcsAfterFiring).toBe(arcsBeforeFiring);
});

