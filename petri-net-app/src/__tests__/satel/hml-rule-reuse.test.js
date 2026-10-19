/** @jest-environment node */
import { createHmlRuleEffects } from '../../satel/core/HmlRuleEffects.js';
import { createHmlTerms } from '../../satel/core/HmlTerms.js';
import { buildHmlConstraints } from '../../satel/core/HmlConstraints.js';
import { evaluateFormula } from '../../satel/core/HmlEvaluator.js';
import { instantiateFormula } from '../../satel/core/HmlFormula.js';
import { compilePublicNet } from '../../domain/apn/PublicMethods.js';
import { publicInterface } from '../../satel/core/TestCase.js';
import { parseSymbolicSource } from '../../satel/core/SymbolicSource.js';
import { evaluateGround, substitute } from '../../satel/core/SymbolicTerms.js';
import { valueToSymbolic } from '../../utils/builtin-values.js';
import { builder } from '../../satel/examples/exercises/builder.js';
import { modal } from '../../satel/examples/nondeterminism/editor.js';

const algebra = parseSymbolicSource('');
const ground = (term, assignment = {}) => evaluateGround(substitute(term, new Map(Object.entries(assignment).map(([n, v]) => [n, valueToSymbolic(v)]))));
const calculator = (net, tick = () => {}) => {
  const stats = { ruleRequests: 0, guardEvaluations: 0, bindingVisits: 0 };
  const effects = createHmlRuleEffects(new Map(net.places.map(p => [p.id, p])), createHmlTerms(algebra, tick, stats), tick, stats);
  const plans = compilePublicNet(net).plans;
  return { effects, stats, plans };
};
const build = (formula, net, sorts = {}, options = {}) => buildHmlConstraints(formula, net, publicInterface(net), Object.fromEntries(Object.keys(sorts).map(n => [n, { var: n }])), sorts, algebra, options);
const agrees = async (formula, net, sorts = {}, assignments = [{}]) => {
  const compiled = await build(formula, net, sorts);
  for (const assignment of assignments) {
    const actual = await evaluateFormula(instantiateFormula(formula, assignment), net, publicInterface(net));
    expect(compiled.conditions.every(c => ground(c, assignment) === true)).toBe(actual.value);
  }
  return compiled;
};

test('rule keys retain ordered token indices, multiplicity and method arguments', () => {
  const b = builder(); b.place('stock', 'Int', [1, 1, 2]); b.place('out', 'Int', [], true);
  b.rule('take', 'take', { x: 'Int' }, 'true', [['stock', 'x'], ['stock', 'x']], [['out', 'x']]);
  const { effects, stats, plans } = calculator(b.net), plan = plans.take[0];
  const run = (stock, x) => [...effects(plan, { x }, { stock, out: [] })].filter(e => e.enabled !== false);
  expect(run([1, 1, 2], 1).map(e => e.picks.map(p => p.index))).toEqual([[0, 1]]);
  expect(run([1, 1, 2], 1).map(e => e.picks.map(p => p.index))).toEqual([[0, 1]]);
  expect(stats.ruleCacheHits).toBe(1);
  expect(run([2, 1, 1], 1).map(e => e.picks.map(p => p.index))).toEqual([[1, 2]]);
  expect(run([1, 2], 1)).toEqual([]);
  expect(run([1, 1, 2], 2)).toEqual([]);
});

test('a reused prefix still matches changed later inputs and shared variables', () => {
  const b = builder(); b.place('a', 'Int', [1]); b.place('b', 'Int', [1]); b.place('out', 'Int', [], true);
  b.rule('join', 'join', {}, 'true', [['a', 'x'], ['b', 'x']], [['out', 'x']]);
  const { effects, stats, plans } = calculator(b.net), plan = plans.join[0];
  expect([...effects(plan, {}, { a: [1], b: [1] })]).toHaveLength(1);
  expect([...effects(plan, {}, { a: [1], b: [2] })]).toEqual([]);
  expect(stats.bindingCacheHits).toBe(1);
  expect(stats.bindingPrefixArcsReused).toBe(1);
  expect([...effects(plan, {}, { a: [1], b: [1, 1] })]).toHaveLength(1);
});

