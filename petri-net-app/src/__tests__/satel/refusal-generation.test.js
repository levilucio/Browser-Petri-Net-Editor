/** @jest-environment node */
import { generateIntention, deriveIntention } from '../../satel/core/IntentionPipeline.js';
import { replayTest } from '../../satel/core/Replay.js';
import { createExecutableSequenceExample } from '../../satel/examples/executable-sequence/editor.js';
import { createExerciseExample } from '../../satel/examples/exercises/editor.js';
import { publicInterface } from '../../satel/core/TestCase.js';

jest.setTimeout(60000);
const copy = x => JSON.parse(JSON.stringify(x));
function account() {
  const net = createExecutableSequenceExample();
  // A partial-method variant of the account baseline, without its ack(0) response rule.
  net.transitions = net.transitions.filter(t => t.id !== 'withdrawRefused');
  net.arcs = net.arcs.filter(a => a.source !== 'withdrawRefused' && a.target !== 'withdrawRefused');
  net.testIntentions = [{ id: 'refusal', name: 'Withdraw then refuse', kind: 'symbolic', symbolic: {
    source: 'operation identity(Nat): Nat\nrule identity.def(n: Nat): identity(n) = n',
    operation: 'identity', variablesText: 'n: Nat', argsText: 'n', conditionsText: 'n > 0 and n <= 10', maxDepth: 1,
    protocolSource: 'case run(n: Nat):\ninputs n\nresult n\npair withdraw(n=3) => ack(1), paidAmount(3)\npair withdraw(n=n) => refused'
  } }];
  return net;
}
test('symbolic refusal uses the reached balance; all pairs pass and marking stays unchanged', async () => {
  const net = account(), before = JSON.stringify(net);
  const { suite } = await generateIntention(net.testIntentions[0], net);
  const test = suite.selectedTests[0];
  expect(test.pairs[1].assertion).toBe('blocked');
  expect(test.pairs[1].stimulation.arguments.n).toBeGreaterThan(7);
  expect(test.referenceMarkings.map(m => m.balance)).toEqual([[10], [7], [7]]);
  const mutant = copy(net);
  mutant.arcs.find(a => a.source === 'withdrawAccepted' && a.target === 'balance').binding = 'b';
  expect((await replayTest(test, mutant, suite.interface)).verdict).toBe('fail');
  expect(JSON.stringify(net)).toBe(before);
});
test('refusal negates all alternative rules; an enabled alternative defeats it', async () => {
  const net = account();
  const rule = net.transitions.find(t => t.method.name === 'withdraw');
  const alt = { ...copy(rule), id: 'alternate', guard: 'true' };
  net.transitions.push(alt);
  net.arcs.push(...net.arcs.filter(a => a.source === rule.id || a.target === rule.id).map(a => ({ ...a, id: a.id + '-alt', source: a.source === rule.id ? alt.id : a.source, target: a.target === rule.id ? alt.id : a.target })));
  net.testIntentions[0].symbolic.protocolSource = 'case run(n: Nat):\ninputs n\nresult n\npair withdraw(n=n) => refused';
  const report = await deriveIntention(net.testIntentions[0], net);
  expect(report.candidates).toEqual([]);
  expect(report.execution.blocked).toHaveLength(1);
  const test = { id: 'fixed', pairs: [{ assertion: 'blocked', stimulation: { method: 'withdraw', arguments: { n: 1 } }, observation: { outputs: {} } }] };
  expect((await replayTest(test, net, publicInterface(net))).verdict).toBe('fail');
});
test('exhausted refusal binding search remains unresolved', async () => {
  const net = account();
  const report = await deriveIntention(net.testIntentions[0], net, { maxSequenceBranches: 1 });
  expect(report.execution.unresolved).toHaveLength(1);
  expect(report.execution.blocked).toEqual([]);
  expect(report.candidates).toEqual([]);
});
test('explicit finite refusal assertions survive instantiation on the quota baseline', async () => {
  const net = createExerciseExample('exercise-quota-reference');
  const intention = { id: 'capacity', name: 'No release before reserve', testType: 'positive', variables: [], pairs: [{ assertion: 'blocked', stimulation: { method: 'release', arguments: { n: 1 } }, observation: { outputs: {} } }] };
  const { suite } = await generateIntention(intention, net);
  expect(suite.selectedTests[0].pairs[0].assertion).toBe('blocked');
  expect(suite.validation.referencePassed).toBe(1);
});
test('malformed output computations are execution errors, not successful refusals', async () => {
  const net = account(), io = publicInterface(net);
  net.arcs.find(a => a.target === 'balance' && a.binding.includes('-')).binding = '-1';
  const result = await replayTest({ id: 'bad', pairs: [{ assertion: 'blocked', stimulation: { method: 'withdraw', arguments: { n: 1 } }, observation: { outputs: {} } }] }, net, io);
  expect(result.verdict).toBe('error');
});

