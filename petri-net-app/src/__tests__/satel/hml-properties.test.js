import { enumerateMethodSuccessors, prepareMethodCall, compilePublicNet } from '../../domain/apn/PublicMethods.js';
import { evaluateFormula } from '../../satel/core/HmlEvaluator.js';
import { replayTest } from '../../satel/core/Replay.js';
import { generateIntention } from '../../satel/core/IntentionPipeline.js';
import { evaluateOracleSuite } from '../../satel/core/ValidatedSubuniformity.js';
import { publicInterface } from '../../satel/core/TestCase.js';
import { createNondeterminismExample, modal, all } from '../../satel/examples/nondeterminism/editor.js';
import { createExerciseExample } from '../../satel/examples/exercises/editor.js';
import { refusalConstraints } from '../../satel/core/RefusalConstraints.js';
import { addBuiltins } from '../../satel/core/BuiltinAlgebra.js';
const net = name => createNondeterminismExample(`nondeterminism-${name}`);
const copy = x => JSON.parse(JSON.stringify(x));
const check = (formula, model, options) => evaluateFormula(formula, model, publicInterface(model), options);

test('equal tokens collapse redundant choices but keep multiplicity and leave input marking untouched', () => {
  const source = net('bag-reference'), before = copy(source);
  const result = enumerateMethodSuccessors(source, 'take');
  expect(result.complete).toBe(true);
  expect(result.successors).toHaveLength(2);
  expect(result.successors.map(s => s.produced.picked)).toEqual([[1], [2]]);
  expect(result.successors[0].next.places[0].valueTokens).toEqual([1, 2]);
  expect(source).toEqual(before);
  expect(() => prepareMethodCall(source, 'take')).toThrow(/Nondeterministic/);
});
test('distinct occurrences are required for shared input variables', () => {
  const source = net('bag-reference');
  source.arcs.push({ ...source.arcs[0], id: 'second-input' });
  const result = enumerateMethodSuccessors(source, 'take');
  expect(result.successors).toHaveLength(1);
  expect(result.successors[0].next.places[0].valueTokens).toEqual([2]);
  source.places[0].valueTokens = [1, 2]; source.places[0].tokens = 2;
  expect(enumerateMethodSuccessors(source, 'take').successors).toHaveLength(0);
});
test('identical observations retain different future states, identical edges can collapse across rules', () => {
  const source = net('branch-reference');
  expect(enumerateMethodSuccessors(source, 'open').successors).toHaveLength(2);
  source.arcs.find(a => a.source === 'openLeft' && a.target === 'state').binding = '1';
  expect(enumerateMethodSuccessors(source, 'open').successors).toHaveLength(1);
});
test.each([
  ['bag', 'missing-choice', 0], ['bag', 'multiplicity', 0], ['bag', 'extra-output', 1],
  ['branch', 'early-choice', 0], ['branch', 'missing-restriction', 1]
])('%s/%s is killed by the frozen reference property', async (family, mutation, index) => {
  const reference = net(`${family}-reference`);
  const { suite } = await generateIntention(reference.testIntentions[index], reference);
  const result = await evaluateOracleSuite(suite.selectedTests, net(`${family}-${mutation}`), suite.interface);
  expect(result.counts).toMatchObject({ fail: 1, error: 0 });
  expect(suite.selectedTests[0].referencePropertyResult.value).toBe(reference.testIntentions[index].expectedTruth);
});
test('same traces do not imply the branching property; ordinary sequences remain possible', async () => {
  const reference = net('branch-reference'), mutant = net('branch-early-choice');
  for (const [method, value] of [['left', 1], ['right', 2]]) {
    const pairs = ['open', method].map((name, i) => ({ stimulation: { method: name, arguments: {} }, observation: { outputs: { reply: [i ? value : 0] } } }));
    for (const source of [reference, mutant]) expect((await replayTest({ id: 'trace', pairs }, source, publicInterface(reference))).verdict).toBe('pass');
  }
  expect((await check(reference.testIntentions[0].formula, mutant)).value).toBe(false);
});
test('boxes permit no matching outcome; diamonds require one; complements detect unexpected outputs', async () => {
  const source = net('bag-reference');
  expect((await check(modal('box', 'take', { picked: [99] }, { op: 'false' }), source)).value).toBe(true);
  expect((await check(modal('diamond', 'take', { picked: [99] }), source)).value).toBe(false);
  const formula = { ...modal('box', 'take', { picked: [1] }, { op: 'false' }), excludeObservation: true };
  expect((await check(formula, source)).value).toBe(false);
});
test('incomplete enumeration cannot establish absence or a universal claim; witnesses can still decide', async () => {
  const source = net('bag-reference');
  const opts = { maxBindings: 2 }; // root and the first binding; the second binding is not visited
  expect((await check(modal('diamond', 'take', { picked: [1] }), source, opts)).value).toBe(true);
  expect((await check(modal('diamond', 'take', { picked: [2] }), source, opts)).value).toBe(null);
  expect((await check(modal('box', 'take', null), source, opts)).value).toBe(null);
  expect((await check(modal('box', 'take', null), source, { maxTotalBindings: 2 })).value).toBe(null);
  expect((await check(modal('box', 'take', null, { op: 'false' }), source, opts)).value).toBe(false);
  const test = { id: 'unknown', formula: modal('diamond', 'take', { picked: [2] }), expectedTruth: false };
  const run = await evaluateOracleSuite([test], source, publicInterface(source), opts);
  expect(run.counts).toMatchObject({ pass: 0, fail: 0, error: 0, inconclusive: 1 });
});
test('negation and finite node limits preserve unknown, and cancellation propagates', async () => {
  const source = net('bag-reference');
  expect((await check({ op: 'not', child: modal('diamond', 'take', null) }, source, { maxFormulaNodes: 1 })).value).toBe(null);
  const controller = new AbortController(); controller.abort();
  await expect(check({ op: 'true' }, source, { signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' });
});
test('malformed labels, observations and computations are errors, never negative-test success', async () => {
  const source = net('bag-reference');
  for (const formula of [modal('diamond', 'missing', null), modal('box', 'take', { missing: [] }), { op: 'and', children: [{ op: 'false' }, modal('diamond', 'take', { picked: ['wrong-sort'] })] }]) {
    expect((await replayTest({ id: 'bad', formula, expectedTruth: false }, source, publicInterface(source))).verdict).toBe('error');
  }
  source.arcs.find(a => a.source === 'take').binding = '2147483647 + 1';
  expect((await replayTest({ id: 'bad-output', formula: modal('box', 'take', null, { op: 'false' }) }, source, publicInterface(source))).verdict).toBe('error');
});
test('all branches share one variable assignment, never one convenient witness per branch', async () => {
  const source = net('bag-reference');
  const formula = all(modal('diamond', 'take', { picked: ['$x'] }), { op: 'not', child: modal('diamond', 'take', { picked: ['$x'] }) });
  const intention = { id: 'shared', name: 'Shared assignment', variables: [{ name: 'x', sort: 'Int', hypothesis: { type: 'finite', values: [1, 2] } }], testType: 'positive', pairs: [], formula };
  await expect(generateIntention(intention, source)).rejects.toThrow(/Reference validation failed/);
  intention.expectedTruth = false;
  expect((await generateIntention(intention, source)).suite.selectedTests).toHaveLength(2);
});
test('refusal at the end of a nondeterministic sequence retains marking assertions', async () => {
  const source = net('bag-reference');
  const pairs = [1, 1, 2].map(x => ({ stimulation: { method: 'take', arguments: {} }, observation: { outputs: { picked: [x] } } }));
  pairs.push({ assertion: 'blocked', stimulation: { method: 'take', arguments: {} }, observation: { outputs: {}, markings: { stock: { length: 1 } } } });
  expect((await replayTest({ id: 'marking', pairs }, source, publicInterface(source))).verdict).toBe('fail');
});
test('literal false guards are disabled in concrete firing and symbolic refusal constraints', () => {
  const source = net('bag-reference'); source.transitions[0].guard = 'false';
  expect(enumerateMethodSuccessors(source, 'take').successors).toEqual([]);
  const constraints = refusalConstraints(compilePublicNet(source).plans.take, { stock: [1, 1, 2], picked: [] }, {}, addBuiltins({ constructors: {}, operations: {} }), () => {});
  expect(constraints.conditions.every(c => c === true)).toBe(true);
});
test('symbolic baseline can add branching obligations using its shared selected values', async () => {
  const source = createExerciseExample('exercise-thermostat-reference');
  const intention = copy(source.testIntentions[0]);
  intention.branchingProperty = modal('diamond', 'adjust', null, { op: 'true' }, { delta: '$d' });
  const { suite } = await generateIntention(intention, source);
  expect(suite.selectedTests).toHaveLength(3);
  expect(suite.selectedTests.every(t => t.formula && t.referencePropertyResult.value)).toBe(true);
  intention.branchingProperty = { op: 'not', child: intention.branchingProperty };
  await expect(generateIntention(intention, source)).rejects.toThrow(/Reference validation failed/);
});
test('literal false guard blocks symbolic positive selection on the existing thermostat baseline', async () => {
  const source = createExerciseExample('exercise-thermostat-reference');
  source.transitions.forEach(t => { t.guard = 'false'; });
  await expect(generateIntention(source.testIntentions[0], source)).rejects.toThrow(/no executable complete sequence/);
});

test('depth-20 universal exploration reuses identical full-state obligations instead of enumerating interleavings', async () => {
  const source = net('bag-reference');
  source.places[0].valueTokens = [...Array(10).fill(1), ...Array(10).fill(2)]; source.places[0].tokens = 20;
  const formula = Array.from({ length: 20 }).reduce(child => modal('box', 'take', null, child), modal('box', 'take', null, { op: 'false' }));
  const result = await check(formula, source);
  expect(result.value).toBe(true);
  expect(result.stats.formulaCacheHits).toBeGreaterThan(50);
  expect(result.stats.evaluatedNodes).toBeLessThan(200);
  expect(JSON.stringify(result).length).toBeLessThan(150000);
});
