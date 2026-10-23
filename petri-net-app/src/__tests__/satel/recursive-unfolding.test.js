/** @jest-environment node */
import { deriveGenericSubdomains } from '../../satel/core/GenericSubuniformity';
import { recursiveDecomposition } from '../../satel/examples/recursive-adt/models';
import { evaluateGround, substitute, unify } from '../../satel/core/SymbolicTerms';

jest.setTimeout(30000);
const list = xs => xs.reduceRight((tail, head) => ({ ctor: 'More', args: [head, tail] }), { ctor: 'End', args: [] });
const empty = { ctor: 'Empty', args: [] };
const node = (n, a = empty, b = empty) => ({ ctor: 'Node', args: [n, a, b] });
const applicable = (domain, args) => {
  const bindings = new Map();
  return domain.patterns.every((p, i) => unify(p, args[i], bindings)) &&
    domain.conditions.every(c => evaluateGround(substitute(c, bindings)) === true);
};
const checkInputs = (report, inputs, oracle) => {
  for (const args of inputs) {
    const matches = report.domains.filter(d => applicable(d, args));
    expect(matches).toHaveLength(1);
    expect(matches[0].resultPattern).toBe(oracle(...args));
  }
};

test('membership classes agree with finite independent membership and retain the infinite frontier', async () => {
  const goal = recursiveDecomposition({ kind: 'membership', depth: 3 });
  const before = JSON.stringify(goal);
  const report = await deriveGenericSubdomains(goal, { profileUnfolding: true });
  const arrays = [[], [0], [1], [0, 0], [0, 1], [1, 0], [1, 1]];
  checkInputs(report, arrays.flatMap(xs => [0, 1].map(k => [k, list(xs)])), (key, xs) => {
    const values = [];
    while (xs.ctor === 'More') { values.push(xs.args[0]); xs = xs.args[1]; }
    return values.includes(key);
  });
  expect(report.domains).toHaveLength(6);
  expect(report.unresolved).toHaveLength(1);
  expect(report.unresolved[0].resultPattern.call).toBe('member');
  expect(report.unfoldingProfile).toMatchObject({ visited: 10, equationAttempts: 9, equationMatches: 9, feasibilityQueries: 10, overlapQueries: 15 });
  expect(JSON.stringify(goal)).toBe(before);
});

test('conditional tree branches agree with concrete lookup on a finite tree corpus', async () => {
  const report = await deriveGenericSubdomains(recursiveDecomposition({ kind: 'lookup', depth: 3 }), { profileUnfolding: true });
  const trees = [empty, node(0), node(1), node(1, node(0), node(2)), node(0, empty, node(1))];
  const lookup = (key, tree) => tree.ctor === 'Empty' ? false : key === tree.args[0] ? true : lookup(key, tree.args[key < tree.args[0] ? 1 : 2]);
  checkInputs(report, trees.flatMap(t => [-1, 0, 1, 2, 3].map(k => [k, t])), lookup);
  expect(report.domains).toHaveLength(14);
  expect(report.unresolved).toHaveLength(8);
  expect(report.overlaps).toEqual([]);
  expect(report.coverage).toBe('not-proved');
});

test('profiling preserves domains, frontier and overlap verdicts; fixed spine resolves its frontier', async () => {
  const goal = recursiveDecomposition({ kind: 'membership', depth: 4, size: 3 });
  const plain = await deriveGenericSubdomains(goal);
  const profiled = await deriveGenericSubdomains(goal, { profileUnfolding: true });
  const logical = r => ({
    domains: r.domains.map(d => ({ rules: d.rules, patterns: d.patterns, conditions: d.conditions, result: d.resultPattern })),
    unresolved: r.unresolved, overlaps: r.overlaps, disjoint: r.disjoint, coverage: r.coverage
  });
  expect(logical(profiled)).toEqual(logical(plain));
  expect(plain.unfoldingProfile).toBeUndefined();
  expect(profiled.domains).toHaveLength(4);
  expect(profiled.frontierResolved).toBe(true);
  const p = profiled.unfoldingProfile;
  expect(p.searchMs).toBeGreaterThanOrEqual(p.feasibilityMs + p.overlapSolverMs);
  expect(p.nonSolverMs).toBeGreaterThanOrEqual(p.equationExpansionMs);
  expect(p.overlapPhaseMs).toBeGreaterThanOrEqual(p.overlapSolverMs);
});

test('time/branch exhaustion and solver unknown remain unresolved with profiling', async () => {
  const goal = recursiveDecomposition({ kind: 'lookup', depth: 5 });
  const expired = await deriveGenericSubdomains(goal, { maxTimeMs: 0, profileUnfolding: true });
  expect(expired.domains).toEqual([]);
  expect(expired.unresolved[0].reason).toContain('time budget');
  expect(expired.unfoldingProfile.feasibilityQueries).toBe(0);
  const limited = await deriveGenericSubdomains(goal, { maxBranches: 4, profileUnfolding: true });
  expect(limited.unresolved.some(x => x.reason === 'Branch budget exhausted')).toBe(true);
  const unknown = await deriveGenericSubdomains(goal, { profileUnfolding: true, solve: async () => ({ status: 'unknown', reason: 'control' }) });
  expect(unknown.infeasible).toEqual([]);
  expect(unknown.unresolved[0].reason).toBe('control');
  expect(unknown.unfoldingProfile).toMatchObject({ feasibilityQueries: 1, equationAttempts: 0, overlapQueries: 0 });
});

test('repeated operation witnesses satisfy twice the independently calculated list total', async () => {
  const report = await deriveGenericSubdomains(recursiveDecomposition({ kind: 'repeated', depth: 8 }), { profileUnfolding: true });
  expect(report.domains.length).toBeGreaterThan(1);
  expect(report.unresolved.length).toBeGreaterThan(0);
  for (const d of report.domains) {
    let xs = d.witnessArgs[0], sum = 0;
    while (xs.ctor === 'More') { sum += xs.args[0]; xs = xs.args[1]; }
    expect(d.witnessResult).toBe(2 * sum);
  }
});
