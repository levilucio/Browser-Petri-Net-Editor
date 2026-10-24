/** @jest-environment node */
import { createSolverProfile } from '../../satel/core/SolverProfile';
import { createSymbolicSolver } from '../../satel/core/SymbolicZ3';
import { prepareAlgebra, deriveGenericSubdomains } from '../../satel/core/GenericSubuniformity';
import { parseSymbolicSource } from '../../satel/core/SymbolicSource';
import { recursiveDecomposition } from '../../satel/examples/recursive-adt/models';
import { valueToSymbolic } from '../../utils/builtin-values';
import { evaluateGround, substitute } from '../../satel/core/SymbolicTerms';
jest.setTimeout(60000);
const v = name => ({ var: name }), eq = (left, right) => ({ op: '==', left, right });
const sum = map => Object.values(map).reduce((a, b) => a + b, 0);
const algebra = prepareAlgebra(parseSymbolicSource(''));
const checkAccounting = (solve) => {
  const p = solve.solverProfile;
  expect(p.backendQueries).toBe(solve.cacheStats.backendCalls);
  expect(sum(p.phases)).toBeCloseTo(p.backendMs, 5);
  expect(p.byMode.witness.queries + p.byMode.check.queries).toBe(p.backendQueries);
  expect(p.byMode.witness.ms + p.byMode.check.ms).toBeCloseTo(p.backendMs, 5);
  for (const group of Object.values(p.byMode)) {
    expect(sum(group.phases)).toBeCloseTo(group.ms, 5);
    expect(sum(group.outcomes)).toBe(group.queries);
  }
  for (const ms of Object.values(p.phases)) expect(ms).toBeGreaterThanOrEqual(0);
};

test('independent phase clocks account overlapping requests and return detached snapshots', () => {
  let clock = 0;
  const p = createSolverProfile(() => clock), a = p.start(true);
  clock = 2; const b = p.start(false);
  clock = 3; a.phase('check');
  clock = 5; b.phase('parse');
  clock = 7; a.finish('sat');
  clock = 11; b.finish('unknown');
  const s = p.snapshot();
  expect(s.backendMs).toBe(16); // Summed request durations, not shared wall time.
  expect(s.phases).toMatchObject({ create: 6, check: 4, parse: 6 });
  expect(s.byMode.witness).toMatchObject({ queries: 1, ms: 7, outcomes: { sat: 1 } });
  expect(s.byMode.check).toMatchObject({ queries: 1, ms: 9, outcomes: { unknown: 1 } });
  s.byMode.witness.phases.check = -1;
  expect(p.snapshot().byMode.witness.phases.check).toBe(4);
  clock = 20; a.finish('sat');
  expect(p.snapshot().backendMs).toBe(16);
});

test.each(['Nat', 'Int', 'Bool', 'String', 'Pair', 'List'])('%s: profiling preserves SAT witnesses, UNSAT and cache behavior', async sort => {
  const values = { Nat: 2, Int: -2, Bool: true, String: '\ud800😀', Pair: { __pair__: true, fst: 1, snd: false }, List: [1, 'x', true] };
  const value = valueToSymbolic(values[sort]);
  const q = { terms: [v('x')], conditions: [eq(v('x'), value)], variables: { x: sort } };
  const plain = await createSymbolicSolver(algebra), measured = await createSymbolicSolver(algebra, { profileSolver: true });
  for (const solve of [plain, measured]) {
    for (let i = 0; i < 2; i++) {
      const r = await solve(q);
      expect(r.status).toBe('sat');
      expect(evaluateGround(substitute(q.conditions[0], r.bindings))).toBe(true);
    }
    expect((await solve({ ...q, witness: false, conditions: [...q.conditions, false] })).status).toBe('unsat');
  }
  expect(plain.solverProfile).toBeUndefined();
  expect(measured.cacheStats.backendCalls).toBe(plain.cacheStats.backendCalls);
  expect(measured.solverProfile).toMatchObject({ backendQueries: 2, cacheWitnessChecks: 1, mainChecks: { sat: 1, unsat: 1 } });
  expect(measured.solverProfile.phases.decode).toBeGreaterThan(0);
  expect(measured.solverProfile.phases.validate).toBeGreaterThan(0);
  expect(measured.solverProfile.cacheValidationMs).toBeGreaterThanOrEqual(0);
  checkAccounting(measured);
});

test('preferred-value checks are measured separately and preserve the original witness on UNSAT', async () => {
  const solve = await createSymbolicSolver(algebra, { profileSolver: true, solverQueryCache: false, numericPreferenceRefutation: false });
  for (const n of [1, 2]) {
    const r = await solve({ terms: [v('n')], conditions: [eq(v('n'), n)], variables: { n: 'Int' } });
    expect(r.bindings.get('n')).toBe(n);
  }
  expect(solve.solverProfile).toMatchObject({ mainChecks: { sat: 2 }, preferenceChecks: { sat: 1, unsat: 1 } });
  expect(solve.solverProfile.phases.preferenceCheck).toBeGreaterThan(0);
  checkAccounting(solve);
});

test('encoding failures remain unknown and are retried without leaking profiling state', async () => {
  const solve = await createSymbolicSolver(algebra, { profileSolver: true });
  const q = { terms: [], conditions: [{ call: 'missing', args: [] }], variables: {}, witness: false };
  for (let i = 0; i < 2; i++) expect((await solve(q)).status).toBe('unknown');
  expect(solve.solverProfile.byMode.check.outcomes).toEqual({ unknown: 2 });
  expect(solve.solverProfile.mainChecks).toEqual({});
  expect(solve.solverProfile.phases.cleanup).toBeGreaterThan(0);
  checkAccounting(solve);
});

test('a rejected witness remains unknown and cache-hit cancellation remains effective', async () => {
  const solve = await createSymbolicSolver(algebra, { profileSolver: true });
  const huge = { terms: [v('n')], conditions: [eq(v('n'), { op: '*', left: 2147483647, right: 2147483647 })], variables: { n: 'Int' } };
  expect((await solve(huge)).status).toBe('unknown');
  expect(solve.solverProfile).toMatchObject({ mainChecks: { sat: 1 }, byMode: { witness: { outcomes: { unknown: 1 } } } });
  checkAccounting(solve);
  const controller = new AbortController();
  const cancellable = await createSymbolicSolver(algebra, { profileSolver: true, signal: controller.signal });
  const q = { terms: [], conditions: [true], variables: {}, witness: false };
  await cancellable(q); controller.abort();
  await expect(cancellable(q)).rejects.toMatchObject({ code: 'cancelled' });
  expect(cancellable.solverProfile.backendQueries).toBe(1);
  checkAccounting(cancellable);
});

test('recursive enumeration has the same classes, frontiers, overlaps and backend call counts', async () => {
  const goal = recursiveDecomposition({ kind: 'lookup', depth: 3 }), runs = [];
  for (const profileSolver of [false, true]) {
    const solve = await createSymbolicSolver(goal.algebra, { profileSolver });
    const r = await deriveGenericSubdomains(goal, { solve, maxTimeMs: 30000 });
    runs.push({ logical: { domains: r.domains.map(d => ({ patterns: d.patterns, conditions: d.conditions, result: d.resultPattern, rules: d.rules })), unresolved: r.unresolved, overlaps: r.overlaps, infeasible: r.infeasible }, calls: solve.cacheStats.backendCalls });
    if (profileSolver) checkAccounting(solve);
  }
  expect(runs[1]).toEqual(runs[0]);
});
