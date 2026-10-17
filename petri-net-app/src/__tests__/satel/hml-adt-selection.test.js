/** @jest-environment node */
import { buildHmlConstraints } from '../../satel/core/HmlConstraints.js';
import { evaluateFormula } from '../../satel/core/HmlEvaluator.js';
import { publicInterface } from '../../satel/core/TestCase.js';
import { parseSymbolicSource } from '../../satel/core/SymbolicSource.js';
import { evaluateGround, substitute } from '../../satel/core/SymbolicTerms.js';
import { createSymbolicSolver } from '../../satel/core/SymbolicZ3.js';
import { builder, pairValue } from '../../satel/examples/exercises/builder.js';
import { modal } from '../../satel/examples/nondeterminism/editor.js';
import { instantiateFormula } from '../../satel/core/HmlFormula.js';
import { valueToSymbolic, symbolicToValue } from '../../utils/builtin-values.js';

jest.setTimeout(60000);
const algebra = parseSymbolicSource('');
const build = (formula, net, variables = {}, options = {}) => buildHmlConstraints(formula, net, publicInterface(net), Object.fromEntries(Object.keys(variables).map(n => [n, { var: n }])), variables, algebra, options);
const evaluate = (constraints, assignment) => constraints.conditions.every(c => evaluateGround(substitute(c, new Map(Object.entries(assignment).map(([n, v]) => [n, valueToSymbolic(v)])))) === true);
const model = (sort, guard, output = 'x', resultSort = sort) => {
  const b = builder(); b.place('out', resultSort, [], true);
  b.rule('step', 'step', { x: sort }, guard, [], [['out', output]]);
  return b.net;
};

const scenarios = [
  ['String', 'length(x) >= 2 and isSubstringOf("ab", x)', 'substring(concat(x, "!"), -2, 2)', 'String', ['', 'a', 'ab', 'abc', '😀ab', '\ud800ab']],
  ['List', 'length(x) == 0 or asInt(head(x)) >= 2', 'append(tail(x), true)', 'List', [[], [1], [2], [3, 'a']]],
  ['Pair', 'asInt(fst(x)) >= 2 and asBool(snd(x))', '(asInt(fst(x)) + 1, false)', 'Pair', [pairValue(1, true), pairValue(2, true), pairValue(2, false)]],
];
test.each(scenarios)('%s equation expansion agrees with concrete guards, outputs and expected-false properties', async (sort, guard, output, resultSort, values) => {
  const net = model(sort, guard, output, resultSort);
  for (const expectedTruth of [true, false]) {
    const formula = modal('diamond', 'step', null, { op: 'true' }, { x: '$x' });
    const constraints = await build(formula, net, { x: sort }, { expectedTruth });
    for (const x of values) {
      const concrete = await evaluateFormula(instantiateFormula(formula, { x }), net, publicInterface(net));
      expect(concrete.value).not.toBeNull();
      expect(evaluate(constraints, { x })).toBe(concrete.value === expectedTruth);
    }
  }
});

test.each(scenarios)('%s has a solver witness checked by concrete HML replay', async (sort, guard, output, resultSort) => {
  const net = model(sort, guard, output, resultSort);
  const formula = modal('diamond', 'step', null, { op: 'true' }, { x: '$x' });
  const constraints = await build(formula, net, { x: sort });
  const solve = await createSymbolicSolver(algebra);
  const result = await solve({ terms: [{ var: 'x' }], conditions: constraints.conditions, variables: { x: sort } });
  expect({ status: result.status, reason: result.reason, stats: constraints.stats }).toMatchObject({ status: 'sat' });
  const concrete = await evaluateFormula(instantiateFormula(formula, { x: symbolicToValue(result.bindings.get('x')) }), net, publicInterface(net));
  expect(concrete.value).toBe(true);
});

