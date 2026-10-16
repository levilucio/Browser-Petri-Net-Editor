import { test, expect } from '@playwright/test';

async function openExamples(page) {
  const button = page.getByRole('button', { name: 'Examples', exact: true });
  if (await page.getByLabel('Open toolbar menu').isVisible()) await page.getByLabel('Open toolbar menu').click();
  await button.click();
}
async function openSatel(page) {
  const desktop = page.getByTestId('toolbar-satel');
  if (await desktop.isVisible()) await desktop.click();
  else {
    await page.getByLabel('Open toolbar menu').click();
    await page.getByTestId('toolbar-satel-mobile').click();
  }
}

test('reference suite survives loading a mutant and identifies the first mismatching observation', async ({ page }, testInfo) => {
  await page.goto('/');
  await openExamples(page);
  await page.getByTestId('example-oracle-account-reference').click();
  // Exercise the actual GUI file path, including its PNML method metadata.
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  if (await page.getByLabel('Open toolbar menu').isVisible()) await page.getByLabel('Open toolbar menu').click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const download = await downloaded, savedPath = testInfo.outputPath('account.pnml');
  await download.saveAs(savedPath);
  if (await page.getByLabel('Open toolbar menu').isVisible()) await page.getByLabel('Open toolbar menu').click();
  const choosing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await (await choosing).setFiles(savedPath);
  await expect(page.getByText(/Petri net loaded successfully with 4 places/)).toBeVisible();
  await openSatel(page);
  await page.getByRole('button', { name: 'Generate and validate on loaded reference' }).click();
  await expect(page.getByText('4/4 tests passed the reference oracle')).toBeVisible();
  await expect(page.getByText('Initial marking M₀', { exact: true })).toHaveCount(4);
  await expect(page.getByLabel('SATEL Testing')).not.toContainText('V2');
  const pairs = page.getByTestId('satel-pair-formula');
  await expect(pairs).toHaveCount(12);
  await expect(page.getByLabel('SATEL Testing')).not.toContainText('HML(');
  await expect(pairs.nth(7)).toContainText('withdraw(10) with ack(1) // paidAmount(10)');
  const equalityTest = page.locator('details').filter({ has: page.locator('summary', { hasText: /^10, Amount\(10\) · feasible$/ }) }).first();
  await equalityTest.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('instantiated-pairs.png') });
  await page.getByRole('button', { name: 'Intentions' }).click();
  await expect(page.getByRole('button', { name: '+ Create Intention' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Create V1/ })).toHaveCount(0);
  await page.getByLabel('Close SATEL').click();
  await openExamples(page);
  await page.getByTestId('example-oracle-account-reject-exact-balance').click();
  await openSatel(page);
  await page.getByRole('button', { name: 'Replay frozen suite on loaded APN' }).click();
  const result = page.getByTestId('oracle-target-results');
  await expect(result).toContainText('3 passed · 1 failed · 0 errors');
  await expect(result).toContainText('fail at step 2');
  await expect(result).toContainText('observation-mismatch');
  await expect(page.getByText('4/4 tests passed the reference oracle')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('oracle-mutant.png') });
  await page.getByLabel('Close SATEL').click();
  await openExamples(page);
  await page.getByTestId('example-oracle-account-wrong-initial-balance').click();
  await openSatel(page);
  await page.getByRole('button', { name: 'Replay frozen suite on loaded APN' }).click();
  await expect(page.getByTestId('oracle-target-results')).toContainText('0 passed · 4 failed · 0 errors');
});

test('public calls accept arguments and preserve the marking between calls', async ({ page }, testInfo) => {
  await page.goto('/');
  await openExamples(page);
  await page.getByTestId('example-oracle-account-reference').click();
  await page.getByRole('button', { name: 'Call public method', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Call public method' });
  await dialog.getByLabel('deposit argument n').fill('10');
  await dialog.getByRole('button', { name: 'Call deposit', exact: true }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'deposit(10)' })).toContainText('ack ↦ ⟦1⟧');
  await dialog.getByLabel('withdraw argument n').fill('10');
  await dialog.getByRole('button', { name: 'Call withdraw', exact: true }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'withdraw(10)' })).toContainText('paidAmount ↦ ⟦10⟧');
  await dialog.getByRole('button', { name: 'Call withdraw', exact: true }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'withdraw(10)' })).toContainText('ack ↦ ⟦0⟧');
  await dialog.getByRole('button', { name: 'Call query', exact: true }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'query()' })).toContainText('balanceResult ↦ ⟦0⟧');
  await page.screenshot({ path: testInfo.outputPath('public-calls.png') });
  await page.getByLabel('Close method calls').click();
  await openSatel(page);
  await page.getByRole('button', { name: 'I/O', exact: true }).click();
  await expect(page.getByLabel('SATEL Testing')).toContainText('Public methods (4)');
  await expect(page.getByLabel('SATEL Testing')).toContainText('withdraw(n: Nat)');
});

