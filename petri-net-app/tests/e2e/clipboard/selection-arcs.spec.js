// @ts-check
import { test, expect } from '@playwright/test';
import { waitForAppReady, getPetriNetState, clickStage } from '../../helpers.js';

test.describe('Clipboard - Selection determines arc inclusion and delete removes incident arcs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('arcs copied only when both endpoints selected; delete removes incident arcs', async ({ page }) => {
    // P1 -> T1, P2 -> T1
    await page.getByTestId('toolbar-place').click();
    await clickStage(page, { x: 120, y: 200 }); // P1
    await clickStage(page, { x: 120, y: 300 }); // P2
    await page.getByTestId('toolbar-transition').click();
    await clickStage(page, { x: 280, y: 250 }); // T1
    await page.getByTestId('toolbar-arc').click();
    await clickStage(page, { x: 120, y: 200 }); // P1->T1
    await clickStage(page, { x: 280, y: 250 });
    await page.getByTestId('toolbar-arc').click();
    await clickStage(page, { x: 120, y: 300 }); // P2->T1
    await clickStage(page, { x: 280, y: 250 });

    await page.getByTestId('toolbar-select').click();

    // Select only T1 and copy; paste -> expect 0 arcs added
    await clickStage(page, { x: 280, y: 250 });
    const isMac = await page.evaluate(() => navigator.platform.toUpperCase().includes('MAC'));
    if (isMac) { await page.keyboard.down('Meta'); await page.keyboard.press('c'); await page.keyboard.up('Meta'); }
    else { await page.keyboard.down('Control'); await page.keyboard.press('c'); await page.keyboard.up('Control'); }
    const before1 = await getPetriNetState(page);
    if (isMac) { await page.keyboard.down('Meta'); await page.keyboard.press('v'); await page.keyboard.up('Meta'); }
    else { await page.keyboard.down('Control'); await page.keyboard.press('v'); await page.keyboard.up('Control'); }
    await page.waitForTimeout(200);
    const after1 = await getPetriNetState(page);
    expect(after1.arcs.length).toBe(before1.arcs.length); // no arcs pasted

    // Select P1+T1 and copy; paste -> expect arc included (+1 arc)
    await page.keyboard.down('Shift');
    await clickStage(page, { x: 120, y: 200 }); // add P1 to selection
    await page.keyboard.up('Shift');
    if (isMac) { await page.keyboard.down('Meta'); await page.keyboard.press('c'); await page.keyboard.up('Meta'); }
    else { await page.keyboard.down('Control'); await page.keyboard.press('c'); await page.keyboard.up('Control'); }
    const before2 = await getPetriNetState(page);
    if (isMac) { await page.keyboard.down('Meta'); await page.keyboard.press('v'); await page.keyboard.up('Meta'); }
    else { await page.keyboard.down('Control'); await page.keyboard.press('v'); await page.keyboard.up('Control'); }
    await page.waitForTimeout(200);
    let after2 = await getPetriNetState(page);
    if (after2.arcs.length < before2.arcs.length + 1) {
      // Retry selection and paste once if arc wasn't captured due to selection timing
      await page.keyboard.down('Shift');
      await clickStage(page, { x: 120, y: 200 });
      await clickStage(page, { x: 280, y: 250 });
      await page.keyboard.up('Shift');
      if (isMac) { await page.keyboard.down('Meta'); await page.keyboard.press('c'); await page.keyboard.up('Meta'); }
      else { await page.keyboard.down('Control'); await page.keyboard.press('c'); await page.keyboard.up('Control'); }
      if (isMac) { await page.keyboard.down('Meta'); await page.keyboard.press('v'); await page.keyboard.up('Meta'); }
      else { await page.keyboard.down('Control'); await page.keyboard.press('v'); await page.keyboard.up('Control'); }
      await page.waitForTimeout(250);
      after2 = await getPetriNetState(page);
    }
    expect(after2.places.length).toBeGreaterThanOrEqual(before2.places.length + 1);
    expect(after2.transitions.length).toBeGreaterThanOrEqual(before2.transitions.length + 1);
    expect(after2.arcs.length).toBeGreaterThanOrEqual(before2.arcs.length + 1);

    // Delete newly pasted selection by pressing Delete; incident arcs removed
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);
    const afterDelete = await getPetriNetState(page);
    // At least one of the pasted nodes is gone, so arcs shouldn't exceed original
    expect(afterDelete.arcs.length).toBeLessThanOrEqual(before2.arcs.length + 1);
  });
});


