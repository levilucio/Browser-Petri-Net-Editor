/** @jest-environment node */
import { projectFeasibilityQuery } from '../../satel/core/FeasibilityQuery';
import { deriveGenericSubdomains, findConstraintWitness, createConstraintSearch, prepareAlgebra } from '../../satel/core/GenericSubuniformity';
import { createSymbolicSolver } from '../../satel/core/SymbolicZ3';
import { withSolverQueryCache } from '../../satel/core/SolverQueryCache';
import { parseSymbolicSource } from '../../satel/core/SymbolicSource';
import { recursiveDecomposition } from '../../satel/examples/recursive-adt/models';
import { variablesIn, evaluateGround, substitute } from '../../satel/core/SymbolicTerms';
import { packTermGraph } from '../../domain/algebra/TermGraph';
import { valueToSymbolic } from '../../utils/builtin-values';
jest.setTimeout(60000);
const v = name => ({ var: name }), op = (op, left, right) => ({ op, left, right });
const logical = r => ({ domains: r.domains.map(d => ({ rules: d.rules, patterns: d.patterns, conditions: d.conditions, result: d.resultPattern })), unresolved: r.unresolved, overlaps: r.overlaps, infeasible: r.infeasible, disjoint: r.disjoint, coverage: r.coverage });

async function compare(goal, solverQueryCache = true) {
  const runs = [];
  for (const enabled of [false, true]) {
    const solve = await createSymbolicSolver(goal.algebra, { solverQueryCache }), queries = [];
    const r = await deriveGenericSubdomains(goal, { feasibilityQueryProjection: enabled, profileUnfolding: true, maxTimeMs: 30000,
      solve: q => { queries.push(JSON.parse(JSON.stringify(q))); return solve(q); } });
    const feasibility = queries.filter(q => !Array.isArray(q.terms[1]));
    const counts = feasibility.map(q => Object.keys(q.variables).length);
    expect(r.unfoldingProfile.maxFeasibilityVariables).toBe(Math.max(0, ...counts));
    expect(r.unfoldingProfile.feasibilityVariableEntries).toBe(counts.reduce((a, b) => a + b, 0));
    const p = r.unfoldingProfile;
    expect(p.feasibilityWitnessQueries).toBe(feasibility.filter(q => q.witness).length);
    expect(p.feasibilityCheckQueries).toBe(feasibility.filter(q => !q.witness).length);
    expect(p.feasibilityMs).toBeCloseTo(p.feasibilityWitnessMs + p.feasibilityCheckMs, 5);
    runs.push({ r, queries, cache: solve.cacheStats });
  }
  const [a, b] = runs;
  expect(logical(b.r)).toEqual(logical(a.r));
  expect(b.queries).toHaveLength(a.queries.length);
  a.queries.forEach((original, i) => {
    const projected = b.queries[i];
    expect(projected.conditions).toEqual(original.conditions);
    expect(projected.witness).toBe(original.witness);
    if (Array.isArray(original.terms[1])) expect(projected).toEqual(original); // Overlap/proof queries untouched.
    else {
      expect(projected.terms).toEqual(original.witness ? original.terms : []);
      const used = variablesIn(original.witness ? [original.terms, original.conditions] : original.conditions);
      expect(Object.keys(projected.variables).sort()).toEqual([...used].sort());
      for (const n of used) expect(projected.variables[n]).toBe(original.variables[n]);
    }
  });
  return runs;
}

test.each(['membership', 'lookup', 'repeated'])('%s preserves classes, residuals and solver formulas', async kind => {
  const [a, b] = await compare(recursiveDecomposition({ kind, depth: kind === 'repeated' ? 8 : 3 }));
  expect(b.r.unfoldingProfile.maxFeasibilityVariables).toBeLessThan(a.r.unfoldingProfile.maxFeasibilityVariables);
  if (kind === 'repeated') {
    expect(b.cache.hits).toBeGreaterThan(a.cache.hits);
    expect(b.cache.backendCalls).toBeLessThan(a.cache.backendCalls);
  }
});

test('projection preserves results with the existing cache disabled', async () => {
  const [, b] = await compare(recursiveDecomposition({ kind: 'membership', depth: 3 }), false);
  expect(b.cache.hits).toBe(0);
});

