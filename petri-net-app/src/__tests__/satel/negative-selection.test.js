/** @jest-environment node */
import { generateIntention } from '../../satel/core/IntentionPipeline.js';
import { selectNegativeCompanions } from '../../satel/core/NegativeSelection.js';
import { exerciseScenarios, createExerciseExample } from '../../satel/examples/exercises/editor.js';
import { createExecutableSequenceExample } from '../../satel/examples/executable-sequence/editor.js';
import { evaluateOracleSuite } from '../../satel/core/ValidatedSubuniformity.js';
import { createRefusalExample } from '../../satel/examples/refusal/editor.js';
import { builder } from '../../satel/examples/exercises/builder.js';

jest.setTimeout(120000);
test.each(exerciseScenarios)('$id: existing positive baseline and bounded companions pass reference; all existing mutants still detected', async scenario => {
  const net = createExerciseExample(`exercise-${scenario.id}-reference`);
  const { report, suite } = await generateIntention(net.testIntentions[0], net, { includeNegative: true, negativeLimits: { maxAttempts: 6, maxTests: 3, maxTimeMs: 5000 } });
  const positives = suite.selectedTests.filter(t => !t.negativeSelection), negatives = suite.selectedTests.filter(t => t.negativeSelection);
  expect(positives).toHaveLength(scenario.classes);
  expect(positives.every(t => t.pairs.length === scenario.depth)).toBe(true);
  expect(negatives.length).toBeLessThanOrEqual(3);
  expect(report.negativeSelection.attempts.length).toBeLessThanOrEqual(6);
  for (const test of negatives) {
    const seed = positives.find(p => p.id === test.negativeSelection.seedId), index = test.negativeSelection.pair - 1;
    expect(test.pairs.slice(0, -1)).toEqual(seed.pairs.slice(0, index));
    expect(test.pairs.at(-1).assertion).toBe('blocked');
    expect(test.referenceMarkings.at(-1)).toEqual(test.referenceMarkings.at(-2));
  }
  expect((await evaluateOracleSuite(suite.selectedTests, net, suite.interface)).counts).toEqual({ pass: suite.selectedTests.length, fail: 0, error: 0 });
  for (const mutant of scenario.mutants) {
    const run = await evaluateOracleSuite(positives, createExerciseExample(`exercise-${scenario.id}-${mutant.id}`), suite.interface);
    expect(run.counts.fail).toBeGreaterThan(0); expect(run.counts.error).toBe(0);
  }
});
test('account rejection is not mined as method refusal', async () => {
  const net = createExecutableSequenceExample();
  const { report, suite } = await generateIntention(net.testIntentions[0], net, { includeNegative: true });
  expect(report.negativeSelection.candidates).toHaveLength(0);
  expect(report.negativeSelection.unresolved).toEqual([]);
  expect(report.negativeSelection.attempts.every(a => a.status === 'no-refusal')).toBe(true);
  expect(suite.selectedTests).toHaveLength(2);
});
test('automatic refusal companions detect a permissive thermostat guard missed by positive tests', async () => {
  const net = createExerciseExample('exercise-thermostat-reference');
  const { suite } = await generateIntention(net.testIntentions[0], net, { includeNegative: true });
  const mutant = createRefusalExample('refusal-thermostat-mutant');
  // Broaden both signs so either legitimate solver witness detects the same fault.
  mutant.transitions.find(t => t.id === 'cold').guard = 'delta < 0';
  const positives = suite.selectedTests.filter(t => !t.negativeSelection), negatives = suite.selectedTests.filter(t => t.negativeSelection);
  expect((await evaluateOracleSuite(positives, mutant, suite.interface)).counts.fail).toBe(0);
  expect(negatives.length).toBeGreaterThan(0);
  const run = await evaluateOracleSuite(negatives, mutant, suite.interface);
  expect(run.counts.fail).toBeGreaterThan(0); expect(run.counts.error).toBe(0);
});
test('negative exhaustion is visible and contributes no fabricated test; admission of seed tests is retained', async () => {
  const net = createExerciseExample('exercise-thermostat-reference');
  const { report, suite } = await generateIntention(net.testIntentions[0], net, { includeNegative: true, negativeLimits: { maxBindings: 1 } });
  expect(report.negativeSelection.unresolved).toHaveLength(1);
  expect(report.negativeSelection.candidates).toEqual([]);
  expect(report.negativeSelection.truncated).toBe(true);
  expect(suite.selectedTests).toHaveLength(3);
  expect(suite.oracleValidated).toBe(true);
});
test('negative selection obeys cancellation', async () => {
  const net = createExerciseExample('exercise-thermostat-reference');
  const { suite } = await generateIntention(net.testIntentions[0], net);
  const controller = new AbortController(); controller.abort();
  await expect(selectNegativeCompanions(suite, { signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' });
});

test('solver unknown stays unresolved, never a no-refusal proof or a negative test', async () => {
  const net = createExerciseExample('exercise-thermostat-reference');
  const { suite } = await generateIntention(net.testIntentions[0], net);
  const report = await selectNegativeCompanions(suite, { solve: async () => ({ status: 'unknown', reason: 'forced timeout' }), negativeLimits: { maxAttempts: 1 } });
  expect(report.unresolved).toHaveLength(1); expect(report.candidates).toEqual([]);
  expect(report.attempts[0].status).toBe('unresolved');
});

test('ordinary negative search jointly refuses every token binding and alternative rule within a small branch allowance', async () => {
  const b = builder();
  b.place('limits', 'Int', [1, 2]); b.place('out', 'Int', [], true);
  b.rule('bounded', 'request', { n: 'Int' }, 'n >= 0 and n <= limit', [['limits', 'limit']], [['limits', 'limit'], ['out', 'n']]);
  b.rule('special', 'request', { n: 'Int' }, 'n == 50', [], [['out', 'n']]);
  // The seed has one enabled binding. Refusal search must nevertheless negate
  // both available token bindings and the special rule at its initial marking.
  const intention = { id: 'request', name: 'Request within capacity', testType: 'positive', variables: [], pairs: [{ stimulation: { method: 'request', arguments: { n: 2 } }, observation: { outputs: { out: [2] } } }] };
  const { report, suite } = await generateIntention(intention, b.net, { includeNegative: true, maxBranches: 4 });
  expect(report.negativeSelection.unresolved).toEqual([]);
  const negatives = suite.selectedTests.filter(t => t.negativeSelection);
  expect(negatives).toHaveLength(1);
  const n = negatives[0].pairs[0].stimulation.arguments.n;
  expect(n < 0 || n > 2).toBe(true); expect(n).not.toBe(50);
  expect(negatives[0].referenceMarkings[1]).toEqual(negatives[0].referenceMarkings[0]);
  expect((await evaluateOracleSuite(suite.selectedTests, b.net, suite.interface)).counts).toEqual({ pass: 2, fail: 0, error: 0 });
  const mutant = structuredClone(b.net);
  mutant.transitions.find(t => t.id === 'bounded').guard = 'true';
  expect((await evaluateOracleSuite(negatives, mutant, suite.interface)).counts).toEqual({ pass: 0, fail: 1, error: 0 });
});