test('undefined head/projection is neither a successful refusal nor a negative-property witness', async () => {
  for (const [sort, guard, value] of [['List', 'asInt(head(x)) > 0', []], ['List', 'asInt(head(x)) > 0', [true]], ['Pair', 'asInt(fst(x)) > 0', pairValue(false, 1)]]) {
    const net = model(sort, guard);
    for (const [op, expectedTruth] of [['box', true], ['diamond', false]]) {
      const formula = modal(op, 'step', null, { op: 'false' }, { x: '$x' });
      expect(evaluate(await build(formula, net, { x: sort }, { expectedTruth }), { x: value })).toBe(false);
      await expect(evaluateFormula(instantiateFormula(formula, { x: value }), net, publicInterface(net))).rejects.toThrow();
    }
  }
});

test('short-circuit protects empty head, bad projections and unvisited HML continuations', async () => {
  const cases = [
    ['List', 'length(x) == 0 or asInt(head(x)) > 0', []],
    ['List', 'length(x) != 0 implies asInt(head(x)) > 0', []],
    ['Pair', 'fst(x) == false or asInt(fst(x)) > 0', pairValue(false, 1)],
  ];
  for (const [sort, guard, x] of cases) {
    const net = model(sort, guard), formula = modal('diamond', 'step', null, { op: 'true' }, { x: '$x' });
    const c = await build(formula, net, { x: sort });
    expect(evaluate(c, { x })).toBe(true);
    expect((await evaluateFormula(instantiateFormula(formula, { x }), net, publicInterface(net))).value).toBe(true);
  }
  const net = model('List', 'asInt(head(x)) > 0');
  const formula = { op: 'or', children: [{ op: 'true' }, modal('diamond', 'step', null, { op: 'true' }, { x: '$x' })] };
  expect(evaluate(await build(formula, net, { x: 'List' }), { x: [] })).toBe(true);
});

test('nested symbolic labels, escaped dollar strings and multiplicities are structural values', async () => {
  const net = model('List', 'true');
  const label = [pairValue('$n', { literal: '$literal' }), '$flag'];
  const formula = modal('diamond', 'step', { out: [label] }, { op: 'marking', markings: { out: { equals: [label] } } }, { x: label });
  const constraints = await build(formula, net, { n: 'Int', flag: 'Bool' });
  expect(evaluate(constraints, { n: 3, flag: false })).toBe(true);
  expect((await evaluateFormula(instantiateFormula(formula, { n: 3, flag: false }), net, publicInterface(net))).value).toBe(true);
  await expect(build(modal('diamond', 'step', null, { op: 'true' }, { x: ['$missing'] }), net)).rejects.toThrow(/Undeclared/);
});

test('an exhausted recursive equation expansion cannot assert truth or falsity', async () => {
  const net = model('List', 'length(x) >= 3');
  for (const expectedTruth of [true, false]) {
    const formula = modal('diamond', 'step', null, { op: 'true' }, { x: '$x' });
    const constraints = await build(formula, net, { x: 'List' }, { maxHmlUnfoldingDepth: 1, expectedTruth });
    expect(constraints.stats.residualCalls).toBeGreaterThan(0);
    expect(evaluate(constraints, { x: [1, 2, 3] })).toBe(false);
  }
});

// End-to-end generation must replace a static witness, not just recognize an
// already ground value. Every admitted test is replayed unchanged on mutants.
import { createHmlAlgebraicExample } from '../../satel/examples/hml-selection/algebraic.js';
import { generateIntention, deriveIntention } from '../../satel/core/IntentionPipeline.js';
import { evaluateOracleSuite } from '../../satel/core/ValidatedSubuniformity.js';

test.each(['string', 'list', 'pair'])('%s shared algebraic parameters are selected jointly and both mutants fail', async kind => {
  const net = createHmlAlgebraicExample(`hml-adt-${kind}-reference`);
  for (const intention of net.testIntentions) {
    const generated = await generateIntention(intention, net);
    expect(generated.suite.validation).toEqual({ generated: 1, referencePassed: 1 });
    const domain = generated.report.execution.selected[0];
    expect(domain.execution.representative).toBe('solved jointly from sequence and HML property');
    const value = symbolicToValue(domain.witnessArgs[0]);
    if (kind === 'string') expect(value).toContain('ok');
    if (kind === 'list') expect(value[0]).toBeGreaterThanOrEqual(3);
    if (kind === 'pair') { expect(value.fst).toBeGreaterThanOrEqual(3); expect(value.snd).toBe(true); }
    for (const mutation of ['missing-finish', 'wrong-value']) {
      const replay = await evaluateOracleSuite(generated.suite.selectedTests, createHmlAlgebraicExample(`hml-adt-${kind}-${mutation}`), generated.suite.interface);
      expect(replay.counts).toEqual({ pass: 0, fail: 1, error: 0 });
    }
  }
});

