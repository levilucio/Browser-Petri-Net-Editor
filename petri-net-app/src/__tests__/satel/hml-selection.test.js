/** @jest-environment node */
import { buildHmlConstraints } from '../../satel/core/HmlConstraints.js';
import { evaluateFormula } from '../../satel/core/HmlEvaluator.js';
import { generateIntention, deriveIntention } from '../../satel/core/IntentionPipeline.js';
import { evaluateOracleSuite } from '../../satel/core/ValidatedSubuniformity.js';
import { createHmlSelectionExample } from '../../satel/examples/hml-selection/editor.js';
import { createNondeterminismExample, modal, nondeterminismExamples } from '../../satel/examples/nondeterminism/editor.js';
import { createExerciseExample } from '../../satel/examples/exercises/editor.js';
import { publicInterface } from '../../satel/core/TestCase.js';
import { parseSymbolicSource } from '../../satel/core/SymbolicSource.js';
import { evaluateGround, substitute } from '../../satel/core/SymbolicTerms.js';
import { createSymbolicSolver } from '../../satel/core/SymbolicZ3.js';
import { builder } from '../../satel/examples/exercises/builder.js';
import { instantiateFormula } from '../../satel/core/HmlFormula.js';

jest.setTimeout(30000);
const reference = () => createHmlSelectionExample();
const clone = x => JSON.parse(JSON.stringify(x));
const algebra = parseSymbolicSource('');
const build = (formula, net, variables = {}, options = {}) => buildHmlConstraints(formula, net, publicInterface(net), Object.fromEntries(Object.keys(variables).map(n => [n, { var: n }])), variables, algebra, options);
const evaluate = (constraints, assignment) => constraints.conditions.every(c => evaluateGround(substitute(c, new Map(Object.entries(assignment)))) === true);

test('joint selection replaces a sequence-valid representative and admits the frozen complete property', async () => {
  const net = reference(), intention = clone(net.testIntentions[0]);
  delete intention.branchingProperty;
  const sequence = await generateIntention(intention, net);
  expect(sequence.report.execution.selected[0].witnessArgs).toEqual([1]);
  const joint = await generateIntention(net.testIntentions[0], net);
  const domain = joint.report.execution.selected[0];
  expect(domain.staticWitness.args).toEqual([1]);
  expect(domain.witnessArgs[0]).toBeGreaterThanOrEqual(3);
  expect(domain.witnessArgs[0]).toBeLessThanOrEqual(5);
  expect(domain.execution.representative).toBe('solved jointly from sequence and HML property');
  expect(joint.suite.validation).toEqual({ generated: 1, referencePassed: 1 });
  expect(joint.suite.selectedTests[0].propertySelection).toBe('joint-sequence-and-hml');
  for (const mutation of ['missing-finish', 'wrong-receipt']) {
    const replay = await evaluateOracleSuite(joint.suite.selectedTests, createHmlSelectionExample(`hml-selection-${mutation}`), joint.suite.interface);
    expect(replay.counts).toMatchObject({ fail: 1, pass: 0, error: 0 });
  }
});

test('expected-false property selects values by negation and is concretely validated', async () => {
  const net = reference(), result = await generateIntention(net.testIntentions[1], net);
  expect(result.report.execution.selected[0].witnessArgs[0]).toBeGreaterThanOrEqual(3);
  expect(result.suite.selectedTests[0]).toMatchObject({ expectedTruth: true, branchingExpectedTruth: false });
  expect(result.suite.selectedTests[0].formula.children[1].op).toBe('not');
  expect(result.suite.selectedTests[0].referencePropertyResult.value).toBe(true);
});

test('symbolic and concrete truth agree for every bounded amount, including expected false', async () => {
  const net = reference();
  for (const intention of net.testIntentions) {
    const constraints = await build(intention.branchingProperty, net, { n: 'Nat' }, { expectedTruth: intention.branchingExpectedTruth });
    for (const n of [0, 1, 2, 3, 4, 5]) {
      const concrete = await evaluateFormula(instantiateFormula(intention.branchingProperty, { n }), net, publicInterface(net));
      expect(evaluate(constraints, { n })).toBe(concrete.value === (intention.branchingExpectedTruth ?? true));
    }
  }
});

