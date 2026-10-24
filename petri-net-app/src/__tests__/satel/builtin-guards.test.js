/** @jest-environment node */
import { deriveGenericSubdomains } from '../../satel/core/GenericSubuniformity';
import { compileSymbolicIntention, guardFromTransition } from '../../satel/core/SymbolicSource';
import { evaluateGround, substitute, unify, formatSymbolicTerm } from '../../satel/core/SymbolicTerms';
import { deriveSymbolicIntention, admitSymbolicIntention } from '../../satel/core/SymbolicIntention';
import { evaluateOracleSuite } from '../../satel/core/ValidatedSubuniformity';
import { createCompoundGuardExample, createBuiltinTypesExample, createGuardIntention } from '../../satel/examples/compound-guard/editor';
import { parseArithmetic } from '../../utils/arith-parser';
import { evaluateArithmeticWithBindings } from '../../utils/z3/eval-arith';
import { parseBooleanExpr } from '../../utils/z3/booleanParser';
import { evaluateBooleanWithBindings } from '../../utils/z3/booleanEvaluator';

jest.setTimeout(30000);
const goal = symbolic => compileSymbolicIntention({ id: 'test', name: 'test', symbolic: { source: '', variablesText: '', maxDepth: 32, ...symbolic } }).goal;
const guard = (guardText, variablesText, extra = {}) => goal({ goalKind: 'guard', guardText, variablesText, ...extra });
const unbox = t => {
  if (t?.ctor?.startsWith('_Any')) return unbox(t.args[0]);
  if (t?.ctor === '_ListNil') return [];
  if (t?.ctor === '_ListCons') return [unbox(t.args[0]), ...unbox(t.args[1])];
  if (t?.ctor === '_Pair') return { __pair__: true, fst: unbox(t.args[0]), snd: unbox(t.args[1]) };
  return t;
};
const deriveGround = async (operation, argsText) => {
  const r = await deriveGenericSubdomains(goal({ operation, argsText }));
  expect(r.unresolved).toEqual([]); expect(r.domains).toHaveLength(1);
  return unbox(r.domains[0].witnessResult);
};

test.each([
  ['length', '[]'], ['length', '[1, true, "a"]'],
  ['concat', '[1, (2, false)], ["a", [3]]'], ['head', '[true, 2]'], ['tail', '[]'], ['tail', '[1, "b"]'],
  ['append', '[1, true], (2, "s")'], ['sublist', '[1, 2, 3, 4], -3, 2'], ['sublist', '[1, 2, 3], 2, -1'], ['sublist', '[1, 2, 3], -8, 6'],
  ['isSublistOf', '[], [1]'], ['isSublistOf', '[[1], (2, true)], [0, [1], (2, true), 4]'], ['isSublistOf', '[1, 3], [1, 2, 3]'],
  ['fst', '([true], "s")'], ['snd', '(1, (2, false))'],
  ['length', '"a😀b"'], ['concat', '"a", "😀b"'], ['substring', '"a😀b", -3, 2'], ['substring', '"abc", -8, 2'], ['substring', '"abc", 1, -1'],
  ['isSubstringOf', '"😀", "a😀b"'], ['isSubstringOf', '"", "abc"'], ['isSubstringOf', '"z", "abc"'],
])('%s(%s) agrees with the concrete built-in evaluator', async (operation, argsText) => {
  const expected = evaluateArithmeticWithBindings(parseArithmetic(`${operation}(${argsText})`), {});
  expect(await deriveGround(operation, argsText)).toEqual(expected);
});

test('String witnesses preserve UTF-16 units, quotes and literal backslashes', async () => {
  for (const s of ['a😀b', '\ud800', '"quote"', '\\u{61}', '\\n', '\n\u0000']) {
    const g = goal({ operation: 'substring', argsText: 's, 0, 20', variablesText: 's: String', conditionsText: `s == ${JSON.stringify(s)}` });
    const r = await deriveGenericSubdomains(g);
    expect(r.unresolved).toEqual([]); expect(r.domains).toHaveLength(1);
    expect(r.domains[0].witnessArgs[0]).toBe(s); expect(r.domains[0].witnessResult).toBe(s);
  }
});

test('heterogeneous equality is structural, and custom constructors can occur inside built-in containers', async () => {
  const r = await deriveGenericSubdomains(guard('xs == [(1, true), ["a"]]', 'xs: List'));
  expect(r.unresolved).toEqual([]); expect(r.domains).toHaveLength(2);
  expect(r.domains.find(d => d.witnessResult).witnessArgs.map(formatSymbolicTerm)).toEqual(['[(1, true), ["a"]]']);
  const custom = await deriveGenericSubdomains(goal({ source: 'constructor Item(Nat): Item', operation: 'head', argsText: '[Item(3)]' }));
  expect(custom.unresolved).toEqual([]); expect(formatSymbolicTerm(custom.domains[0].witnessResult)).toBe('Item(3)');
  const expression = 'isSublistOf([[1], (2, true)], [0, [1], (2, true)])';
  expect(evaluateBooleanWithBindings(parseBooleanExpr(expression, parseArithmetic), {}, parseArithmetic)).toBe(true);
  expect(evaluateBooleanWithBindings(parseBooleanExpr('[1, [2]] == [1, [2]]', parseArithmetic), {}, parseArithmetic)).toBe(true);
});

