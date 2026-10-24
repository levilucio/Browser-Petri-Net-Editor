/** @jest-environment node */
import { createSymbolicPreamble } from '../../satel/core/SymbolicPreamble';
import { createSymbolicSolver } from '../../satel/core/SymbolicZ3';
import { prepareAlgebra, deriveGenericSubdomains } from '../../satel/core/GenericSubuniformity';
import { parseSymbolicSource } from '../../satel/core/SymbolicSource';
import { evaluateGround, substitute } from '../../satel/core/SymbolicTerms';
import { recursiveDecomposition } from '../../satel/examples/recursive-adt/models';
import { valueToSymbolic } from '../../utils/builtin-values';
jest.setTimeout(60000);
const v = name => ({ var: name }), eq = (left, right) => ({ op: '==', left, right });
const ctor = (name, ...args) => ({ ctor: name, args });
const algebra = prepareAlgebra(parseSymbolicSource(`constructor Stop(): Chain
constructor Link(Nat, Chain): Chain
constructor Tip(): Tree
constructor Fork(Chain, Tree): Tree
constructor Other(): Unused`));

async function compare(query, a = algebra) {
  const results = [];
  for (const smtPreambleProjection of [false, true]) {
    const solve = await createSymbolicSolver(a, { smtPreambleProjection, profileSolver: true, solverQueryCache: false });
    const r = await solve(query);
    if (r.status === 'sat' && query.witness !== false) {
      expect(query.conditions.every(c => evaluateGround(substitute(c, r.bindings)) === true)).toBe(true);
    }
    results.push({ result: r, profile: solve.solverProfile });
  }
  expect(results[1].result.status).toBe(results[0].result.status);
  return results;
}

test('closure retains every constructor and transitive field type, but excludes unrelated sorts', () => {
  const p = createSymbolicPreamble(algebra, 'unit_');
  const selected = p.select(['Tree'], false);
  expect(selected.sorts).toBe(2);
  for (const name of ['Tip', 'Fork', 'Stop', 'Link']) expect(selected.text).toContain(`unit_${name}`);
  expect(selected.text).not.toContain('unit_Other');
  expect(selected.text).not.toContain('unit__ListNil');
  expect(selected.text).not.toContain('runtime_');
  expect(p.select(['Int', 'Bool', 'String', 'Nat'], false)).toEqual({ text: '', sorts: 0 });
  expect(p.select([], false, false)).toBe(p.full);
  expect(p.select(['Tree', 'Chain'], false)).toBe(selected);
});

test('mutually recursive datatypes and Any wrappers retain their complete dependency closure', () => {
  const a = prepareAlgebra(parseSymbolicSource('constructor Leaf(): A\nconstructor AB(B): A\nconstructor BA(A): B\nconstructor Spare(): C'));
  const p = createSymbolicPreamble(a, 'unit_');
  expect(p.select(['A'], false).sorts).toBe(2);
  expect(p.select(['B'], false).sorts).toBe(2);
  // Any admits all custom types, so List/Pair cannot discard those alternatives.
  expect(p.select(['List'], false).sorts).toBe(p.full.sorts);
  expect(p.select([], true)).toEqual(p.full);
});

test('bounded string memoization can evict entries without changing declarations', () => {
  const a = { constructors: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`C${i}`, { result: `S${i}`, parameters: [] }])), operations: {} };
  const p = createSymbolicPreamble(a, 'unit_'), first = p.select(['S0'], false);
  for (let i = 1; i < 40; i++) p.select([`S${i}`], false);
  expect(p.select(['S0'], false)).toEqual(first);
  expect(p.select(['S0'], false)).not.toBe(first);
  expect(Object.isFrozen(first)).toBe(true);
});

test.each([
  ['unknown field sort', { Bad: { result: 'BadSort', parameters: ['Missing'] } }],
  ['uninhabited recursive sort', { Loop: { result: 'LoopSort', parameters: ['LoopSort'] } }],
  ['primitive redefinition', { Zero: { result: 'Int', parameters: [] } }],
  ['unsafe name', { 'bad name': { result: 'S', parameters: [] } }],
  ['function collision', { C: { result: 'S', parameters: ['Int'] }, C_0: { result: 'S', parameters: [] } }],
  ['generated symbol collision', { v1: { result: 'S', parameters: [] } }]
])('%s keeps the original full-declaration path', (_, constructors) => {
  const p = createSymbolicPreamble({ constructors, operations: {} }, 'unit_');
  expect(p.select([], false)).toBe(p.full);
});

