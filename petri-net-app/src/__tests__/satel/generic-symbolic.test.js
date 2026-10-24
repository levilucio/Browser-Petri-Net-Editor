/** @jest-environment node */
import { deriveGenericSubdomains } from '../../satel/core/GenericSubuniformity';
import { compileSymbolicIntention, encodeProtocolWitness, parseSymbolicSource } from '../../satel/core/SymbolicSource';
import { createSymbolicListIntention } from '../../satel/examples/symbolic-list/editor';
import { createAccountSymbolicIntentions } from '../../satel/examples/oracle-account/intentions';
import { accountNet, accountInterface, accountMutants } from '../../satel/examples/oracle-account/net';
import { deriveSymbolicIntention, admitSymbolicIntention } from '../../satel/core/SymbolicIntention';
import { evaluateOracleSuite } from '../../satel/core/ValidatedSubuniformity';

jest.setTimeout(30000);
const goalFrom = (source, operation, argsText, variablesText, maxDepth = 3, conditionsText = '') => compileSymbolicIntention({ id: 'test', name: 'test', symbolic: { source, operation, argsText, variablesText, maxDepth, conditionsText } }).goal;

test('real Z3: saved account definitions yield four classes and frozen pairs detect all mutants', async () => {
  const report = await deriveSymbolicIntention(createAccountSymbolicIntentions()[0], accountNet);
  expect(report.decomposition.domains).toHaveLength(4);
  expect(report.decomposition.unresolved).toEqual([]);
  expect(report.decomposition.overlaps).toEqual([]);
  const suite = await admitSymbolicIntention(report, accountNet);
  expect(suite.validation).toEqual({ generated: 4, referencePassed: 4 });
  for (const mutant of accountMutants()) {
    const run = await evaluateOracleSuite(suite.selectedTests, mutant.net, suite.interface);
    expect(run.counts.error).toBe(0); expect(run.counts.fail).toBeGreaterThan(0);
  }
  const coarse = await deriveSymbolicIntention(createAccountSymbolicIntentions()[1], accountNet);
  expect(coarse.decomposition.domains).toHaveLength(3);
});

test('recursive lists preserve an infinite tail frontier; larger budgets refine it without state-space generation', async () => {
  const { goal } = compileSymbolicIntention(createSymbolicListIntention());
  const before = JSON.stringify(goal);
  const r = await deriveGenericSubdomains(goal);
  expect(r.domains).toHaveLength(4); expect(r.unresolved).toHaveLength(1);
  expect(r.unresolved[0]).toMatchObject({ status: 'residual', resultPattern: { call: 'member' } });
  expect(r.coverage).toBe('not-proved'); expect(r.overlaps).toEqual([]);
  const deeper = await deriveGenericSubdomains({ ...goal, maxDepth: 3 });
  expect(deeper.domains).toHaveLength(6); expect(deeper.unresolved).toHaveLength(1);
  expect(JSON.stringify(goal)).toBe(before);
});

test('multivariate linear constraints, Int literals and nested operation results use actual SMT models', async () => {
  const source = `operation add(Nat, Nat): Nat
operation capacity(Nat, Nat): Nat
rule add.def(a: Nat, b: Nat): add(a, b) = a + b
rule capacity.ok(a: Nat, b: Nat): capacity(a, b) = add(a, b) if a < b
rule capacity.no(a: Nat, b: Nat): capacity(a, b) = 0 if a >= b`;
  const r = await deriveGenericSubdomains(goalFrom(source, 'capacity', 'a, b', 'a: Nat, b: Nat', 2, 'a > 4 and b <= 8'));
  expect(r.domains).toHaveLength(2); expect(r.unresolved).toEqual([]); expect(r.disjoint).toBe(true);
  for (const d of r.domains) { const [a, b] = d.witnessArgs; expect(a).toBeGreaterThan(4); expect(b).toBeLessThanOrEqual(8); expect(d.witnessResult).toBe(a < b ? a + b : 0); }
  const signed = await deriveGenericSubdomains(goalFrom('operation identity(Int): Int\nrule i(x: Int): identity(x) = x', 'identity', 'x', 'x: Int', 1, 'x < 0'));
  expect(signed.domains[0].witnessResult).toBeLessThan(0);
});

test('constructor equality/disequality, mutually recursive datatypes and Nat fields are preserved', async () => {
  const source = `constructor End(): Tree
constructor Node(Nat, Forest): Tree
constructor Empty(): Forest
constructor More(Tree, Forest): Forest
operation same(Tree, Tree): Bool
rule same.yes(a: Tree, b: Tree): same(a, b) = true if a == b
rule same.no(a: Tree, b: Tree): same(a, b) = false if a != b`;
  const r = await deriveGenericSubdomains(goalFrom(source, 'same', 'a, b', 'a: Tree, b: Tree'));
  expect(r.domains).toHaveLength(2); expect(r.overlaps).toEqual([]);
  for (const d of r.domains) expect(JSON.stringify(d.witnessArgs[0]) === JSON.stringify(d.witnessArgs[1])).toBe(d.witnessResult);
});

