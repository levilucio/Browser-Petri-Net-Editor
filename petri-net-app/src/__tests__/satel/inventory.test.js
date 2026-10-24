/** @jest-environment node */
import { inventory, inventoryMutants } from '../../satel/examples/inventory/models.js';
import { inventoryConfigurations } from '../../satel/examples/inventory/editor.js';
import { generateIntention } from '../../satel/core/IntentionPipeline.js';
import { evaluateOracleSuite } from '../../satel/core/ValidatedSubuniformity.js';
import { compareHmlAssignments } from '../../../tools/node/benchmarks/hml-cache-comparison.js';
import { workerService } from '../../satel/examples/scale/models.js';
import { pairValue } from '../../satel/examples/exercises/builder.js';

jest.setTimeout(120000);
test.each(inventoryConfigurations)('$label: reference-admitted tests detect each matching mutant', async ({ config }) => {
  const net = inventory(config), { suite } = await generateIntention(net.testIntentions[0], net);
  expect(suite.validation).toEqual({ generated: 2, referencePassed: 2 });
  const quantities = suite.selectedTests.map(t => t.formula.children[0].stimulation.arguments.q);
  expect(quantities.some(q => q >= 1 && q <= 2)).toBe(true);
  expect(quantities.some(q => q >= 3 && q <= 5)).toBe(true);
  for (const t of suite.selectedTests) {
    let node = t.formula.children[0], pairs = 0;
    while (node.op === 'diamond') { pairs++; node = node.child; }
    expect(pairs).toBe((config.cycles || 1) * 5);
  }
  expect((await evaluateOracleSuite(suite.selectedTests, net, suite.interface)).counts).toEqual({ pass: 2, fail: 0, error: 0 });
  for (const mutant of inventoryMutants) {
    const replay = await evaluateOracleSuite(suite.selectedTests, inventory({ ...config, mutant }), suite.interface);
    expect({ mutant, counts: replay.counts }).toEqual({ mutant, counts: { pass: 0, fail: 2, error: 0 } });
  }
});

test('all cache modes agree with concrete truth across the stock boundary and both HML polarities', async () => {
  const net = inventory({ permitKinds: 2, audit: true });
  const result = await compareHmlAssignments({ net, formula: net.testIntentions[0].branchingProperty,
    sorts: { q: 'Int' }, assignments: [-1, 0, 1, 2, 3, 5, 6, 7].map(q => ({ q })) });
  expect(result.concreteTruth).toEqual([false, false, true, true, true, true, true, false]);
  expect(result.rows).toHaveLength(7);
});

test('existing worker baseline agrees with concrete evaluation when individual caches are disabled', async () => {
  const net = workerService({ workers: 2, rounds: 2, audit: true });
  const result = await compareHmlAssignments({ net, formula: net.testIntentions[0].branchingProperty,
    sorts: { p: 'Pair' }, assignments: [1, 3, 5].flatMap(n => [false, true].map(b => ({ p: pairValue(n, b) }))),
    options: { maxHmlSelectionWork: 100000 } });
  expect(result.concreteTruth).toEqual([false, false, false, true, false, true]);
});

test('model bounds reject accidental enormous or malformed configurations', () => {
  for (const config of [{ cycles: 0 }, { sites: -1 }, { rounds: 100 }, { copies: 1.5 }, { mutant: 'typo' }]) {
    expect(() => inventory(config)).toThrow();
  }
});