test.each(nondeterminismExamples.map(e => e.filename))('symbolic truth agrees with existing concrete baseline %s', async filename => {
  const net = createNondeterminismExample(filename);
  for (const intention of net.testIntentions) {
    const constraints = await build(intention.formula, net, {}, { expectedTruth: intention.expectedTruth });
    const concrete = await evaluateFormula(intention.formula, net, publicInterface(net));
    expect(evaluate(constraints, {})).toBe(concrete.value === (intention.expectedTruth ?? true));
  }
});

test('a single shared assignment cannot satisfy conflicting branches', async () => {
  const net = reference(), intention = clone(net.testIntentions[0]);
  const valueIs = n => modal('diamond', 'open', { reply: [n] }, { op: 'true' }, { n: '$n' });
  intention.branchingProperty = { op: 'and', children: [valueIs(1), valueIs(2)] };
  const report = await deriveIntention(intention, net);
  expect(report.execution.selected).toEqual([]);
  expect(report.execution.blocked).toHaveLength(1);
  expect(report.execution.unresolved).toEqual([]);
  await expect(generateIntention(intention, net)).rejects.toThrow(/No partial suite/);
});

test('boxes use implications: disabled rules and outcomes outside the filter do not constrain the continuation', async () => {
  const net = reference();
  net.transitions.find(t => t.id === 'openB').guard = 's == 0 and n < 3';
  const formula = net.testIntentions[0].branchingProperty;
  const constraints = await build(formula, net, { n: 'Nat' });
  expect(evaluate(constraints, { n: 1 })).toBe(false);
  expect(evaluate(constraints, { n: 3 })).toBe(true);
  const vacuous = modal('box', 'open', { reply: [99] }, { op: 'false' }, { n: '$n' });
  expect(evaluate(await build(vacuous, net, { n: 'Nat' }), { n: 1 })).toBe(true);
  net.transitions.filter(t => t.method.name === 'open').forEach(t => { t.guard = 'false'; });
  expect(evaluate(await build(formula, net, { n: 'Nat' }), { n: 1 })).toBe(true);
  expect(evaluate(await build({ ...formula, op: 'diamond' }, net, { n: 'Nat' }), { n: 1 })).toBe(false);
});

test('multiset multiplicity, shared input variables and symbolic parameter matching agree with replay', async () => {
  const net = createNondeterminismExample('nondeterminism-bag-reference');
  net.transitions[0].method.parameters = [{ name: 'x', sort: 'Int' }];
  net.arcs.push({ ...net.arcs[0], id: 'second-input' });
  const formula = modal('diamond', 'take', { picked: ['$n'] }, { op: 'marking', markings: { stock: { equals: [2] } } }, { x: '$n' });
  const constraints = await build(formula, net, { n: 'Int' });
  for (const n of [1, 2, 3]) {
    const result = await evaluateFormula(instantiateFormula(formula, { n }), net, publicInterface(net));
    expect(evaluate(constraints, { n })).toBe(result.value);
  }
  expect(evaluate(constraints, { n: 1 })).toBe(true);
  expect(evaluate(constraints, { n: 2 })).toBe(false);
});

test('complement filters and all marking predicates preserve symbolic scalar variables', async () => {
  const net = createNondeterminismExample('nondeterminism-bag-reference');
  const formulas = [
    { ...modal('box', 'take', { picked: ['$n'] }, { op: 'false' }), excludeObservation: true },
    { op: 'marking', markings: { stock: { contains: ['$n', '$n'] } } },
    { op: 'marking', markings: { stock: { length: '$n' }, picked: { empty: '$empty' } } },
    { ...modal('diamond', 'take', {}), observation: { outputs: {}, markings: { stock: { equals: ['$n', 2] } } } },
  ];
  for (const formula of formulas) {
    const constraints = await build(formula, net, { n: 'Nat', empty: 'Bool' });
    for (const assignment of [{ n: 1, empty: true }, { n: 2, empty: false }, { n: 3, empty: true }]) {
      const concrete = await evaluateFormula(instantiateFormula(formula, assignment), net, publicInterface(net));
      expect(evaluate(constraints, assignment)).toBe(concrete.value);
    }
  }
});