test.each(['Nat', 'Int', 'Bool', 'String', 'Pair', 'List'])('%s: SAT witnesses and UNSAT controls agree', async sort => {
  const values = { Nat: 2, Int: -2, Bool: true, String: '\ud800😀', Pair: { __pair__: true, fst: 1, snd: false }, List: [1, 'x', true] };
  const q = { terms: [v('x')], conditions: [eq(v('x'), valueToSymbolic(values[sort]))], variables: { x: sort } };
  const [a, b] = await compare(q);
  expect(b.result.status).toBe('sat');
  expect(b.result.bindings).toEqual(a.result.bindings);
  if (['Nat', 'Int', 'Bool', 'String'].includes(sort)) expect(b.profile.preambleChars).toBe(0);
  expect((await compare({ ...q, conditions: [...q.conditions, false] }))[1].result.status).toBe('unsat');
});

test('witness-only variables retain their sorts; check-only queries need no declarations for unused terms', async () => {
  const q = { terms: [v('x')], conditions: [true], variables: { x: 'Tree', unused: 'Unused' } };
  const [, b] = await compare(q);
  expect(b.result.status).toBe('sat');
  expect(b.result.bindings.has('x')).toBe(true);
  expect(b.profile.datatypeSorts).toBe(2);
  expect((await compare({ ...q, witness: false }))[1].profile.preambleChars).toBe(0);
});

test('ground constructors, recognizers, selectors and nested term graphs supply declaration roots', async () => {
  const stop = ctor('Stop'), link = ctor('Link', 2, stop);
  const terms = [
    { test: 'Link', value: link },
    eq({ field: 'Link', index: 0, value: link }, 2),
    eq(link, link),
    { termGraph: [stop, { ctor: 'Link', args: [2, { graphRef: 0 }] }, { test: 'Link', value: { graphRef: 1 } }] },
    { termGraph: [{ termGraph: [link] }, { test: 'Link', value: { graphRef: 0 } }] }
  ];
  for (const condition of terms) {
    const [, b] = await compare({ terms: [], conditions: [condition], variables: {}, witness: false });
    expect(b.result.status).toBe('sat');
    expect(b.profile.datatypeSorts).toBe(1);
  }
});

test('constructor alternatives and nested Nat validity are preserved', async () => {
  const q = { terms: [v('x')], conditions: [{ op: 'not', left: { test: 'Stop', value: v('x') } }], variables: { x: 'Chain' } };
  const [, b] = await compare(q);
  expect(b.result.status).toBe('sat');
  expect(b.result.bindings.get('x').ctor).toBe('Link');
  const invalid = { ...q, conditions: [eq(v('x'), ctor('Link', -1, ctor('Stop')))] };
  expect((await compare(invalid))[1].result.status).toBe('unsat');
});

test('runtime bounds and partial selector semantics remain unchanged', async () => {
  const small = valueToSymbolic([1, false]);
  for (const [value, depth, status] of [[small, 64, 'sat'], [small, 0, 'unsat'], [valueToSymbolic([2147483648]), 64, 'unsat']]) {
    const [, b] = await compare({ terms: [], conditions: [{ valid: 'List', value, depth }], variables: {}, witness: false });
    expect(b.result.status).toBe(status);
    expect(b.profile.preambleChars).toBe(b.profile.fullPreambleChars);
  }
  // A selector on the wrong constructor remains SMT-total/unspecified in check
  // mode; independent evaluation must reject it when a witness is requested.
  const q = { terms: [], conditions: [eq({ field: 'Link', index: 0, value: ctor('Stop') }, 2)], variables: {} };
  expect((await compare({ ...q, witness: false }))[1].result.status).toBe('sat');
  expect((await compare(q))[1].result.status).toBe('unknown');
});

test('ill-founded unrelated datatypes do not become SAT by being omitted', async () => {
  const a = prepareAlgebra(parseSymbolicSource('constructor Loop(Bad): Bad'));
  const [baseline, projected] = await compare({ terms: [], conditions: [true], variables: {}, witness: false }, a);
  expect(baseline.result.status).toBe('unknown');
  expect(projected.profile.preambleChars).toBe(projected.profile.fullPreambleChars);
});

