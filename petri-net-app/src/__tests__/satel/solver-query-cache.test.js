/** @jest-environment node */
import { withSolverQueryCache } from '../../satel/core/SolverQueryCache.js';
import { createSymbolicSolver } from '../../satel/core/SymbolicZ3.js';
import { prepareAlgebra } from '../../satel/core/GenericSubuniformity.js';
import { parseSymbolicSource } from '../../satel/core/SymbolicSource.js';
import { evaluateGround, substitute } from '../../satel/core/SymbolicTerms.js';
import { valueToSymbolic } from '../../utils/builtin-values.js';
import { packTermGraph } from '../../domain/algebra/TermGraph.js';
import { getContext } from '../../utils/z3/context.js';
import { generateIntention } from '../../satel/core/IntentionPipeline.js';
import { evaluateOracleSuite } from '../../satel/core/ValidatedSubuniformity.js';
import { inventory, inventoryMutants } from '../../satel/examples/inventory/models.js';

jest.setTimeout(60000);
const algebra = prepareAlgebra(parseSymbolicSource(''));
const v = n => ({ var: n }), op = (op, left, right) => ({ op, left, right });
const query = (n = 1) => ({ terms: [v('n')], conditions: [op('==', v('n'), n)], variables: { n: 'Int' } });

test('exact queries reuse validated answers and callers cannot mutate stored bindings or statistics', async () => {
  const solve = await createSymbolicSolver(algebra), q = query(3);
  const first = await solve(q); first.bindings.set('n', 99);
  const second = await solve(q);
  expect(second.bindings.get('n')).toBe(3);
  expect(solve.cacheStats).toMatchObject({ requests: 2, backendCalls: 1, hits: 1, entries: 1 });
  solve.cacheStats.hits = 100;
  expect(solve.cacheStats.hits).toBe(1);
  q.conditions[0].right = 4;
  expect((await solve(q)).bindings.get('n')).toBe(4);
  expect(solve.cacheStats.backendCalls).toBe(2);
});

test('witness mode, variables, sorts, conditions and terms are all part of the key', async () => {
  const backend = jest.fn(async () => ({ status: 'unsat' }));
  const solve = withSolverQueryCache(backend, () => {});
  const variants = [query(), { ...query(), witness: false }, { ...query(), variables: { n: 'Nat' } },
    query(2), { ...query(), terms: [] }, { ...query(), variables: { n: 'Int', unused: 'Bool' } },
    { terms: [v('m')], conditions: [op('==', v('m'), 1)], variables: { m: 'Int' } }];
  for (const q of variants) { await solve(q); await solve(q); }
  expect(backend).toHaveBeenCalledTimes(variants.length);
  expect(solve.cacheStats.hits).toBe(variants.length);
});

test.each(['Int', 'Nat', 'Bool', 'String', 'Pair', 'List'])('%s: cached/uncached SAT and UNSAT agree over finite assignments', async sort => {
  const domains = { Int: [-1, 0, 1, 2147483647], Nat: [0, 1, 3], Bool: [false, true], String: ['', 'a', '\ud800', '😀'],
    Pair: [{ __pair__: true, fst: 1, snd: true }, { __pair__: true, fst: 'x', snd: [1] }], List: [[], [1], [true, 'x']] };
  const cached = await createSymbolicSolver(algebra), plain = await createSymbolicSolver(algebra, { solverQueryCache: false });
  const values = domains[sort];
  for (const a of values) for (const b of values) {
    const q = { terms: [v('x')], variables: { x: sort }, conditions: [op('==', v('x'), valueToSymbolic(a)), op('==', v('x'), valueToSymbolic(b))] };
    const expected = JSON.stringify(a) === JSON.stringify(b) ? 'sat' : 'unsat';
    for (const result of [await plain(q), await cached(q), await cached(q)]) {
      expect(result.status).toBe(expected);
      if (expected === 'sat') expect(q.conditions.every(c => evaluateGround(substitute(c, result.bindings)) === true)).toBe(true);
    }
  }
  expect(cached.cacheStats.hits).toBe(values.length ** 2);
  expect(plain.cacheStats.hits).toBe(0);
});

test('term graphs preserve scope and a hit rechecks the original constraint graph', async () => {
  const solve = await createSymbolicSolver(algebra), common = op('>=', v('n'), 3);
  const q = { ...query(), conditions: [packTermGraph(op('and', common, common))] };
  expect((await solve(q)).status).toBe('sat');
  const hit = await solve(q);
  expect(hit.bindings.get('n')).toBeGreaterThanOrEqual(3);
  expect(evaluateGround(substitute(q.conditions[0], hit.bindings))).toBe(true);
  expect(solve.cacheStats.hits).toBe(1);
  expect((await solve({ ...q, conditions: [{ graphRef: 0 }] })).status).toBe('unknown');
});

test('each cache hit invokes validation; a failed check evicts and recomputes', async () => {
  const backend = jest.fn(async () => ({ status: 'sat', bindings: new Map([['n', 1]]) }));
  const validate = jest.fn().mockImplementationOnce(() => { throw new Error('Invalid cached witness'); });
  const solve = withSolverQueryCache(backend, validate);
  await solve(query()); await solve(query()); await solve(query());
  expect(validate).toHaveBeenCalledTimes(2);
  expect(backend).toHaveBeenCalledTimes(2);
  expect(solve.cacheStats).toMatchObject({ validationFailures: 1, hits: 1 });
});

