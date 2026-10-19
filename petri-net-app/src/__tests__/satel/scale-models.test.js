/** @jest-environment node */
import { fulfilment, workerService, allocationService } from '../../satel/examples/scale/models.js';
import { generateIntention } from '../../satel/core/IntentionPipeline.js';
import { evaluateOracleSuite } from '../../satel/core/ValidatedSubuniformity.js';
import { compilePublicNet } from '../../domain/apn/PublicMethods.js';
import { allocation, invoice } from '../../../tools/node/benchmarks/solver-cases.js';
import { createSymbolicSolver } from '../../satel/core/SymbolicZ3.js';
import { findConstraintWitness } from '../../satel/core/GenericSubuniformity.js';

jest.setTimeout(60000);
test('regional orders conserve stock and wallet; visible faults fail while unobserved stock leakage survives', async () => {
  const config = { sites: 2, policies: 4, cycles: 2 }, net = fulfilment(config);
  const { suite } = await generateIntention(net.testIntentions[0], net);
  const test = suite.selectedTests[0], q = test.steps[0].arguments.q;
  expect(q).toBeGreaterThanOrEqual(3); expect(q).toBeLessThanOrEqual(5);
  expect(test.steps).toHaveLength(10);
  const final = test.referenceMarkings.at(-1);
  for (let i = 0; i < 2; i++) { expect(final[`stock_${i}`]).toEqual([100 - q]); expect(final[`wallet_${i}`]).toEqual([10000 - 10 * q]); expect(final[`phase_${i}`]).toEqual([0]); expect(final[`order_${i}`]).toEqual([0]); }
  for (const mutation of ['wrong-receipt', 'missing-dispatch', 'stock-leak']) {
    const result = await evaluateOracleSuite(suite.selectedTests, fulfilment({ ...config, mutant: mutation }), suite.interface);
    expect(result.counts).toEqual(mutation === 'stock-leak' ? { pass: 1, fail: 0, error: 0 } : { pass: 0, fail: 1, error: 0 });
  }
});
test.each([[2, 2, false], [2, 2, true], [4, 2, false], [2, 4, false], [2, 4, true], [8, 4, false], [8, 8, false]])('%i workers / %i rounds with audit=%s is universally checked and detects both faults', async (workers, rounds, audit) => {
  const config = { workers, rounds, audit }, net = workerService(config);
  // A branch allowance, rather than a wall-clock threshold, catches accidental
  // re-expansion of solver-ready HML formulas during equation narrowing.
  const { suite } = await generateIntention(net.testIntentions[0], net, { maxBranches: 32 });
  expect(suite.validation).toEqual({ generated: 1, referencePassed: 1 });
  for (const mutation of ['missing-worker', 'wrong-receipt']) expect((await evaluateOracleSuite(suite.selectedTests, workerService({ ...config, mutant: mutation }), suite.interface)).counts).toEqual({ pass: 0, fail: 1, error: 0 });
});
test('the largest fulfilment workload is a well-typed APN with unique IDs and shared public signatures', () => {
  const net = fulfilment({ sites: 128, policies: 8, cycles: 4 });
  expect(net.places).toHaveLength(1923); expect(net.transitions).toHaveLength(640);
  expect(compilePublicNet(net).methods).toHaveLength(5);
});
test('allocation controls distinguish satisfiable from pigeonhole-unsatisfiable instances', async () => {
  for (const unsat of [false, true]) {
    const query = allocation({ size: 4, kind: 'slots', unsat });
    const solve = await createSymbolicSolver(query.algebra);
    expect((await solve(query)).status).toBe(unsat ? 'unsat' : 'sat');
  }
});
test('custom invoice uses defining equations; a deliberately small unfolding budget stays unknown', async () => {
  const request = invoice({ size: 4 });
  expect((await findConstraintWitness(request)).status).toBe('sat');
  const limited = await findConstraintWitness({ ...request, maxDepth: 2 });
  expect(limited.status).toBe('unknown');
  expect(limited.unresolved.some(x => /Unfolding budget/.test(x.reason))).toBe(true);
});

test.each([4, 16, 32, 64])('allocation of %i resources jointly solves parameters and confirms exactly the debited quantities', async size => {
  const net = allocationService({ size });
  const { suite } = await generateIntention(net.testIntentions[0], net, { maxBranches: 8 });
  expect(suite.validation).toEqual({ generated: 1, referencePassed: 1 });
  const selected = suite.selectedTests[0], args = selected.steps[0].arguments;
  const quantities = Array.from({ length: size }, (_, i) => args[`q${i}`]);
  expect(quantities.reduce((a, b) => a + b, 0)).toBe(10 * size);
  const final = selected.referenceMarkings.at(-1);
  quantities.forEach((q, i) => {
    expect(q).toBeGreaterThanOrEqual(1); expect(q).toBeLessThanOrEqual(100);
    expect(final[`available_${i}`]).toEqual([100 - q]);
    if (i) { expect(q + quantities[i - 1]).toBeGreaterThanOrEqual(12); expect(2 * q + quantities[i - 1]).toBeLessThanOrEqual(40); }
  });
  expect(final.phase).toEqual([0]); expect(final.plan).toEqual([[]]);
  for (const mutant of ['missing-confirmation', 'wrong-allocation']) expect((await evaluateOracleSuite(suite.selectedTests, allocationService({ size, mutant }), suite.interface)).counts).toEqual({ pass: 0, fail: 1, error: 0 });
});