test.each(['Nat', 'Int', 'Bool', 'String', 'Pair', 'List'])('%s retains witness-only variables and concrete sort constraints', async sort => {
  const values = { Nat: 2, Int: -2, Bool: true, String: '\ud800😀', Pair: { __pair__: true, fst: -1, snd: true }, List: [1, false, 'x'] };
  const algebra = prepareAlgebra(parseSymbolicSource(''));
  const solve = await createSymbolicSolver(algebra);
  const value = valueToSymbolic(values[sort]);
  const q = { terms: [v('output')], conditions: [op('==', v('x'), value)], variables: { x: sort, output: sort, unused: 'Bool' }, witness: true };
  const before = JSON.stringify(q), projected = projectFeasibilityQuery(q);
  expect(projected.variables).toEqual({ output: sort, x: sort });
  for (const request of [q, projected]) {
    const r = await solve(request);
    expect(r.status).toBe('sat');
    expect(r.bindings.has('output')).toBe(true);
    expect(evaluateGround(substitute(q.conditions[0], r.bindings))).toBe(true);
    const contradiction = { ...request, conditions: [...request.conditions, op('!=', v('x'), value)] };
    expect((await solve(projectFeasibilityQuery(contradiction))).status).toBe('unsat');
  }
  expect(JSON.stringify(q)).toBe(before);
});

test('Nat bounds, shared variables, condition order and graph references are preserved', async () => {
  const solve = await createSymbolicSolver(prepareAlgebra(parseSymbolicSource('')));
  for (const sort of ['Int', 'Nat']) {
    const q = { terms: [{ call: 'residual', args: [v('unused')] }], witness: false,
      conditions: [packTermGraph(op('and', op('<', v('n'), 0), op('==', v('n'), v('m'))))], variables: { n: sort, m: sort, unused: 'List' } };
    const p = projectFeasibilityQuery(q);
    expect(p.conditions).toBe(q.conditions);
    expect(p.variables).toEqual({ n: sort, m: sort });
    for (const request of [q, p]) expect((await solve(request)).status).toBe(sort === 'Nat' ? 'unsat' : 'sat');
  }
});

test('sequence prefix requests share answers only when retained conditions and sorts match', async () => {
  const algebra = prepareAlgebra(parseSymbolicSource(''));
  const solve = await createSymbolicSolver(algebra);
  const search = await createConstraintSearch(algebra, { solve });
  const conditions = [op('<', v('n'), 0)];
  expect((await search.prefix(conditions, { n: 'Int', unused: 'Bool' })).status).toBe('sat');
  expect((await search.prefix(conditions, { n: 'Int', unrelated: 'String' })).status).toBe('sat');
  expect(solve.cacheStats.hits).toBe(1);
  expect((await search.prefix(conditions, { n: 'Nat' })).status).toBe('unsat');
  expect(solve.cacheStats.backendCalls).toBe(2);
});

test('existential search still grounds variables needed only in the returned witness', async () => {
  const algebra = parseSymbolicSource('');
  for (const enabled of [false, true]) {
    const r = await findConstraintWitness({ algebra, variables: { n: 'Nat', xs: 'List' }, conditions: [op('==', v('n'), 3)] }, { feasibilityQueryProjection: enabled });
    expect(r.status).toBe('sat');
    expect(r.witness.witnessBindings.n).toBe(3);
    expect(r.witness.witnessBindings.xs).toBeDefined();
  }
});

test('identical projected unknowns are retried and cancellation prevents cache hits', async () => {
  const controller = new AbortController();
  const backend = jest.fn().mockResolvedValueOnce({ status: 'unknown', reason: 'control' }).mockResolvedValue({ status: 'unsat' });
  const solve = withSolverQueryCache(backend, () => {}, { signal: controller.signal });
  const q = projectFeasibilityQuery({ terms: [v('unused')], conditions: [false], variables: { unused: 'Int' }, witness: false });
  expect((await solve(q)).status).toBe('unknown');
  expect((await solve(q)).status).toBe('unsat');
  expect((await solve(q)).status).toBe('unsat');
  expect(backend).toHaveBeenCalledTimes(2);
  controller.abort();
  await expect(solve(q)).rejects.toMatchObject({ code: 'cancelled' });
});

test('time and branch budgets retain unknown/residual behavior', async () => {
  const goal = recursiveDecomposition({ kind: 'lookup', depth: 4 });
  for (const enabled of [false, true]) {
    const expired = await deriveGenericSubdomains(goal, { feasibilityQueryProjection: enabled, maxTimeMs: 0 });
    expect(expired.domains).toHaveLength(0);
    expect(expired.unresolved[0].reason).toContain('time budget');
    const limited = await deriveGenericSubdomains(goal, { feasibilityQueryProjection: enabled, maxBranches: 4 });
    expect(limited.unresolved.some(x => x.reason === 'Branch budget exhausted')).toBe(true);
  }
});