test('unknown and backend errors are retried; cancellation cannot return even a completed hit', async () => {
  const backend = jest.fn().mockResolvedValueOnce({ status: 'unknown', reason: 'timeout' })
    .mockRejectedValueOnce(new Error('backend failed')).mockResolvedValue({ status: 'unsat' });
  const controller = new AbortController(), solve = withSolverQueryCache(backend, () => {}, { signal: controller.signal });
  expect((await solve(query())).status).toBe('unknown');
  await expect(solve(query())).rejects.toThrow('backend failed');
  expect((await solve(query())).status).toBe('unsat');
  expect(solve.cacheStats).toMatchObject({ backendCalls: 3, hits: 0, entries: 1 });
  controller.abort();
  await expect(solve(query())).rejects.toMatchObject({ code: 'cancelled' });
  expect(solve.cacheStats.hits).toBe(0);
});

test('cancellation after witness-free SMT success is checked before publishing', async () => {
  const controller = new AbortController(), { ctx } = await getContext();
  const solve = await createSymbolicSolver(algebra, { signal: controller.signal });
  const spy = jest.spyOn(ctx.Solver.prototype, 'check').mockImplementationOnce(async () => { controller.abort(); return 'sat'; });
  try {
    await expect(solve({ ...query(), witness: false })).rejects.toMatchObject({ code: 'cancelled' });
    expect(solve.cacheStats.entries).toBe(0);
  } finally { spy.mockRestore(); }
});

test('LRU entry/character bounds evict safely; oversized and lossy keys bypass', async () => {
  const backend = jest.fn(async () => ({ status: 'unsat' }));
  const solve = withSolverQueryCache(backend, () => {}, { solverQueryCache: { maxEntries: 2, maxCharacters: 1000 } });
  await solve(query(1)); await solve(query(2)); await solve(query(1)); await solve(query(3)); await solve(query(2));
  expect(solve.cacheStats).toMatchObject({ hits: 1, backendCalls: 4, evictions: 2, entries: 2 });
  const bounded = withSolverQueryCache(backend, () => {}, { solverQueryCache: { maxCharacters: 250 } });
  for (let n = 0; n < 10; n++) await bounded(query(n));
  expect(bounded.cacheStats.evictions).toBeGreaterThan(0);
  expect(bounded.cacheStats.peakRetainedCharacters).toBeLessThanOrEqual(250);
  for (const terms of [['x'.repeat(2000)], [NaN], [undefined], [-0], [new Date()], [{ toJSON: () => 1 }]]) {
    const before = bounded.cacheStats.backendCalls;
    await bounded({ ...query(), terms }); await bounded({ ...query(), terms });
    expect(bounded.cacheStats.backendCalls).toBe(before + 2);
  }
  expect(() => withSolverQueryCache(backend, () => {}, { solverQueryCache: { maxEntries: 0 } })).toThrow();
});

test('concurrent identical requests do not cache promises or double-account retained entries', async () => {
  const pending = [], backend = jest.fn(() => new Promise(resolve => pending.push(resolve)));
  const solve = withSolverQueryCache(backend, () => {});
  const a = solve(query()), b = solve(query());
  expect(backend).toHaveBeenCalledTimes(2);
  pending[0]({ status: 'unsat' }); await a;
  const size = solve.cacheStats.retainedCharacters;
  pending[1]({ status: 'unsat' }); await b;
  expect(solve.cacheStats).toMatchObject({ entries: 1, retainedCharacters: size });
  await solve(query()); expect(solve.cacheStats.hits).toBe(1);
});

test('adapter context snapshots prevent caller algebra/options mutation and cross-instance reuse', async () => {
  const source = parseSymbolicSource('constructor Zero(): Count\nconstructor Next(Count): Count');
  const options = { solverQueryCache: { maxEntries: 2 } }, solve = await createSymbolicSolver(source, options);
  const q = { terms: [v('x')], variables: { x: 'Count' }, conditions: [op('==', v('x'), { ctor: 'Zero', args: [] })] };
  expect((await solve(q)).status).toBe('sat');
  delete source.constructors.Zero; options.solverQueryCache.maxEntries = 0;
  expect((await solve(q)).bindings.get('x')).toEqual({ ctor: 'Zero', args: [] });
  expect(solve.cacheStats.hits).toBe(1);
  const other = await createSymbolicSolver(source);
  expect((await other(q)).status).toBe('unknown');
  expect(other.cacheStats.hits).toBe(0);
});

test('reference suites from either cache mode detect the same inventory mutants', async () => {
  const config = { cycles: 2, rounds: 2, audit: true }, net = inventory(config);
  for (const solverQueryCache of [false, true, { maxEntries: 1, maxCharacters: 1000 }]) {
    const { suite } = await generateIntention(net.testIntentions[0], net, { solverQueryCache });
    expect(suite.validation).toEqual({ generated: 2, referencePassed: 2 });
    expect((await evaluateOracleSuite(suite.selectedTests, net, suite.interface)).counts).toEqual({ pass: 2, fail: 0, error: 0 });
    for (const mutant of inventoryMutants) {
      expect((await evaluateOracleSuite(suite.selectedTests, inventory({ ...config, mutant }), suite.interface)).counts).toEqual({ pass: 0, fail: 2, error: 0 });
    }
  }
});