test('interrupted binding search and stopped effect iteration never publish partial effects', () => {
  const b = builder(); b.place('stock', 'Int', [1, 2]); b.place('out', 'Int', [], true);
  b.rule('take', 'take', {}, 'true', [['stock', 'x']], [['out', 'x']]);
  let work = 0, failAt = 3;
  const { effects, stats, plans } = calculator(b.net, () => { if (++work === failAt) throw new Error('limited'); });
  const run = () => effects(plans.take[0], {}, { stock: [1, 2] });
  expect(() => [...run()]).toThrow('limited');
  failAt = Infinity;
  const partial = run(); expect(partial.next().done).toBe(false); partial.return();
  expect(stats.ruleCacheHits).toBe(0);
  expect([...run()].map(e => e.produced.out)).toEqual([[1], [2]]);
  expect(stats.ruleCacheHits).toBe(0);
  expect([...run()]).toHaveLength(2);
  expect(stats.ruleCacheHits).toBe(1);
  failAt = work + 1;
  expect(() => [...run()]).toThrow('limited');
});

test('cached effects apply to the current full marking and preserve accumulated output tokens', async () => {
  const b = builder(); b.place('audit', 'List', [[]]); b.place('out', 'Int', [], true);
  for (const i of [1, 2]) b.rule(`choose_${i}`, 'choose', {}, 'true', [['audit', 'xs']], [['audit', `append(xs, ${i})`]]);
  b.rule('emit', 'emit', {}, 'true', [], [['out', '7']]);
  const history = i => ({ op: 'marking', markings: { audit: { equals: [[i]] }, out: { equals: [7, 7] } } });
  const continuation = { op: 'or', children: [history(1), history(2)] };
  const formula = modal('box', 'choose', null, modal('diamond', 'emit', { out: [7] }, modal('diamond', 'emit', { out: [7] }, continuation)));
  const compiled = await agrees(formula, b.net);
  expect(compiled.conditions.every(c => ground(c))).toBe(true);
  expect(compiled.stats.ruleCacheHits).toBeGreaterThan(0);
  const contradictory = modal('box', 'choose', null, modal('diamond', 'emit', { out: [8] }));
  expect((await agrees(contradictory, b.net)).conditions.every(c => ground(c))).toBe(false);
});

test('competing rules, symbolic parameters and observation complements retain concrete truth', async () => {
  const b = builder(); b.place('bag', 'Int', [1, 1, 2]); b.place('out', 'Int', [], true);
  b.rule('take', 'take', { x: 'Int' }, 'x > 0', [['bag', 'x'], ['bag', 'x']], [['out', 'x']]);
  b.rule('other', 'take', { x: 'Int' }, 'x == 2', [['bag', 'x']], [['out', '9']]);
  const variables = { n: 'Int' }, args = { x: '$n' };
  const first = modal('diamond', 'take', { out: ['$n'] }, { op: 'marking', markings: { bag: { equals: [2] } } }, args);
  const rejected = { ...modal('box', 'take', { out: ['$n'] }, { op: 'false' }, args), excludeObservation: true };
  await agrees({ op: 'and', children: [first, rejected] }, b.net, variables, [0, 1, 2, 3].map(n => ({ n })));
  const repeated = { op: 'or', children: [first, { ...first, observation: { outputs: { out: [9] } } }] };
  expect((await agrees(repeated, b.net, variables, [0, 1, 2, 3].map(n => ({ n })))).stats.ruleCacheHits).toBeGreaterThan(0);
});

test('cached unsafe guards and outputs cannot become true properties or negative witnesses', async () => {
  for (const fault of ['guard', 'output']) {
    const b = builder(); b.place('stock', 'Int', [1]); b.place('out', 'Int', [], true);
    b.rule('bad', 'bad', {}, fault === 'guard' ? 'asInt(head([])) == 0' : 'true', [['stock', 'x']], [['out', fault === 'output' ? '2147483647 + 1' : 'x']]);
    const atom = modal('diamond', 'bad', null);
    const formula = { op: 'and', children: [atom, { ...atom }] };
    for (const expectedTruth of [true, false]) {
      const compiled = await build(formula, b.net, {}, { expectedTruth });
      expect(compiled.stats.ruleCacheHits).toBeGreaterThan(0);
      expect(compiled.conditions.every(c => ground(c))).toBe(false);
    }
    await expect(evaluateFormula(formula, b.net, publicInterface(b.net))).rejects.toThrow();
    const stock = b.net.places.find(p => p.id === 'stock'); stock.valueTokens = []; stock.tokens = 0;
    const safe = await build(formula, b.net, {}, { expectedTruth: false });
    expect(safe.stats.ruleCacheHits).toBeGreaterThan(0);
    expect(safe.conditions.every(c => ground(c))).toBe(true);
  }
});