test('Bool and signed Int method parameters are selected by the same solver', async () => {
  const b = builder(); b.place('reply', 'Bool', [], true);
  b.rule('accept', 'accept', { flag: 'Bool', delta: 'Int' }, 'flag and delta < 0', [], [['reply', 'flag']]);
  const formula = modal('diamond', 'accept', { reply: [true] }, { op: 'true' }, { flag: '$f', delta: '$d' });
  const constraints = await build(formula, b.net, { f: 'Bool', d: 'Int' });
  const solve = await createSymbolicSolver(algebra);
  const result = await solve({ terms: [{ var: 'f' }, { var: 'd' }], conditions: constraints.conditions, variables: { f: 'Bool', d: 'Int' } });
  expect(result.status).toBe('sat');
  expect(result.bindings.get('f')).toBe(true);
  expect(result.bindings.get('d')).toBeLessThan(0);
  const actual = await evaluateFormula(instantiateFormula(formula, Object.fromEntries(result.bindings)), b.net, publicInterface(b.net));
  expect(actual.value).toBe(true);
});

test('output overflow is not encoded as a disabled transition or a successful refusal', async () => {
  const b = builder(); b.place('out', 'Int', [], true);
  b.rule('bad', 'step', { n: 'Int' }, '', [], [['out', 'n + 1']]);
  const formula = modal('box', 'step', null, { op: 'false' }, { n: '$n' });
  const constraints = await build(formula, b.net, { n: 'Int' }, { expectedTruth: false });
  expect(evaluate(constraints, { n: 1 })).toBe(true);
  expect(evaluate(constraints, { n: 2147483647 })).toBe(false);
});

test('arithmetic intermediates and short-circuit guards respect concrete overflow semantics', async () => {
  const b = builder(); b.place('out', 'Int', [], true);
  b.rule('step', 'step', { n: 'Int' }, 'n == 2147483647 or n + 1 > 0', [], [['out', 'n']]);
  let formula = modal('diamond', 'step', null, { op: 'true' }, { n: '$n' });
  expect(evaluate(await build(formula, b.net, { n: 'Int' }), { n: 2147483647 })).toBe(true);
  b.net.arcs[0].binding = '(n + 1) - 1';
  expect(evaluate(await build(formula, b.net, { n: 'Int' }), { n: 2147483647 })).toBe(false);
  // A logically unvisited continuation must not force its unsafe computation.
  formula = { op: 'or', children: [{ op: 'true' }, formula] };
  expect(evaluate(await build(formula, b.net, { n: 'Int' }), { n: 2147483647 })).toBe(true);
});

test('incomplete construction stays unresolved and never admits a partial universal claim', async () => {
  const net = reference();
  const report = await deriveIntention(net.testIntentions[0], net, { maxHmlSelectionWork: 1 });
  expect(report.execution.blocked).toEqual([]);
  expect(report.execution.unresolved).toHaveLength(1);
  expect(report.execution.selected).toEqual([]);
  await expect(generateIntention(net.testIntentions[0], net, { maxHmlSelectionNodes: 1 })).rejects.toThrow(/unresolved/);
  await expect(build(net.testIntentions[0].branchingProperty, net, { n: 'Nat' }, { maxHmlConstraintSize: 1 })).rejects.toMatchObject({ code: 'resource-limit' });
});

test('unsupported ADT/String joint selection is explicit; cancellation and invalid unreachable labels are checked', async () => {
  const net = createExerciseExample('exercise-thermostat-reference');
  const controller = new AbortController(); controller.abort();
  await expect(build({ op: 'true' }, net, {}, { signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' });
  const source = reference(); source.places[0].sort = 'String'; source.places[0].valueTokens = ['start'];
  await expect(build({ op: 'true' }, source)).rejects.toThrow(/Nat, Int and Bool/);
  await expect(build({ op: 'or', children: [{ op: 'true' }, modal('diamond', 'missing', null)] }, reference())).rejects.toThrow(/Invalid method signature/);
});
