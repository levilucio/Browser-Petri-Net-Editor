/** @jest-environment node */
import { createBranchDisjointness } from '../../satel/core/BranchDisjointness';
import { deriveGenericSubdomains, prepareAlgebra } from '../../satel/core/GenericSubuniformity';
import { createSymbolicSolver } from '../../satel/core/SymbolicZ3';
import { compileSymbolicIntention, parseSymbolicSource } from '../../satel/core/SymbolicSource';
import { recursiveDecomposition } from '../../satel/examples/recursive-adt/models';
jest.setTimeout(60000);
const v = name => ({ var: name });
const op = (name, left, right) => ({ op: name, left, right });
const logical = r => ({ domains: r.domains.map(d => ({ rules: d.rules, patterns: d.patterns, conditions: d.conditions, result: d.resultPattern })), overlaps: r.overlaps, unresolved: r.unresolved, infeasible: r.infeasible });

async function compare(goal) {
  const baseline = await deriveGenericSubdomains(goal, { branchDisjointness: false, maxTimeMs: 30000 });
  const optimized = await deriveGenericSubdomains(goal, { profileUnfolding: true, maxTimeMs: 30000 });
  expect(logical(optimized)).toEqual(logical(baseline));
  return optimized;
}

test.each(['membership', 'lookup'])('ancestor proofs preserve %s classes and unresolved frontier', async kind => {
  const r = await compare(recursiveDecomposition({ kind, depth: 3 }));
  expect(r.unfoldingProfile.branchDisjointPairs).toBeGreaterThan(0);
  expect(r.unfoldingProfile.branchProofStatuses.unsat).toBeGreaterThan(0);
  expect(r.unfoldingProfile.branchProofCacheHits).toBeGreaterThan(0);
  expect(r.unfoldingProfile.overlapPairs).toBe(r.unfoldingProfile.overlapQueries + r.unfoldingProfile.constructorDisjointPairs + r.unfoldingProfile.branchDisjointPairs);
});

// Two surviving descendants per child make this a reusable ancestor proof.
function fixture(solve, regions, options = {}) {
  const manager = createBranchDisjointness({ solve, deadline: Date.now() + 10000, ...options });
  const children = [{}, {}]; manager.split({}, children, (_, i) => regions[i]);
  const leaves = [{}, {}, {}, {}];
  leaves.forEach((leaf, i) => manager.record(leaf, children[i < 2 ? 0 : 1]));
  return { manager, leaves };
}
const region = (condition, patterns = [v('x')]) => ({ patterns, conditions: [condition], variables: { x: 'Int', h: 'Int' } });

test('same input bindings prove complementary guards once and reuse the certificate', async () => {
  const backend = await createSymbolicSolver(prepareAlgebra(parseSymbolicSource('')));
  let calls = 0;
  const { manager, leaves } = fixture(q => { calls++; return backend(q); }, [region(op('<', v('x'), 0)), region(op('>=', v('x'), 0))]);
  expect(await manager.disjoint(leaves[0], leaves[2])).toBe(true);
  expect(await manager.disjoint(leaves[1], leaves[3])).toBe(true);
  expect(calls).toBe(1);
});

test('existential branch-local variables are independent even when names are identical', async () => {
  const backend = await createSymbolicSolver(prepareAlgebra(parseSymbolicSource('')));
  const { manager, leaves } = fixture(backend, [region(op('<', v('h'), 0)), region(op('>=', v('h'), 0))]);
  // Both project onto all x: h is not fixed by the input pattern.
  expect(await manager.disjoint(leaves[0], leaves[2])).toBe(false);
});

test('overlapping compound guards and operation-result alternatives keep real overlaps', async () => {
  const goal = compileSymbolicIntention({ id: 'overlap', name: 'overlap', symbolic: {
    source: `operation choose(Int): Int
operation classify(Int): Bool
operation sign(Int): Bool
rule choose.a(n: Int): choose(n) = n
rule choose.b(n: Int): choose(n) = n + 1
rule classify.def(n: Int): classify(n) = sign(choose(n))
rule sign.a(n: Int): sign(n) = true if n >= 0 or n == -1
rule sign.b(n: Int): sign(n) = false if n <= 0`,
    operation: 'classify', argsText: 'x', variablesText: 'x: Int', maxDepth: 4
  } }).goal;
  const r = await compare(goal);
  expect(r.overlaps.some(x => x.status === 'overlap')).toBe(true);
});

test.each(['unknown', 'error', 'sat'])('%s proof attempts never bypass descendant checks', async status => {
  let calls = 0;
  const { manager, leaves } = fixture(async () => { calls++; if (status === 'error') throw new Error('control'); return { status }; }, [region(true), region(true)]);
  expect(await manager.disjoint(leaves[0], leaves[2])).toBe(false);
  expect(await manager.disjoint(leaves[1], leaves[3])).toBe(false);
  expect(calls).toBe(1); // Remember failed attempt, never a disjointness proof.
});

test('proof capacity, expired deadlines and cancellation preserve fallback/control flow', async () => {
  const noCall = jest.fn(async () => ({ status: 'unsat' }));
  for (const options of [{ maxProofs: 0 }, { deadline: 0 }]) {
    const { manager, leaves } = fixture(noCall, [region(true), region(true)], options);
    expect(await manager.disjoint(leaves[0], leaves[2])).toBe(false);
  }
  expect(noCall).not.toHaveBeenCalled();
  const controller = new AbortController();
  const { manager, leaves } = fixture(async () => { controller.abort(); return { status: 'unsat' }; }, [region(true), region(true)], { signal: controller.signal });
  await expect(manager.disjoint(leaves[0], leaves[2])).rejects.toMatchObject({ code: 'cancelled' });
});

test('zero proof allowance reproduces baseline reports', async () => {
  const goal = recursiveDecomposition({ kind: 'membership', depth: 3 });
  const a = await deriveGenericSubdomains(goal, { branchDisjointness: false });
  const b = await deriveGenericSubdomains(goal, { maxBranchProofs: 0, profileUnfolding: true });
  expect(logical(b)).toEqual(logical(a));
  expect(b.unfoldingProfile.branchProofQueries).toBe(0);
});

test('a full proof cache falls back without changing classes or overlap verdicts', async () => {
  const goal = recursiveDecomposition({ kind: 'lookup', depth: 3 });
  const a = await deriveGenericSubdomains(goal, { branchDisjointness: false });
  const b = await deriveGenericSubdomains(goal, { maxBranchProofs: 1, profileUnfolding: true });
  expect(logical(b)).toEqual(logical(a));
  expect(b.unfoldingProfile.branchProofQueries).toBe(1);
  expect(b.unfoldingProfile.overlapQueries).toBeGreaterThan(0);
});

test('non-injective input expressions do not identify independent hidden values', async () => {
  const backend = await createSymbolicSolver(prepareAlgebra(parseSymbolicSource('')));
  // Opposite h signs can yield the same squared input. Equating h would be unsound.
  const square = op('*', v('h'), v('h'));
  const { manager, leaves } = fixture(backend, [region(op('<', v('h'), 0), [square]), region(op('>', v('h'), 0), [square])]);
  expect(await manager.disjoint(leaves[0], leaves[2])).toBe(false);
});
