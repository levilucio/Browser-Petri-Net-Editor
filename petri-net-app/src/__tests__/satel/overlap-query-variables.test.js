/** @jest-environment node */
import { deriveGenericSubdomains } from '../../satel/core/GenericSubuniformity';
import { createSymbolicSolver } from '../../satel/core/SymbolicZ3';
import { variablesIn } from '../../satel/core/SymbolicTerms';
import { compileSymbolicIntention } from '../../satel/core/SymbolicSource';
import { recursiveDecomposition } from '../../satel/examples/recursive-adt/models';
jest.setTimeout(30000);

async function compare(goal) {
  const runs = [];
  for (const enabled of [false, true]) {
    const backend = await createSymbolicSolver(goal.algebra), queries = [];
    const result = await deriveGenericSubdomains(goal, {
      overlapQueryVariables: enabled, profileUnfolding: true,
      solve: query => { queries.push(JSON.parse(JSON.stringify(query))); return backend(query); }
    });
    const overlaps = queries.filter(q => Array.isArray(q.terms[1]));
    const sizes = overlaps.map(q => Object.keys(q.variables).length);
    expect(result.unfoldingProfile.maxOverlapVariables).toBe(Math.max(0, ...sizes));
    expect(result.unfoldingProfile.overlapVariableEntries).toBe(sizes.reduce((a, b) => a + b, 0));
    runs.push({ result, queries });
  }
  const [baseline, optimized] = runs;
  expect(optimized.queries).toHaveLength(baseline.queries.length);
  for (let i = 0; i < baseline.queries.length; i++) {
    const a = baseline.queries[i], b = optimized.queries[i];
    expect(b.terms).toEqual(a.terms); expect(b.conditions).toEqual(a.conditions); expect(b.witness).toBe(a.witness);
    for (const n of variablesIn([a.terms, a.conditions])) expect(b.variables[n]).toBe(a.variables[n]);
    if (Array.isArray(b.terms[1])) expect(Object.keys(b.variables).sort()).toEqual([...variablesIn([b.terms, b.conditions])].sort());
    else expect(b.variables).toEqual(a.variables); // Enumeration and witness queries unchanged.
  }
  const logical = r => ({
    domains: r.domains.map(d => ({ rules: d.rules, patterns: d.patterns, conditions: d.conditions, resultPattern: d.resultPattern })),
    unresolved: r.unresolved, overlaps: r.overlaps, infeasible: r.infeasible, disjoint: r.disjoint, coverage: r.coverage
  });
  expect(logical(optimized.result)).toEqual(logical(baseline.result));
  return runs;
}

test.each(['membership', 'lookup'])('query projection preserves %s terms, scopes, sorts and verdicts', async kind => {
  const [a, b] = await compare(recursiveDecomposition({ kind, depth: 3 }));
  expect(b.result.unfoldingProfile.maxOverlapVariables).toBeLessThan(a.result.unfoldingProfile.maxOverlapVariables);
});

test('all basic sort declarations and shared argument variables survive overlapping equations', async () => {
  const goal = compileSymbolicIntention({ id: 'sorts', name: 'sorts', symbolic: {
    source: `operation f(Nat, Int, Bool, String, Pair, List): Bool
rule first(a: Nat, b: Int, c: Bool, d: String, e: Pair, xs: List): f(a, b, c, d, e, xs) = true if a >= 0
rule second(a: Nat, b: Int, c: Bool, d: String, e: Pair, xs: List): f(a, b, c, d, e, xs) = false if b >= 0`,
    operation: 'f', variablesText: 'n: Nat, b: Int, c: Bool, s: String, p: Pair, xs: List', argsText: 'n, b, c, s, p, xs', maxDepth: 2
  } }).goal;
  const [, b] = await compare(goal);
  expect(b.result.overlaps[0].status).toBe('overlap');
});

test('unknown overlap checks and time-budget exhaustion stay unknown', async () => {
  const goal = recursiveDecomposition({ kind: 'membership', depth: 2 });
  const backend = await createSymbolicSolver(goal.algebra);
  for (const enabled of [false, true]) {
    const r = await deriveGenericSubdomains(goal, { overlapQueryVariables: enabled,
      solve: q => Array.isArray(q.terms[1]) ? { status: 'unknown', reason: 'control' } : backend(q)
    });
    expect(r.overlaps.length).toBeGreaterThan(0);
    expect(r.overlaps.every(x => x.status === 'unknown')).toBe(true);
    expect(r.disjoint).toBe(false);
    const expired = await deriveGenericSubdomains(goal, { overlapQueryVariables: enabled, maxTimeMs: 0 });
    expect(expired.domains).toEqual([]);
    expect(expired.unresolved[0].reason).toContain('time budget');
  }
});

test('shared variables across arguments retain equality and disequality coupling', async () => {
  const goal = compileSymbolicIntention({ id: 'shared', name: 'shared', symbolic: {
    source: `operation f(Int, Int): Bool
rule equal(n: Int): f(n, n) = true
rule different(n: Int, m: Int): f(n, m) = false if n != m`,
    operation: 'f', variablesText: 'x: Int, y: Int', argsText: 'x, y', maxDepth: 2
  } }).goal;
  const [, r] = await compare(goal);
  expect(r.result.domains).toHaveLength(2);
  expect(r.result.overlaps).toEqual([]);
});