test.each(['quota', 'thermostat'])('%s refusal exercise detects permissive guard mutants, while original positive intentions pass', async name => {
  const { createRefusalExample } = await import('../../satel/examples/refusal/editor.js');
  const net = createRefusalExample(`refusal-${name}-reference`), mutant = createRefusalExample(`refusal-${name}-mutant`);
  const { suite } = await generateIntention(net.testIntentions[0], net);
  const { evaluateOracleSuite } = await import('../../satel/core/ValidatedSubuniformity.js');
  const run = await evaluateOracleSuite(suite.selectedTests, mutant, suite.interface);
  expect(run.counts.fail).toBeGreaterThan(0); expect(run.counts.error).toBe(0);
  const positive = await generateIntention(net.testIntentions[1], net);
  expect((await evaluateOracleSuite(positive.suite.selectedTests, mutant, positive.suite.interface)).counts.fail).toBe(0);
});
test('Account rejection response is accepted behavior, not a blocked call', async () => {
  const net = createExecutableSequenceExample();
  const test = { id: 'account-refusal', pairs: [{ assertion: 'blocked', stimulation: { method: 'withdraw', arguments: { n: 11 } }, observation: { outputs: {} } }] };
  expect((await replayTest(test, net, publicInterface(net))).verdict).toBe('fail');
  test.pairs[0] = { stimulation: { method: 'withdraw', arguments: { n: 11 } }, observation: { outputs: { ack: [0] } } };
  expect((await replayTest(test, net, publicInterface(net))).verdict).toBe('pass');
});

test('refusal respects shared variables and distinct token occurrences across every binding', async () => {
  const { builder } = await import('../../satel/examples/exercises/builder.js');
  const b = builder(); b.place('stock', 'Nat', [1, 1, 2]); b.place('out', 'Nat', [], true);
  b.rule('take', 'take', { n: 'Nat' }, '', [['stock', 'n'], ['stock', 'n']], [['out', 'n']]);
  const intention = { id: 'multiplicity', name: 'Insufficient equal tokens', kind: 'symbolic', symbolic: {
    source: 'operation identity(Nat): Nat\nrule id(n: Nat): identity(n) = n', operation: 'identity', argsText: 'n', variablesText: 'n: Nat', conditionsText: 'n >= 1 and n <= 2', maxDepth: 1,
    protocolSource: 'case take(n: Nat):\ninputs n\nresult n\npair take(n=n) => refused'
  } };
  const { suite } = await generateIntention(intention, b.net);
  expect(suite.selectedTests[0].pairs[0].stimulation.arguments.n).toBe(2);
  const mutant = copy(b.net); mutant.places[0].valueTokens.push(2); mutant.places[0].tokens++;
  expect((await replayTest(suite.selectedTests[0], mutant, suite.interface)).verdict).toBe('fail');
});
test('refusal checks any supplied marking assertion instead of silently ignoring it', async () => {
  const net = createExerciseExample('exercise-quota-reference');
  const result = await replayTest({ id: 'wrong-marking', pairs: [{ assertion: 'blocked', stimulation: { method: 'release', arguments: { n: 1 } }, observation: { outputs: {}, markings: { held: { equals: [2] } } } }] }, net, publicInterface(net));
  expect(result.verdict).toBe('fail'); expect(result.reason).toBe('marking_constraint_failed');
});