test('observations are edited as places and token multisets without JSON', async ({ page }, testInfo) => {
  await page.goto('/'); await openExamples(page);
  await page.getByTestId('example-oracle-account-reference').click(); await openSatel(page);
  await page.getByRole('button', { name: 'Intentions', exact: true }).click();
  await page.getByRole('button', { name: '+ Create Intention' }).click();
  await page.getByRole('button', { name: '+ Add Pair' }).click();
  await page.getByLabel('Pair 1 argument n').fill('10');
  const observation = page.getByRole('region', { name: 'Pair 1 observation' });
  await expect(observation).not.toContainText('JSON');
  await page.getByLabel('Pair 1 check outputs at ack').check();
  await page.getByLabel('Pair 1 expected outputs at ack').fill('1,');
  await expect(page.getByRole('button', { name: 'Save Intention' })).toBeDisabled();
  await page.getByLabel('Pair 1 expected outputs at ack').fill('1');
  await observation.getByText('Marking after this call (optional)', { exact: true }).click();
  await page.getByLabel('Pair 1 marking check at balance', { exact: true }).selectOption('equals');
  await page.getByLabel('Pair 1 expected marking at balance', { exact: true }).fill('10');
  await page.getByLabel('Pair 1 marking check at ack').selectOption('equals');
  await page.getByLabel('Pair 1 expected marking at ack').fill('1');
  await observation.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('place-observation-editor.png') });
  await page.getByRole('button', { name: 'Save Intention' }).click();
  await page.locator('div.p-3.border.rounded').filter({ has: page.getByText('New Test Intention', { exact: true }) }).getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Pair 1 expected marking at balance', { exact: true })).toHaveValue('10');
  await page.getByRole('button', { name: 'Save Intention' }).click();
  await page.getByRole('button', { name: 'Generate and validate suite' }).click();
  await expect(page.getByText('1 tests admitted by the reference oracle.')).toBeVisible();
  await expect(page.getByTestId('satel-pair-formula')).toContainText('deposit(10) with ack(1)');
});