test('contradictions are infeasible; overlapping equations and solver unknown never become admitted classes', async () => {
  const source = `operation f(Nat): Bool
rule f.one(x: Nat): f(x) = true if x >= 0
rule f.two(x: Nat): f(x) = false if x == 0
rule f.impossible(x: Nat): f(x) = true if x < 0`;
  const r = await deriveGenericSubdomains(goalFrom(source, 'f', 'x', 'x: Nat'));
  expect(r.domains).toHaveLength(2); expect(r.infeasible).toHaveLength(1); expect(r.overlaps).toHaveLength(1);
  const unknown = await deriveGenericSubdomains(goalFrom(source, 'f', 'x', 'x: Nat'), { solve: async () => ({ status: 'unknown', reason: 'test timeout' }) });
  expect(unknown.domains).toEqual([]); expect(unknown.infeasible).toEqual([]); expect(unknown.unresolved[0].reason).toBe('test timeout');
  const report = await deriveSymbolicIntention(createAccountSymbolicIntentions()[0], accountNet, { maxBranches: 1 });
  expect(report.decomposition.unresolved.length).toBeGreaterThan(0);
  await expect(admitSymbolicIntention(report, accountNet)).rejects.toThrow('Unresolved');
});

test('invalid sorts, recursive occurs checks and unsupported syntax do not yield invented witnesses', async () => {
  expect(() => goalFrom('operation f(Nat): Bool\nrule bad(x: Nat): f(x) = x', 'f', 'x', 'x: Nat')).toThrow('Ill-sorted result');
  expect(() => parseSymbolicSource('operation f(Nat): Nat\nrule bad(x: Nat): f(x) = x / x')).toThrow('Unexpected');
  const source = 'constructor Nil(): L\nconstructor Cons(L): L\noperation equal(L, L): Bool\nrule eq(x: L): equal(x, x) = true';
  const r = await deriveGenericSubdomains(goalFrom(source, 'equal', 'xs, Cons(xs)', 'xs: L'));
  expect(r.domains).toEqual([]); expect(r.unresolved[0].reason).toContain('No defining equation');
});

test('protocol is declarative, typed at matching and exactly one case must encode a witness', () => {
  const { goal, protocol } = compileSymbolicIntention(createAccountSymbolicIntentions()[0]);
  const result = { ctor: 'Result', args: [0, { ctor: 'Paid', args: [25] }] };
  const args = [25, { ctor: 'Amount', args: [25] }];
  const test = encodeProtocolWitness(protocol, args, result, accountInterface);
  expect(test.steps[0].arguments.n).toBe(25); expect(test.expected[1].paidAmount).toEqual([25]);
  expect(() => encodeProtocolWitness([...protocol, ...protocol], args, result, accountInterface)).toThrow('exactly one');
  expect(goal.operation).toBe('withdraw');
});


test('operation calls inside arguments and compound guard terms unfold before residual solving', async () => {
  const source = `operation inc(Nat): Nat
operation identity(Nat): Nat
operation check(Nat): Bool
rule inc.def(x: Nat): inc(x) = x + 1
rule identity.def(x: Nat): identity(x) = x
rule check.def(x: Nat): check(x) = true if identity(inc(x)) + 1 < 8`;
  const r = await deriveGenericSubdomains(goalFrom(source, 'check', 'n', 'n: Nat', 3));
  expect(r.domains).toHaveLength(1); expect(r.unresolved).toEqual([]);
  expect(r.domains[0].rules).toEqual(['check.def', 'inc.def', 'identity.def']);
  expect(r.domains[0].witnessArgs[0] + 2).toBeLessThan(8);
});

test('invalid Nat arguments are infeasible and time budget exhaustion stays unresolved', async () => {
  const goal = goalFrom('operation f(Nat): Bool\nrule f.def(x: Nat): f(x) = true', 'f', '0 - n', 'n: Nat', 1, 'n > 0');
  const invalid = await deriveGenericSubdomains(goal);
  expect(invalid.domains).toEqual([]); expect(invalid.infeasible).toHaveLength(1);
  const expired = await deriveGenericSubdomains(goal, { maxTimeMs: 0 });
  expect(expired.domains).toEqual([]); expect(expired.unresolved[0].reason).toContain('time budget');
});
