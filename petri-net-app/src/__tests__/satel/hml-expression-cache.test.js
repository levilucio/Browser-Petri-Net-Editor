/** @jest-environment node */
import { createHmlTerms } from '../../satel/core/HmlTerms.js';
import { compileMethodTerm, evaluateMethodTerm } from '../../domain/apn/MethodTerms.js';
import { parseSymbolicSource } from '../../satel/core/SymbolicSource.js';
import { evaluateGround, substitute } from '../../satel/core/SymbolicTerms.js';
import { valueToSymbolic, symbolicToValue } from '../../utils/builtin-values.js';
import { buildHmlConstraints } from '../../satel/core/HmlConstraints.js';
import { evaluateFormula } from '../../satel/core/HmlEvaluator.js';
import { publicInterface } from '../../satel/core/TestCase.js';
import { builder } from '../../satel/examples/exercises/builder.js';
import { modal } from '../../satel/examples/nondeterminism/editor.js';

const algebra = parseSymbolicSource('');
const make = (options = {}, tick = () => {}) => {
  const stats = {}, expression = createHmlTerms(algebra, tick, stats, options);
  return { stats, expression };
};
const ground = (term, values = {}) => evaluateGround(substitute(term, new Map(Object.entries(values).map(([k, v]) => [k, valueToSymbolic(v)]))));

test('reuse depends on the expression bindings, including original symbolic variable names', () => {
  const { stats, expression } = make();
  const variables = { n: 'Int', history: 'List' }, term = compileMethodTerm('n >= 3', variables, 'Bool');
  const first = expression(term, { n: { var: 'left' }, history: valueToSymbolic([1]) }, variables, 'Bool');
  const repeat = expression(term, { n: { var: 'left' }, history: valueToSymbolic([2, 1]) }, variables, 'Bool');
  expect(repeat).toBe(first);
  const other = expression(term, { n: { var: 'right' }, history: valueToSymbolic([1]) }, variables, 'Bool');
  expect(other).not.toBe(first);
  expect(ground(first.term, { left: 2, right: 4 })).toBe(false);
  expect(ground(other.term, { left: 2, right: 4 })).toBe(true);
  expect(stats).toMatchObject({ preparedExpressions: 1, expressionRequests: 3, expressionCacheHits: 1 });
});

test('an output that reads history retains its complete algebraic value in the key', () => {
  const { expression, stats } = make(), variables = { xs: 'List', n: 'Int' };
  const term = compileMethodTerm('append(xs, 3)', variables, 'List');
  const translate = xs => expression(term, { xs: valueToSymbolic(xs), n: 0 }, variables, 'List');
  const a = translate([1]), b = translate([2]);
  expect(symbolicToValue(ground(a.term))).toEqual([1, 3]);
  expect(symbolicToValue(ground(b.term))).toEqual([2, 3]);
  expect(translate([1])).toBe(a);
  expect(stats.expressionCacheHits).toBe(1);
});

test('preparation distinguishes the expected sort and variable declarations', () => {
  const { expression, stats } = make();
  expect(expression(1, {}, {}, 'Int').term).toBe(1);
  expect(expression(1, {}, {}, 'Any').term).toEqual({ ctor: '_AnyInt', args: [1] });
  const term = { var: 'x' };
  expect(expression(term, { x: true }, { x: 'Bool' }, 'Any').term).toEqual({ ctor: '_AnyBool', args: [true] });
  expect(expression(term, { x: 1 }, { x: 'Int' }, 'Any').term).toEqual({ ctor: '_AnyInt', args: [1] });
  expect(stats).toMatchObject({ preparedExpressions: 4, expressionCacheHits: 0 });
});

test('cached values retain definedness and short-circuit behaviour for different list bindings', () => {
  const { expression } = make(), variables = { xs: 'List' };
  for (const source of ['asInt(head(xs)) > 0', 'length(xs) == 0 or asInt(head(xs)) > 0']) {
    const term = compileMethodTerm(source, variables, 'Bool');
    for (const xs of [[], [1], [false], [], [1], [false]]) {
      const result = expression(term, { xs: valueToSymbolic(xs) }, variables, 'Bool');
      let concrete;
      try {
        concrete = evaluateMethodTerm(term, { xs });
      } catch {
        expect(ground(result.safe)).toBe(false);
        continue;
      }
      expect(ground(result.safe)).toBe(true);
      expect(ground(result.term)).toBe(concrete);
    }
  }
});

test('unfolding scope and cached requests still respect resource and cancellation checks', () => {
  const variables = { xs: 'List' }, term = compileMethodTerm('length(xs) >= 3', variables, 'Bool');
  const shallow = make({ maxHmlUnfoldingDepth: 1 }), deeper = make({ maxHmlUnfoldingDepth: 4 });
  const env = { xs: { var: 'root' } };
  const a = shallow.expression(term, env, variables, 'Bool');
  expect(shallow.expression(term, env, variables, 'Bool')).toBe(a);
  expect(ground(a.safe, { root: [1, 2, 3] })).toBe(false);
  expect(ground(deeper.expression(term, env, variables, 'Bool').safe, { root: [1, 2, 3] })).toBe(true);
  let stopped = false, work = 0;
  const checked = make({}, () => { work++; if (stopped) throw new Error('stopped'); });
  checked.expression(true, {}, {}, 'Bool');
  const before = work;
  checked.expression(true, {}, {}, 'Bool');
  expect(work).toBe(before + 1);
  stopped = true;
  expect(() => checked.expression(true, {}, {}, 'Bool')).toThrow('stopped');
});

test('distinct audit histories still affect future enabledness and explicit marking observations', async () => {
  const b = builder(); b.place('audit', 'List', [[]]); b.place('reply', 'Int', [], true);
  for (const i of [1, 2]) b.rule(`choose_${i}`, 'choose', {}, 'true', [['audit', 'xs']], [['audit', `append(xs, ${i})`]]);
  b.rule('finish', 'finish', {}, 'asInt(head(xs)) == 1', [['audit', 'xs']], [['audit', 'xs'], ['reply', '1']]);
  const formulas = [
    modal('box', 'choose', null, modal('diamond', 'finish', { reply: [1] })),
    modal('diamond', 'choose', null, modal('diamond', 'finish', { reply: [1] })),
    modal('box', 'choose', null, { op: 'marking', markings: { audit: { equals: [[1]] } } }),
    modal('diamond', 'choose', null, { op: 'marking', markings: { audit: { equals: [[2]] } } }),
  ];
  for (const [i, formula] of formulas.entries()) {
    const io = publicInterface(b.net), compiled = await buildHmlConstraints(formula, b.net, io, {}, {}, algebra);
    const truth = compiled.conditions.every(c => ground(c) === true);
    expect(truth).toBe(i % 2 === 1);
    expect((await evaluateFormula(formula, b.net, io)).value).toBe(truth);
    expect(compiled.stats.cacheHits).toBe(0);
  }
});
