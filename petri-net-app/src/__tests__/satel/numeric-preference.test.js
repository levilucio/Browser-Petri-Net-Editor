/** @jest-environment node */
import { refutesNumericPreference } from '../../satel/core/NumericPreference';
import { createSymbolicSolver } from '../../satel/core/SymbolicZ3';
import { deriveGenericSubdomains, prepareAlgebra } from '../../satel/core/GenericSubuniformity';
import { parseSymbolicSource } from '../../satel/core/SymbolicSource';
import { evaluateGround, substitute } from '../../satel/core/SymbolicTerms';
import { packTermGraph } from '../../domain/algebra/TermGraph';
import { recursiveDecomposition } from '../../satel/examples/recursive-adt/models';
jest.setTimeout(60000);
const v = name => ({ var: name }), op = (op, left, right) => ({ op, left, right });
const algebra = prepareAlgebra(parseSymbolicSource(''));

async function run(conditions, variables = { n: 'Int', m: 'Int' }, options = {}) {
  const results = [];
  for (const enabled of [false, true]) {
    const solve = await createSymbolicSolver(algebra, { profileSolver: true, solverQueryCache: false, numericPreferenceRefutation: enabled, ...options });
    const q = { terms: Object.keys(variables).map(v), conditions, variables };
    const result = await solve(q);
    if (result.status === 'sat') expect(conditions.every(c => evaluateGround(substitute(c, result.bindings)) === true)).toBe(true);
    results.push({ result, profile: solve.solverProfile });
  }
  expect(results[1].result.status).toBe(results[0].result.status);
  expect(results[1].profile.mainChecks).toEqual(results[0].profile.mainChecks);
  return results;
}

test('a strict numeric guard refutes the preference without rejecting its valid witness', async () => {
  const [a, b] = await run([op('<', v('n'), v('m'))]);
  expect(b.result.status).toBe('sat');
  expect(a.profile.preferenceChecks).toEqual({ unsat: 1 });
  expect(b.profile.preferenceChecks).toEqual({});
  expect(b.profile.preferenceRefutations).toBe(1);
});

test('a feasible preference still runs Z3 and jointly selects numeric ones', async () => {
  const [a, b] = await run([op('<=', v('n'), v('m'))], { n: 'Nat', m: 'Int' });
  for (const r of [a, b]) {
    expect(r.result.bindings.get('n')).toBe(1);
    expect(r.result.bindings.get('m')).toBe(1);
    expect(r.profile.preferenceChecks).toEqual({ sat: 1 });
  }
  expect(b.profile.preferenceRefutations).toBe(0);
});

test('unfixed Boolean or string variables can make a numeric preference feasible', async () => {
  const cases = [
    { variables: { n: 'Int', b: 'Bool' }, condition: op('or', op('==', v('n'), 2), v('b')) },
    { variables: { n: 'Int', s: 'String' }, condition: op('or', op('==', v('n'), 2), op('==', v('s'), 'yes')) }
  ];
  for (const { variables, condition } of cases) {
    expect(refutesNumericPreference([condition], ['n'])).toBe(false);
    const [, b] = await run([condition], variables);
    expect(b.result.status).toBe('sat');
    expect(b.result.bindings.get('n')).toBe(1);
    expect(b.profile.preferenceChecks).toEqual({ sat: 1 });
    expect(b.profile.preferenceRefutations).toBe(0);
  }
});

test('an independent false conjunct suffices even when other conditions have unfixed variables', async () => {
  const [, b] = await run([op('==', v('n'), 2), op('==', v('s'), 'yes')], { n: 'Int', s: 'String' });
  expect(b.result.status).toBe('sat');
  expect(b.result.bindings.get('n')).toBe(2);
  expect(b.profile.preferenceRefutations).toBe(1);
});

