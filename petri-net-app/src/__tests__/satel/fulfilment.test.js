/** @jest-environment node */
import { createFulfilmentExample, fulfilmentMutations } from '../../satel/examples/fulfilment/editor';
import { deriveSymbolicIntention, admitSymbolicIntention } from '../../satel/core/SymbolicIntention';
import { evaluateOracleSuite } from '../../satel/core/ValidatedSubuniformity';
import { getPublicMethods } from '../../features/simulation/PublicMethods';

jest.setTimeout(30000);
let reference, report, suite;
beforeAll(async () => {
  reference = createFulfilmentExample();
  report = await deriveSymbolicIntention(reference.testIntentions[0], reference);
  suite = await admitSymbolicIntention(report, reference);
});

test('four algebraic classes generate ten-pair tests on the larger APN', () => {
  expect([reference.places.length, reference.transitions.length, reference.arcs.length]).toEqual([34, 17, 127]);
  expect(getPublicMethods(reference)).toHaveLength(10);
  expect(report.execution.blocked).toEqual([]); expect(report.execution.unresolved).toEqual([]);
  expect(suite.validation).toEqual({ generated: 4, referencePassed: 4 });
  expect(suite.selectedTests.map(t => t.id)).toEqual(['standard.small', 'standard.bulk', 'express.small', 'express.bulk']);
  const fees = [2, 0, 5, 3];
  for (const [i, test] of suite.selectedTests.entries()) {
    expect(test.steps.map(s => s.method)).toEqual(['open', 'add', 'reserve', 'pay', 'pack', 'ship', 'deliver', 'returnItems', 'close', 'audit']);
    expect(test.expected).toHaveLength(10);
    expect(test.referenceMarkings).toHaveLength(11);
    const q = test.steps[1].arguments.quantity, r = test.steps[7].arguments.quantity;
    expect(q - r).toBe(2); expect(r).toBeGreaterThan(0);
    expect(q < 4).toBe(i % 2 === 0);
    expect(test.steps[0].arguments.rush).toBe(i >= 2);
    expect(test.expected[5].shippingFee).toEqual([fees[i]]);
    expect(test.expected[9]).toMatchObject({ stockLevel: [10], walletBalance: [80 - fees[i]], netRevenue: [20 + fees[i]], loyalty: [2], shipmentCount: [1], returnCount: [1] });
  }
});

test('every intermediate marking conserves money, stock and the two physical crates', () => {
  const sum = xs => xs.reduce((a, b) => a + b, 0);
  for (const test of suite.selectedTests) {
    for (const marking of test.referenceMarkings) {
      expect(sum(marking.wallet) + sum(marking.escrow) + sum(marking.revenue)).toBe(100);
      expect(sum(marking.stock) + sum(marking.points) + ['reserved', 'paid', 'packed', 'transit', 'delivered', 'returned'].reduce((total, p) => total + sum(marking[p]), 0)).toBe(12);
      expect(marking.crates.length + marking.crateLoan.length).toBe(2);
    }
    expect(test.referenceMarkings[5].crates).toEqual([]);
    expect(test.referenceMarkings[5].crateLoan).toEqual([1, 1]);
    expect(test.referenceMarkings[7].crates).toEqual([1, 1]);
    expect(test.referenceMarkings[10].idle).toEqual([1]);
  }
});

test.each(fulfilmentMutations)('$id is detected by the frozen reference suite without execution errors', async mutant => {
  const net = createFulfilmentExample(`fulfilment-${mutant.id}`), before = JSON.stringify(suite);
  expect(getPublicMethods(net)).toEqual(getPublicMethods(reference));
  expect(net.testIntentions).toEqual(reference.testIntentions);
  const run = await evaluateOracleSuite(suite.selectedTests, net, suite.interface);
  const feeFault = mutant.id === 'express-bulk-fee';
  expect(run.counts).toEqual({ pass: feeFault ? 3 : 0, fail: feeFault ? 1 : 4, error: 0 });
  for (const result of run.results.filter(r => r.verdict === 'fail')) {
    expect(result.step).toBe(feeFault ? 6 : mutant.initialCrates ? 5 : 10);
    expect(result.reason).toBe(mutant.initialCrates ? 'request-blocked' : 'observation-mismatch');
  }
  expect(JSON.stringify(suite)).toBe(before);
  expect(createFulfilmentExample()).toEqual(reference);
});

test('a fresh reference replay still passes after replaying all mutants', async () => {
  expect((await evaluateOracleSuite(suite.selectedTests, reference, suite.interface)).counts).toEqual({ pass: 4, fail: 0, error: 0 });
});