test('a residual recursive HML search is unresolved, never a disproved class', async () => {
  const net = createHmlAlgebraicExample('hml-adt-list-reference');
  const intention = structuredClone(net.testIntentions[0]);
  intention.symbolic.source = 'operation seed(List): Bool\nrule any(xs: List): seed(xs) = true';
  net.transitions.find(t => t.id === 'finish').guard = 's == 1 or (s == 2 and length(v) >= 3)';
  const report = await deriveIntention(intention, net, { maxHmlUnfoldingDepth: 1 });
  expect(report.execution.selected).toEqual([]);
  expect(report.execution.blocked).toEqual([]);
  expect(report.execution.unresolved.length).toBeGreaterThan(0);
  expect(report.execution.unresolved.some(x => /residual/.test(x.reason))).toBe(true);
});

test.each([
  ['List', 'tail(x)', 'List', [1, 2], [2]],
  ['List', 'asInt(head(x))', 'Int', [2, false], 2],
  ['List', 'concat(x, [true])', 'List', [1], [1, true]],
  ['List', 'append(x, (2, true))', 'List', [1], [1, pairValue(2, true)]],
  ['List', 'sublist(x, -2, 1)', 'List', [1, 2, 3], [2]],
  ['List', 'isSublistOf([2, 3], x)', 'Bool', [1, 2, 3], true],
  ['List', 'isSublistOf([1, 3], x)', 'Bool', [1, 2, 3], false],
  ['Pair', 'asString(fst(x))', 'String', pairValue('hi', false), 'hi'],
  ['Pair', 'asList(fst(x))', 'List', pairValue([1, false], 2), [1, false]],
  ['Pair', 'asPair(snd(x))', 'Pair', pairValue(1, pairValue('x', true)), pairValue('x', true)],
  ['String', 'substring(concat(x, "!"), -2, 1)', 'String', '😀', '\ude00'],
])('%s output %s has the same algebraic observation and marking as replay', async (sort, output, resultSort, x, expected) => {
  const net = model(sort, 'true', output, resultSort);
  const formula = modal('diamond', 'step', { out: [expected] }, { op: 'marking', markings: { out: { equals: [expected] } } }, { x: '$x' });
  const constraints = await build(formula, net, { x: sort }, { maxHmlUnfoldingDepth: 4, maxHmlConstraintSize: 500000 });
  expect(evaluate(constraints, { x })).toBe(true);
  expect((await evaluateFormula(instantiateFormula(formula, { x }), net, publicInterface(net))).value).toBe(true);
});

test('nested machine-integer bounds are retained by the symbolic validity predicate', async () => {
  const net = model('List', 'true'), formula = modal('diamond', 'step', null, { op: 'true' }, { x: '$x' });
  const c = await build(formula, net, { x: 'List' });
  expect(evaluate(c, { x: [2147483648] })).toBe(false);
  const solve = await createSymbolicSolver(algebra);
  const result = await solve({ terms: [], conditions: [...c.conditions, { op: '==', left: { var: 'x' }, right: valueToSymbolic([2147483648]) }], variables: { x: 'List' } });
  expect(result.status).toBe('unsat');
});

test.each([32, 33])('nested value depth %i agrees between SMT validity and concrete runtime limits', async depth => {
  const x = Array.from({ length: depth }).reduce(v => [v], 0);
  const net = model('List', 'true'), formula = modal('diamond', 'step', null, { op: 'true' }, { x: '$x' });
  const c = await build(formula, net, { x: 'List' });
  expect(evaluate(c, { x })).toBe(depth === 32);
  const solve = await createSymbolicSolver(algebra);
  const result = await solve({ terms: [], conditions: [...c.conditions, { op: '==', left: { var: 'x' }, right: valueToSymbolic(x) }], variables: { x: 'List' } });
  expect(result.status).toBe(depth === 32 ? 'sat' : 'unsat');
});