test('every refutation in a compound arithmetic/Boolean corpus is independently UNSAT in Z3', async () => {
  const solve = await createSymbolicSolver(algebra, { numericPreferenceRefutation: false });
  const atoms = [op('<', v('n'), v('m')), op('==', v('n'), 2), op('==', v('n'), v('m')), op('>=', v('m'), 0)];
  const conditions = [...atoms, ...atoms.map(left => ({ op: 'not', left }))];
  for (const a of atoms) for (const b of atoms) for (const name of ['and', 'or', 'xor', 'implies', 'iff']) conditions.push(op(name, a, b));
  conditions.push(op('==', op('+', v('n'), op('*', v('m'), 2)), 4));
  conditions.push({ if: op('==', v('n'), 1), then: op('<', v('m'), 1), else: true });
  let proved = 0;
  for (const condition of conditions) {
    if (!refutesNumericPreference([condition], ['n', 'm'])) continue;
    proved++;
    const result = await solve({ terms: [], conditions: [condition, op('==', v('n'), 1), op('==', v('m'), 1)], variables: { n: 'Int', m: 'Int' }, witness: false });
    expect(result.status).toBe('unsat');
  }
  expect(proved).toBeGreaterThan(20);
});

test('shared term graphs retain their scopes and callers are not mutated', async () => {
  const guard = op('<', v('n'), v('m'));
  const graph = packTermGraph(op('and', guard, guard)), before = JSON.stringify(graph);
  expect(refutesNumericPreference([graph], ['n', 'm'])).toBe(true);
  const [, b] = await run([graph]);
  expect(b.profile.preferenceRefutations).toBe(1);
  expect(JSON.stringify(graph)).toBe(before);
  expect(refutesNumericPreference([{ termGraph: [{ graphRef: 1 }, false] }], ['n'])).toBe(false);
  expect(refutesNumericPreference([{ termGraph: [{ graphRef: 1 }] }], ['n'])).toBe(false);
});

test('overflow and unsupported terms are inconclusive and preserve the solver fallback', async () => {
  const huge = op('*', 2147483647, 2147483647);
  const condition = op('or', op('==', v('n'), 2), op('==', op('+', huge, v('n')), op('+', huge, 2)));
  expect(refutesNumericPreference([condition], ['n'])).toBe(false);
  const [, b] = await run([condition], { n: 'Int' });
  expect(b.result.status).toBe('sat');
  expect(b.result.bindings.get('n')).toBe(2);
  expect(b.profile.preferenceChecks).toEqual({ unsat: 1 });
  expect(b.profile.preferenceRefutations).toBe(0);
  for (const term of [{ call: 'residual', args: [v('n')] }, { undefined: 'partial' }, op('==', 'a', 'b'), { test: 'C', value: { ctor: 'D', args: [] } }]) {
    expect(refutesNumericPreference([term], ['n'])).toBe(false);
  }
});

test('unsatisfiable and unknown primary queries never enter preference refutation', async () => {
  for (const conditions of [[false], [{ call: 'missing', args: [] }]]) {
    const [, b] = await run(conditions, { n: 'Int' });
    expect(['unsat', 'unknown']).toContain(b.result.status);
    expect(b.profile.preferenceRefutationAttempts).toBe(0);
    expect(b.profile.preferenceChecks).toEqual({});
  }
});

test('cached witnesses are still independently validated and cancellation prevents reuse', async () => {
  const controller = new AbortController();
  const solve = await createSymbolicSolver(algebra, { profileSolver: true, signal: controller.signal });
  const q = { terms: [v('n')], conditions: [op('==', v('n'), 2)], variables: { n: 'Int' } };
  await solve(q);
  const hit = await solve(q);
  expect(hit.bindings.get('n')).toBe(2);
  expect(solve.solverProfile).toMatchObject({ backendQueries: 1, preferenceRefutations: 1, cacheWitnessChecks: 1 });
  controller.abort();
  await expect(solve(q)).rejects.toMatchObject({ code: 'cancelled' });
});

test.each(['membership', 'lookup', 'repeated'])('%s retains classes, frontiers and overlaps', async kind => {
  const goal = recursiveDecomposition({ kind, depth: kind === 'repeated' ? 8 : 3 }), results = [];
  for (const enabled of [false, true]) {
    const r = await deriveGenericSubdomains(goal, { numericPreferenceRefutation: enabled, maxTimeMs: 30000 });
    results.push({ domains: r.domains.map(d => ({ rules: d.rules, patterns: d.patterns, conditions: d.conditions, result: d.resultPattern })), unresolved: r.unresolved, overlaps: r.overlaps, infeasible: r.infeasible });
  }
  expect(results[1]).toEqual(results[0]);
});
