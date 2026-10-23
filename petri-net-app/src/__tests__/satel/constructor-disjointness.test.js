/** @jest-environment node */
import { constructorPatternsDisjoint } from '../../satel/core/ConstructorDisjointness';
import { deriveGenericSubdomains, prepareAlgebra } from '../../satel/core/GenericSubuniformity';
import { createSymbolicSolver } from '../../satel/core/SymbolicZ3';
import { compileSymbolicIntention, parseSymbolicSource } from '../../satel/core/SymbolicSource';
import { recursiveDecomposition } from '../../satel/examples/recursive-adt/models';

jest.setTimeout(30000);
const c = (ctor, ...args) => ({ ctor, args });
const algebra = prepareAlgebra(parseSymbolicSource(`constructor End(): T
constructor Leaf(Int): T
constructor Fork(T, T): T
operation identity(T): T
rule identity.def(x: T): identity(x) = x`));
const clash = (a, b) => constructorPatternsDisjoint([a], [b], algebra);

test('only aligned free-constructor clashes establish disjointness', () => {
  expect(clash(c('End'), c('Leaf', 1))).toBe(true);
  expect(clash(c('Fork', c('End'), { var: 'x' }), c('Fork', c('Leaf', 1), { var: 'y' }))).toBe(true);
  expect(clash({ var: 'x' }, c('End'))).toBe(false);
  expect(clash(c('Leaf', 1), c('Leaf', 2))).toBe(false); // Primitive reasoning remains in SMT.
  expect(clash({ call: 'identity', args: [c('End')] }, c('Leaf', 1))).toBe(false);
  expect(clash({ op: '+', left: c('End'), right: 0 }, c('Leaf', 1))).toBe(false);
  expect(clash(c('unknown'), c('End'))).toBe(false);
  expect(clash(c('Leaf'), c('End'))).toBe(false);
  expect(clash(c('_ListNil'), c('End'))).toBe(false); // Different sorts, not a supported proof.
  expect(clash(c('Fork', { var: 'x' }, { var: 'x' }), c('Fork', c('End'), c('Leaf', 1)))).toBe(false);
  expect(constructorPatternsDisjoint([c('End')], [], algebra)).toBe(false);
});

test('every bypass in a finite symbolic constructor corpus is UNSAT in the original solver', async () => {
  const solve = await createSymbolicSolver(algebra);
  const left = [c('End'), c('Leaf', { var: 'n' }), c('Fork', c('End'), { var: 'x' }), c('Fork', { var: 'x' }, c('Leaf', 0)), { var: 'x' }];
  const right = [c('End'), c('Leaf', { var: 'm' }), c('Fork', c('Leaf', 1), { var: 'y' }), c('Fork', { var: 'y' }, c('End')), { var: 'y' }];
  let proved = 0;
  for (const a of left) for (const b of right) if (clash(a, b)) {
    const r = await solve({ terms: [[a], [b]], conditions: [{ op: '==', left: a, right: b }], variables: { n: 'Int', m: 'Int', x: 'T', y: 'T' }, witness: false });
    expect(r.status).toBe('unsat'); proved++;
  }
  expect(proved).toBeGreaterThan(5);
});

const logical = r => ({ domains: r.domains, unresolved: r.unresolved, infeasible: r.infeasible, overlaps: r.overlaps, disjoint: r.disjoint, coverage: r.coverage });
test.each(['membership', 'lookup', 'repeated'])('enabled/disabled checks preserve %s classes, witnesses and frontier', async kind => {
  const goal = recursiveDecomposition({ kind, depth: kind === 'repeated' ? 8 : 3 });
  // Replay the same solver answers to compare reports without model-choice noise.
  const backend = await createSymbolicSolver(goal.algebra);
  const baseline = await deriveGenericSubdomains(goal, { solve: backend, profileUnfolding: true, branchDisjointness: false, constructorDisjointness: false });
  const optimized = await deriveGenericSubdomains(goal, { solve: backend, profileUnfolding: true, branchDisjointness: false });
  expect(logical(optimized)).toEqual(logical(baseline));
  const p = optimized.unfoldingProfile;
  expect(p.constructorDisjointPairs).toBeGreaterThan(0);
  expect(p.overlapQueries + p.constructorDisjointPairs).toBe(p.overlapPairs);
});

test('overlapping equations and arithmetic patterns still require the solver', async () => {
  const goal = compileSymbolicIntention({ id: 'overlap', name: 'overlap', symbolic: {
    source: `operation f(Int): Bool
rule one(n: Int): f(n) = true if n >= 0
rule two(n: Int): f(n) = false if n >= 1`, operation: 'f', variablesText: 'x: Int', argsText: 'x + 1', maxDepth: 2
  } }).goal;
  const r = await deriveGenericSubdomains(goal, { profileUnfolding: true, branchDisjointness: false });
  expect(r.overlaps).toHaveLength(1);
  expect(r.overlaps[0].status).toBe('overlap');
  expect(r.unfoldingProfile.constructorDisjointPairs).toBe(0);
  expect(r.unfoldingProfile.overlapQueries).toBe(1);
  const backend = await createSymbolicSolver(goal.algebra);
  const unknown = await deriveGenericSubdomains(goal, { profileUnfolding: true, branchDisjointness: false,
    solve: query => Array.isArray(query.terms[1]) ? { status: 'unknown', reason: 'overlap control' } : backend(query)
  });
  expect(unknown.overlaps[0]).toMatchObject({ status: 'unknown', reason: 'overlap control' });
  expect(unknown.disjoint).toBe(false);
});
