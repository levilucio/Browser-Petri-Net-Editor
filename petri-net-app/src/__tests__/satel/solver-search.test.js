/** @jest-environment node */
import { getContext } from '../../utils/z3/context.js';
import { createSymbolicSolver } from '../../satel/core/SymbolicZ3.js';
import { createConstraintSearch, findConstraintWitness, deriveGenericSubdomains } from '../../satel/core/GenericSubuniformity.js';
import { parseSymbolicSource, parseTerms } from '../../satel/core/SymbolicSource.js';
import { evaluateGround, substitute } from '../../satel/core/SymbolicTerms.js';

jest.setTimeout(60000);
const v = name => ({ var: name });
const op = (name, left, right) => ({ op: name, left, right });
const algebra = parseSymbolicSource('');
const numeric = conditions => ({ terms: [v('n')], variables: { n: 'Int' }, conditions });

test.each(['unsat', 'unknown', 'error'])('a failed optional preference (%s) retains the first validated witness without a third check', async outcome => {
  const { ctx } = await getContext(), solve = await createSymbolicSolver(algebra);
  const check = ctx.Solver.prototype.check;
  const spy = jest.spyOn(ctx.Solver.prototype, 'check')
    .mockImplementationOnce(function (...args) { return check.apply(this, args); })
    .mockImplementationOnce(async () => {
      if (outcome === 'error') throw new Error('Optional solver failure');
      return outcome;
    });
  try {
    const request = numeric([op('>=', v('n'), 3)]), result = await solve(request);
    expect(result.status).toBe('sat');
    expect(result.bindings.get('n')).toBeGreaterThanOrEqual(3);
    expect(request.conditions.every(c => evaluateGround(substitute(c, result.bindings)))).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  } finally { spy.mockRestore(); }
});

test('a satisfiable preference still chooses one; a contradictory preference returns the original model', async () => {
  const solve = await createSymbolicSolver(algebra);
  expect((await solve(numeric([op('>=', v('n'), 0)]))).bindings.get('n')).toBe(1);
  expect((await solve(numeric([op('==', v('n'), 7)]))).bindings.get('n')).toBe(7);
});

test('unknown before any witness stays unknown', async () => {
  const { ctx } = await getContext(), solve = await createSymbolicSolver(algebra);
  const spy = jest.spyOn(ctx.Solver.prototype, 'check').mockResolvedValueOnce('unknown');
  try {
    expect((await solve(numeric([]))).status).toBe('unknown');
    expect(spy).toHaveBeenCalledTimes(1);
  } finally { spy.mockRestore(); }
});

test('cancellation during the optional check is not hidden by witness fallback', async () => {
  const controller = new AbortController();
  const { ctx } = await getContext(), solve = await createSymbolicSolver(algebra, { signal: controller.signal });
  const check = ctx.Solver.prototype.check;
  const spy = jest.spyOn(ctx.Solver.prototype, 'check')
    .mockImplementationOnce(function (...args) { return check.apply(this, args); })
    .mockImplementationOnce(async () => { controller.abort(); return 'unknown'; });
  try { await expect(solve(numeric([]))).rejects.toMatchObject({ code: 'cancelled' }); }
  finally { spy.mockRestore(); }
});

test.each([
  ['Pair', '(n, true)', '(3, true)', '(4, true)'],
  ['List', '[n, "ok"]', '[3, "ok"]', '[3, "bad"]'],
])('prefix pruning elaborates nested %s values and shared variables before SMT', async (sort, symbolic, matching, other) => {
  const variables = { p: sort, n: 'Int' }, term = s => parseTerms(s, algebra, variables)[0];
  const search = await createConstraintSearch(algebra);
  const conditions = [op('==', v('p'), term(symbolic)), op('==', v('n'), 3)];
  expect((await search.prefix([...conditions, op('==', v('p'), term(matching))], variables)).status).toBe('sat');
  expect((await search.prefix([...conditions, op('==', v('p'), term(other))], variables)).status).toBe('unsat');
});

test('prefix checks keep residual constraints out of SMT without claiming a complete witness', async () => {
  const search = await createConstraintSearch(algebra);
  const partial = op('==', { call: '_asInt', args: [v('x')] }, 3);
  expect((await search.prefix([partial], { x: 'Any' })).status).toBe('unknown');
  expect(await search.prefix([partial, false], { x: 'Any' })).toMatchObject({ status: 'unsat' });
});

test('independent Boolean formulas stay intact while a custom equation is unfolded', async () => {
  const a = parseSymbolicSource('operation identity(Int): Int\nrule id(n: Int): identity(n) = n');
  const variables = { n: 'Int' }, conditions = [op('==', { call: 'identity', args: [v('n')] }, 3)];
  for (let i = 0; i < 12; i++) {
    variables[`b${i}`] = 'Bool';
    conditions.push(op('or', v(`b${i}`), op('not', v(`b${i}`))));
  }
  const solve = jest.fn(await createSymbolicSolver(a));
  const result = await findConstraintWitness({ algebra: a, variables, conditions, maxDepth: 2 }, { solve, maxBranches: 4 });
  expect(result.status).toBe('sat');
  expect(solve.mock.calls.length).toBeLessThanOrEqual(3);
});

test.each([
  [op('or', true, op('==', { undefined: 'unvisited' }, true)), 'sat'],
  [op('implies', false, op('==', { undefined: 'unvisited' }, true)), 'sat'],
  [op('and', false, op('==', { undefined: 'unvisited' }, true)), 'unsat'],
  [op('or', false, op('==', { undefined: 'required' }, true)), 'unknown'],
  [op('and', true, op('==', { undefined: 'required' }, true)), 'unknown'],
])('short-circuit definedness is preserved for %j', async (condition, expected) => {
  const result = await findConstraintWitness({ algebra, variables: {}, conditions: [condition], maxDepth: 2 });
  expect(result.status).toBe(expected);
});

test('a completed scalar conjunction needs one witness query without Boolean branch expansion', async () => {
  const conditions = Array.from({ length: 24 }, (_, i) => op('>=', v('n'), i));
  const conjunction = conditions.reduce((a, b) => op('and', a, b));
  const solve = jest.fn(await createSymbolicSolver(algebra));
  const result = await findConstraintWitness({ algebra, variables: { n: 'Int' }, conditions: [conjunction, op('<=', v('n'), 23)] }, { solve, maxBranches: 1 });
  expect(result.status).toBe('sat');
  expect(result.witness.witnessBindings.n).toBe(23);
  expect(solve).toHaveBeenCalledTimes(1);
});

test('class enumeration still separates both Boolean outcomes with preservation enabled', async () => {
  const a = parseSymbolicSource('operation either(Bool, Bool): Bool\nrule either.rule(a: Bool, b: Bool): either(a, b) = a or b');
  const result = await deriveGenericSubdomains({ algebra: a, operation: 'either', variables: { a: 'Bool', b: 'Bool' }, args: [v('a'), v('b')], maxDepth: 2 }, { preserveBooleanStructure: true });
  expect(new Set(result.domains.map(d => d.witnessResult))).toEqual(new Set([true, false]));
  expect(result.unresolved).toEqual([]);
  expect(result.overlaps).toEqual([]);
});