test('saved symbolic intentions expose a recursive list frontier and editable equation budget', async ({ page }, testInfo) => {
  await page.goto('/'); await openExamples(page);
  await page.getByTestId('example-symbolic-list').click(); await openSatel(page);
  await page.getByRole('button', { name: 'Derive classes without executing the APN' }).click();
  await expect(page.getByTestId('symbolic-summary')).toContainText('4 feasible classes · 0 infeasible branches · 1 unresolved branches', { timeout: 30000 });
  await expect(page.getByRole('region', { name: 'Unresolved symbolic branches' })).toContainText('Unfolding budget exhausted');
  await expect(page.getByText('Class derivation only: no APN method protocol is declared. These witnesses are not oracle-validated tests.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate and validate on loaded reference' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('list-classes.png') });
  await page.getByRole('button', { name: 'Intentions', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('ADT constructors and operation equations')).toContainText('member(x, Cons(y, ys))');
  await page.getByLabel('Unfolding budget').fill('3');
  await page.getByRole('button', { name: 'Save Intention' }).click();
  await page.getByRole('button', { name: 'Derive / validate' }).click();
  await expect(page.getByText('This report belongs to the saved intention/model snapshot. Derive again to use the current selection or edits.')).toBeVisible();
  await page.getByRole('button', { name: 'Derive classes without executing the APN' }).click();
  await expect(page.getByTestId('symbolic-summary')).toContainText('6 feasible classes · 0 infeasible branches · 1 unresolved branches');
});

test('account symbolic goals are editable in Intentions and derive before oracle admission', async ({ page }) => {
  await page.goto('/'); await openExamples(page);
  await page.getByTestId('example-oracle-account-reference').click(); await openSatel(page);
  await page.getByRole('button', { name: 'Intentions', exact: true }).click();
  const card = page.locator('div.p-3.border.rounded').filter({ has: page.getByText('Account — less / equal / greater', { exact: true }) });
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Symbolic goal arguments').fill('25, request');
  await page.getByRole('button', { name: 'Save Intention' }).click();
  await card.getByRole('button', { name: 'Derive / validate' }).click();
  await page.getByRole('button', { name: 'Derive classes without executing the APN' }).click();
  await expect(page.getByTestId('symbolic-summary')).toContainText('4 feasible classes', { timeout: 30000 });
  await expect(page.getByText('Candidate pairs — not yet oracle-validated')).toHaveCount(4);
  await expect(page.getByTestId('satel-pair-formula').first()).toContainText('deposit(25)');
  await expect(page.getByText('4/4 tests passed the reference oracle')).toHaveCount(0);
  await page.getByRole('button', { name: 'Validate derived pairs on loaded reference' }).click();
  await expect(page.getByText('4/4 tests passed the reference oracle')).toBeVisible();
});

test('compound guard shared-variable classes become readable pairs and detect the missing disjunct mutant', async ({ page }, testInfo) => {
  await page.goto('/'); await openExamples(page);
  await page.getByTestId('example-compound-guard').click(); await openSatel(page);
  await page.getByRole('button', { name: 'Derive classes without executing the APN' }).click();
  await expect(page.getByTestId('symbolic-summary')).toContainText('4 feasible classes', { timeout: 30000 });
  await expect(page.getByTestId('symbolic-summary')).toContainText('0 unresolved branches');
  await expect(page.getByText('Candidate pairs — not yet oracle-validated')).toHaveCount(4);
  await expect(page.getByTestId('satel-pair-formula').filter({ hasText: 'check(10)' })).toContainText('accepted(1)');
  await page.getByRole('button', { name: 'Validate derived pairs on loaded reference' }).click();
  await expect(page.getByText('4/4 tests passed the reference oracle')).toBeVisible();
  const ten = page.getByRole('region', { name: 'Instantiated stimulation/observation pairs', exact: true }).filter({ has: page.getByTestId('satel-pair-formula').filter({ hasText: 'check(10)' }) });
  await expect(ten.getByLabel('Instantiated variables')).toContainText('x ↦ 10');
  await page.getByTestId('satel-pair-formula').filter({ hasText: 'check(10)' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('compound-guard-pairs.png') });
  await page.getByRole('button', { name: 'Intentions', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Symbolic goal kind')).toHaveValue('guard');
  await expect(page.getByLabel('Symbolic guard')).toHaveValue('x > 0 and (x < 5 or x == 10)');
  await page.getByLabel('Import transition guard').selectOption('refuse');
  await expect(page.getByLabel('Symbolic guard')).toHaveValue('not (x > 0 and (x < 5 or x == 10))');
  await expect(page.getByLabel('Symbolic pair protocol')).toHaveValue('');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByLabel('Close SATEL').click(); await openExamples(page);
  await page.getByTestId('example-compound-guard-mutant').click(); await openSatel(page);
  await page.getByRole('button', { name: 'Oracle validation', exact: true }).click();
  await page.getByRole('button', { name: 'Replay frozen suite on loaded APN' }).click();
  await expect(page.getByTestId('oracle-target-results')).toContainText('3 passed · 1 failed · 0 errors');
});

test('built-in list partiality and String guards are visible in the real browser solver', async ({ page }, testInfo) => {
  await page.goto('/'); await openExamples(page);
  await page.getByTestId('example-builtin-types').click(); await openSatel(page);
  await page.getByRole('button', { name: 'Derive classes without executing the APN' }).click();
  await expect(page.getByTestId('symbolic-summary')).toContainText('1 feasible classes', { timeout: 30000 });
  await expect(page.getByRole('region', { name: 'Unresolved symbolic branches' })).toContainText('head requires a non-empty list');
  await page.getByLabel('Symbolic intention', { exact: true }).selectOption('builtin-string');
  await page.getByRole('button', { name: 'Derive classes without executing the APN' }).click();
  await expect(page.getByTestId('symbolic-summary')).toContainText('3 feasible classes', { timeout: 30000 });
  await expect(page.getByTestId('symbolic-summary')).toContainText('0 unresolved branches');
  await expect(page.getByTestId('symbolic-summary')).toContainText('pairwise disjoint');
  await expect(page.getByText('Class derivation only: no APN method protocol is declared. These witnesses are not oracle-validated tests.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('builtin-string-classes.png') });
});

test('typed method classes produce two-pair tests and detect lost stored data', async ({ page }, testInfo) => {
  await page.goto('/'); await openExamples(page);
  await page.getByTestId('example-typed-store').click(); await openSatel(page);
  await page.getByRole('button', { name: 'Derive classes without executing the APN' }).click();
  await expect(page.getByTestId('symbolic-summary')).toContainText('5 feasible classes', { timeout: 30000 });
  await expect(page.getByTestId('symbolic-summary')).toContainText('0 unresolved branches');
  await expect(page.getByText('Candidate pairs — not yet oracle-validated')).toHaveCount(5);
  await page.getByRole('button', { name: 'Validate derived pairs on loaded reference' }).click();
  await expect(page.getByText('5/5 tests passed the reference oracle')).toBeVisible();
  const formulas = page.getByTestId('satel-pair-formula');
  await expect(formulas).toHaveCount(10);
  await expect(formulas.filter({ hasText: 'read()' })).toHaveCount(5);
  const accepted = formulas.filter({ hasText: 'ack(true)' });
  await expect(accepted).toHaveCount(1); await expect(accepted).toContainText('metaOut((');
  await accepted.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('typed-store-pairs.png') });
  await page.getByLabel('Close SATEL').click(); await openExamples(page);
  await page.getByTestId('example-typed-store-mutant').click(); await openSatel(page);
  await page.getByRole('button', { name: 'Replay frozen suite on loaded APN' }).click();
  await expect(page.getByTestId('oracle-target-results')).toContainText('4 passed · 1 failed · 0 errors');
});

test('typed call inputs preserve nested values and state between calls; intentions use readable values', async ({ page }, testInfo) => {
  await page.goto('/'); await openExamples(page);
  await page.getByTestId('example-typed-store').click();
  await page.getByRole('button', { name: 'Call public method', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Call public method' });
  await dialog.getByLabel('store argument items').fill('[1, true, ["nested"], ("key", false)]');
  await dialog.getByLabel('store argument label').fill('"$cash"');
  await dialog.getByLabel('store argument enabled').fill('true');
  await dialog.getByLabel('store argument meta').fill('("$cash", false)');
  await dialog.getByRole('button', { name: 'Call store', exact: true }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'store(' })).toContainText('ack ↦ ⟦true⟧');
  await expect(dialog.getByRole('status').filter({ hasText: 'store(' })).toContainText('labelOut ↦ ⟦"$cash"⟧');
  await dialog.getByRole('button', { name: 'Call read', exact: true }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'read()' })).toContainText('saved ↦ ⟦[1, true, ["nested"], ("key", false)]⟧');
  await dialog.getByLabel('store argument enabled').fill('false');
  await dialog.getByRole('button', { name: 'Call store', exact: true }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'store(' })).toContainText('ack ↦ ⟦false⟧');
  await dialog.getByRole('button', { name: 'Call read', exact: true }).click();
  await expect(dialog.getByRole('status').filter({ hasText: 'read()' })).toContainText('saved ↦ ⟦[1, true, ["nested"], ("key", false)]⟧');
  await dialog.getByRole('status').filter({ hasText: 'read()' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('typed-method-calls.png') });
  await page.getByLabel('Close method calls').click(); await openSatel(page);
  await page.getByRole('button', { name: 'Intentions', exact: true }).click();
  await page.getByRole('button', { name: '+ Create Intention' }).click();
  await page.getByRole('button', { name: '+ Add Pair' }).click();
  await page.getByLabel('Pair 1 argument items').fill('[1,');
  await expect(page.getByRole('button', { name: 'Save Intention' })).toBeDisabled();
  await page.getByLabel('Pair 1 argument items').fill('[1, true]');
  await page.getByLabel('Pair 1 argument label').fill('"a"');
  await page.getByLabel('Pair 1 argument enabled').fill('true');
  await page.getByLabel('Pair 1 argument meta').fill('("a", false)');
  await page.getByLabel('Pair 1 check outputs at ack').check();
  await page.getByLabel('Pair 1 expected outputs at ack').fill('true');
  await page.getByLabel('Pair 1 check outputs at echoed').check();
  await page.getByLabel('Pair 1 expected outputs at echoed').fill('[1, true]');
  await page.getByRole('button', { name: 'Save Intention' }).click();
  await page.getByRole('button', { name: 'Generate and validate suite' }).click();
  await expect(page.getByText('1 tests admitted by the reference oracle.')).toBeVisible();
  await expect(page.getByTestId('satel-pair-formula')).toContainText('store([1, true], "a", true, ("a", false))');
});