test('recursive witnesses validate across mutually recursive declarations', async () => {
  const a = prepareAlgebra(parseSymbolicSource('constructor Leaf(): A\nconstructor AB(B): A\nconstructor BA(A): B'));
  const q = { terms: [v('x')], conditions: [eq(v('x'), ctor('BA', ctor('AB', ctor('BA', ctor('Leaf')))))], variables: { x: 'B' } };
  const [, b] = await compare(q, a);
  expect(b.result.status).toBe('sat');
  expect(b.profile.datatypeSorts).toBe(2);
});

test('cache validation, cancellation, unsupported operations and invalid graph refs are preserved', async () => {
  const controller = new AbortController(), solve = await createSymbolicSolver(algebra, { profileSolver: true, smtPreambleProjection: true, signal: controller.signal });
  const q = { terms: [v('x')], conditions: [eq(v('x'), 4)], variables: { x: 'Int' } };
  await solve(q); await solve(q);
  expect(solve.solverProfile.cacheWitnessChecks).toBe(1);
  for (const c of [{ call: 'missing', args: [] }, { termGraph: [{ graphRef: 1 }] }]) {
    expect((await compare({ terms: [], conditions: [c], variables: {} }))[1].result.status).toBe('unknown');
  }
  controller.abort();
  await expect(solve(q)).rejects.toMatchObject({ code: 'cancelled' });
});

test('separate solver owners do not share algebra-specific declarations', async () => {
  const owners = await Promise.all(['Nat', 'String'].map(async sort => createSymbolicSolver(prepareAlgebra(parseSymbolicSource(`constructor Box(${sort}): Boxed`)), { smtPreambleProjection: true })));
  for (const [i, value] of [2, 'text'].entries()) {
    const result = await owners[i]({ terms: [v('x')], conditions: [eq(v('x'), ctor('Box', value))], variables: { x: 'Boxed' } });
    expect(result.status).toBe('sat');
    expect(result.bindings.get('x')).toEqual(ctor('Box', value));
  }
});

test.each(['membership', 'lookup', 'repeated'])('%s: classes, residual frontiers and overlaps agree', async kind => {
  const goal = recursiveDecomposition({ kind, depth: 4 }), runs = [];
  for (const smtPreambleProjection of [false, true]) {
    const solve = await createSymbolicSolver(goal.algebra, { smtPreambleProjection });
    const r = await deriveGenericSubdomains(goal, { solve, maxTimeMs: 30000 });
    runs.push({ domains: r.domains.map(d => ({ patterns: d.patterns, conditions: d.conditions, result: d.resultPattern, rules: d.rules })), unresolved: r.unresolved, overlaps: r.overlaps, infeasible: r.infeasible, calls: solve.cacheStats.backendCalls });
  }
  expect(runs[1]).toEqual(runs[0]);
});

test('primitive runtime validity and string operations need no datatype declarations', async () => {
  for (const [condition, status] of [
    [{ valid: 'Int', value: 2147483647 }, 'sat'],
    [{ valid: 'Int', value: 2147483648 }, 'unsat'],
    [{ valid: 'Nat', value: -1 }, 'unsat'],
    [eq({ call: '_string_length_value', args: ['😀'] }, 2), 'sat'],
    [eq({ call: '_string_concat_value', args: ['a', '\ud800'] }, 'a\ud800'), 'sat']
  ]) {
    const [, b] = await compare({ terms: [], conditions: [condition], variables: {}, witness: false });
    expect(b.result.status).toBe(status);
    expect(b.profile.preambleChars).toBe(0);
  }
});

test('malformed runtime signatures cannot be hidden behind an unrelated primitive query', async () => {
  const a = JSON.parse(JSON.stringify(algebra));
  delete a.constructors._AnyBool;
  const p = createSymbolicPreamble(a, 'unit_');
  expect(p.select([], false)).toBe(p.full);
  expect((await compare({ terms: [], conditions: [true], variables: {}, witness: false }, a))[1].result.status).toBe('unknown');
});

test('production default retains the full preamble until shared-context timeout regressions are resolved', async () => {
  const solve = await createSymbolicSolver(algebra, { profileSolver: true });
  expect((await solve({ terms: [], conditions: [true], variables: {}, witness: false })).status).toBe('sat');
  expect(solve.solverProfile.preambleChars).toBe(solve.solverProfile.fullPreambleChars);
  expect(solve.solverProfile.preambleChars).toBeGreaterThan(0);
});