test('shared guard variables yield disjoint correlated classes, not independent term samples', async () => {
  const { goal: g } = compileSymbolicIntention(createGuardIntention());
  const r = await deriveGenericSubdomains(g);
  expect(r.domains).toHaveLength(4); expect(r.overlaps).toEqual([]); expect(r.unresolved).toEqual([]);
  // Finite audit only: generation above uses equations/constraints, not these samples.
  for (let x = -2; x <= 12; x++) {
    const matching = r.domains.filter(d => {
      const bindings = new Map(); return unify(d.patterns[0], x, bindings) && d.conditions.every(c => evaluateGround(substitute(c, bindings)));
    });
    expect(matching).toHaveLength(1); expect(matching[0].witnessResult).toBe(x > 0 && (x < 5 || x === 10));
  }
  const impossible = await deriveGenericSubdomains(guard('x < 0 and x > 10', 'x: Int'));
  expect(impossible.domains.every(d => d.witnessResult === false)).toBe(true);
  expect(impossible.infeasible.length).toBeGreaterThan(0);
});

test.each(['and', 'or', 'xor', 'implies', 'iff', '&&', '||', '^', '->', '<->'])('Boolean operator %s uses the same two symbols throughout', async operator => {
  const r = await deriveGenericSubdomains(guard(`a ${operator} b`, 'a: Bool, b: Bool'));
  expect(r.unresolved).toEqual([]); expect(r.overlaps).toEqual([]);
  for (const a of [true, false]) for (const b of [true, false]) {
    const expected = evaluateBooleanWithBindings(parseBooleanExpr(`a ${operator} b`, parseArithmetic), { a, b }, parseArithmetic);
    const matches = r.domains.filter(d => {
      const bindings = new Map(); return d.patterns.every((p, i) => unify(p, [a, b][i], bindings)) && d.conditions.every(c => evaluateGround(substitute(c, bindings)));
    });
    expect(matches).toHaveLength(1); expect(matches[0].witnessResult).toBe(expected);
  }
});

test('partial operations and short-circuit guards stay explicit without forcing irrelevant terms', async () => {
  const empty = await deriveGenericSubdomains(goal({ operation: 'head', argsText: '[]' }));
  expect(empty.domains).toEqual([]); expect(empty.unresolved[0]).toMatchObject({ status: 'undefined', reason: 'head requires a non-empty list' });
  for (const expression of ['true or head([]) == 0', 'false and head([]) == 0', 'false implies head([]) == 0']) {
    const r = await deriveGenericSubdomains(guard(expression, ''));
    expect(r.unresolved).toEqual([]); expect(r.domains).toHaveLength(1);
  }
  const partial = await deriveGenericSubdomains(guard('head([]) == 0', ''));
  expect(partial.domains).toEqual([]); expect(partial.unresolved.every(d => d.status === 'undefined')).toBe(true);
  const wrong = await deriveGenericSubdomains(goal({ operation: 'asInt', argsText: 'head([true])' }));
  expect(wrong.domains).toEqual([]); expect(wrong.unresolved[0].reason).toContain('received Bool');
});

test('multiplication supports exact witnesses and solver limits do not invent fallback values', async () => {
  const r = await deriveGenericSubdomains(guard('x * x == 9 and x < 0', 'x: Int'));
  expect(r.unresolved).toEqual([]); expect(r.domains.find(d => d.witnessResult).witnessArgs).toEqual([-3]);
  const unknown = await deriveGenericSubdomains(guard('x * y == 37', 'x: Int, y: Int'), { solve: async () => ({ status: 'unknown', reason: 'solver budget' }) });
  expect(unknown.domains).toEqual([]); expect(unknown.unresolved[0].reason).toBe('solver budget');
});

test('compound guard classes pass the unchanged initial-marking oracle and detect a missing disjunct mutant', async () => {
  const net = createCompoundGuardExample();
  const before = JSON.stringify(net);
  const report = await deriveSymbolicIntention(net.testIntentions[0], net);
  expect(report.candidates).toHaveLength(4); expect(report.encodingError).toBeNull();
  const suite = await admitSymbolicIntention(report, net);
  expect(suite.validation).toEqual({ generated: 4, referencePassed: 4 });
  const mutant = await evaluateOracleSuite(suite.selectedTests, createCompoundGuardExample(true), suite.interface);
  expect(mutant.counts).toMatchObject({ pass: 3, fail: 1, error: 0 });
  expect(JSON.stringify(net)).toBe(before);
  const blocked = createCompoundGuardExample(); blocked.places[0].valueTokens = []; blocked.places[0].tokens = 0;
  const run = await evaluateOracleSuite(suite.selectedTests, blocked, suite.interface);
  expect(run.counts).toMatchObject({ pass: 0, fail: 4, error: 0 });
});

test('example intentions and explicit transition guard import compile with inferred shared sorts', async () => {
  const imported = guardFromTransition(createCompoundGuardExample(), 'accept');
  expect(imported).toMatchObject({ variablesText: 'x: Int', guardText: 'x > 0 and (x < 5 or x == 10)' });
  for (const intention of createBuiltinTypesExample().testIntentions) {
    const { goal: g } = compileSymbolicIntention(intention);
    const r = await deriveGenericSubdomains(g);
    expect(r.domains.length).toBeGreaterThan(0); expect(r.overlaps).toEqual([]);
    if (intention.id !== 'builtin-list') expect(r.unresolved).toEqual([]);
  }
});

test('a shared Int survives repeated heterogeneous projections in different guard terms', async () => {
  const r = await deriveGenericSubdomains(guard('head([x]) > 0 and fst((x, true)) < 5', 'x: Int'));
  expect(r.unresolved).toEqual([]); expect(r.overlaps).toEqual([]);
  expect(r.domains.filter(d => d.witnessResult)).toHaveLength(1);
  const x = r.domains.find(d => d.witnessResult).witnessArgs[0];
  expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(5);
});
