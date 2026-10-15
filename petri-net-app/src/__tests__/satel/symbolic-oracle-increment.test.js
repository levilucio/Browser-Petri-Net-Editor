import { deriveSymbolicSubdomains } from '../../satel/core/SymbolicSubuniformity.js';
import { observeBoundedTrace } from '../../satel/core/BoundedOracleAdapter.js';
import {
  generateValidatedSubuniformitySuite, validateOracleCandidates,
  replayOracleTest, evaluateOracleSuite, evaluateSpecMutants,
} from '../../satel/core/ValidatedSubuniformity.js';
import { accountNet, accountInterface, accountMutants } from '../../satel/examples/oracle-account/net.js';
import { withdrawalGoal, coarseWithdrawalGoal, encodeAccountWitness, requestSteps } from '../../satel/examples/oracle-account/algebra.js';
import { runOracleAccountExample } from '../../satel/examples/oracle-account/run.js';

const copy = value => JSON.parse(JSON.stringify(value));
const generate = (overrides = {}) => generateValidatedSubuniformitySuite({
  referenceNet: accountNet, io: accountInterface, symbolicGoal: withdrawalGoal,
  encodeWitness: encodeAccountWitness, ...overrides,
});

describe('Symbolic constructor/operation subuniformity', () => {
  test('derives four subdomains and ground equation results without a net or simulator', () => {
    const result = deriveSymbolicSubdomains(withdrawalGoal);
    expect(result.domains.map(d => d.rules)).toEqual([
      ['withdraw.all'], ['withdraw.amount.accept', 'affordable.less'],
      ['withdraw.amount.accept', 'affordable.equal'], ['withdraw.amount.refuse', 'affordable.greater'],
    ]);
    expect(result.domains.map(d => d.witnessArgs[1])).toEqual([
      { ctor: 'All', args: [] }, ...[1, 10, 11].map(n => ({ ctor: 'Amount', args: [n] })),
    ]);
    expect(result.domains.map(d => d.witnessResult)).toEqual([
      { ctor: 'Result', args: [0, { ctor: 'Paid', args: [10] }] },
      { ctor: 'Result', args: [9, { ctor: 'Paid', args: [1] }] },
      { ctor: 'Result', args: [0, { ctor: 'Paid', args: [10] }] },
      { ctor: 'Result', args: [10, { ctor: 'Refused', args: [11] }] },
    ]);
    expect(result.infeasible).toHaveLength(3);
    // Domains retain symbolic variables/constraints, not just their witnesses.
    expect(result.domains[1].patterns[1].args[0]).toHaveProperty('var');
    expect(result.domains[1].conditions[0]).toMatchObject({ op: '<', right: 10 });
  });

  test('operation equations refine the same constructor and same Boolean result', () => {
    expect(deriveSymbolicSubdomains(coarseWithdrawalGoal()).domains).toHaveLength(3);
    const goal = copy(withdrawalGoal);
    goal.args[0] = 1000000000;
    const result = deriveSymbolicSubdomains(goal);
    expect(result.domains.map(d => d.witnessArgs[1].args[0])).toEqual([undefined, 1, 1000000000, 1000000001]);
    // No enumeration of the billion possible preceding values is required.
    expect(result.domains).toHaveLength(4);
  });

  test('constructor matching restricts a ground goal and infeasible branches are excluded', () => {
    const goal = copy(withdrawalGoal);
    goal.args[1] = { ctor: 'Amount', args: [10] };
    goal.variables = {};
    const result = deriveSymbolicSubdomains(goal);
    expect(result.domains.map(d => d.id)).toEqual(['withdraw.amount.accept/affordable.equal']);
  });

  test('refuses incomplete unfolding and constraints outside the supported solver fragment', () => {
    expect(() => deriveSymbolicSubdomains({ ...withdrawalGoal, maxDepth: 1 })).toThrow(/depth exhausted/);
    const goal = copy(withdrawalGoal);
    goal.args[0] = { var: 'balance' };
    goal.variables.balance = 'Nat';
    expect(() => deriveSymbolicSubdomains(goal)).toThrow(/stronger solver/);
  });

  test('rejects ill-sorted constructors, free variables and overlapping equations', () => {
    const badSort = copy(withdrawalGoal);
    badSort.args[1] = { ctor: 'Amount', args: [true] };
    expect(() => deriveSymbolicSubdomains(badSort)).toThrow(/Ill-sorted/);
    const unbound = copy(withdrawalGoal);
    unbound.algebra.operations.withdraw.rules[0].result.args[0] = { var: 'missing' };
    expect(() => deriveSymbolicSubdomains(unbound)).toThrow(/unbound variable/);
    const overlap = copy(withdrawalGoal);
    const duplicate = copy(overlap.algebra.operations.withdraw.rules[0]);
    duplicate.id = 'withdraw.duplicate';
    overlap.algebra.operations.withdraw.rules.push(duplicate);
    expect(() => deriveSymbolicSubdomains(overlap)).toThrow(/Overlapping symbolic subdomains/);
  });
});

describe('Specification admission and fixed-oracle mutation execution', () => {
  let example;
  beforeAll(async () => { example = await runOracleAccountExample(); });

  test('every generated equation-derived test passes the APN oracle and a fresh replay', async () => {
    expect(example.suite.validation).toEqual({ generated: 4, referencePassed: 4 });
    expect(example.reference.counts).toEqual({ pass: 4, fail: 0, error: 0 });
    for (const test of example.suite.selectedTests) {
      expect(await replayOracleTest(test, accountNet, accountInterface)).toMatchObject({ verdict: 'pass' });
    }
    expect(example.auditTests).toHaveLength(13);
  });

  test('acceptance and equality stay distinct although their concrete transition sequences coincide', () => {
    const [, less, equal] = example.suite.selectedTests;
    expect(less.referenceAnnotations).toEqual(equal.referenceAnnotations);
    expect(less.symbolicDomain.id).not.toEqual(equal.symbolicDomain.id);
  });

  test('known behavior is pinned independently at zero, equality, refusal and All', async () => {
    const cases = [
      [{ ctor: 'Amount', args: [0] }, 1, [0], 10],
      [{ ctor: 'Amount', args: [10] }, 1, [10], 0],
      [{ ctor: 'Amount', args: [11] }, 0, [], 10],
      [{ ctor: 'All', args: [] }, 1, [10], 0],
    ];
    for (const [request, ack, paidAmount, balance] of cases) {
      const result = await observeBoundedTrace(accountNet, accountInterface, requestSteps(request));
      expect(result.observations).toEqual([
        { ack: [1], paidAmount: [], balanceResult: [] },
        { ack: [ack], paidAmount, balanceResult: [] },
        { ack: [], paidAmount: [], balanceResult: [balance] },
      ]);
    }
  });

  test('wrong generated expectations or a drifting APN reference cannot be admitted', async () => {
    await expect(generate({ encodeWitness: (args, result) => {
      const test = encodeAccountWitness(args, result);
      test.expected[2].balanceResult = [999];
      return test;
    } })).rejects.toThrow(/Reference validation failed/);
    await expect(generate({ referenceNet: accountMutants()[0].net })).rejects.toThrow(/Reference validation failed/);
  });

  test('detects all three mutations, while coarse symbolic equations miss the boundary fault', () => {
    expect(example.mutants.map(m => m.selected.status)).toEqual(['killed', 'killed', 'killed']);
    expect(example.mutants.map(m => m.audit.status)).toEqual(['killed', 'killed', 'killed']);
    expect(example.coarse.mutants.map(m => m.selected.status)).toEqual(['killed', 'killed', 'survived']);
    expect(example.mutants[2].selected.results.find(r => r.verdict === 'fail')).toMatchObject({
      id: 'withdraw.amount.accept/affordable.equal', step: 2, reason: 'observation-mismatch',
      expected: { ack: [1], paidAmount: [10], balanceResult: [] },
      actual: { ack: [0], paidAmount: [], balanceResult: [] },
    });
  });

  test('internal rule renaming cannot change a verdict and mutations cannot rewrite the oracle', async () => {
    const before = JSON.stringify(example.suite);
    const renamed = copy(accountNet);
    const oldId = 'withdrawAccepted', newId = 'implementationRule';
    renamed.transitions.find(t => t.id === oldId).id = newId;
    renamed.arcs.forEach(a => {
      if (a.source === oldId) a.source = newId;
      if (a.target === oldId) a.target = newId;
    });
    expect((await evaluateOracleSuite(example.suite.selectedTests, renamed, accountInterface)).counts).toEqual({ pass: 4, fail: 0, error: 0 });
    await evaluateSpecMutants(example.suite, accountMutants());
    expect(JSON.stringify(example.suite)).toBe(before);
    expect(Object.isFrozen(example.suite.selectedTests[0].expected[0].ack)).toBe(true);
    expect(accountNet.places.find(p => p.id === 'balance').valueTokens).toEqual([0]);
  });

  test('malformed/unsupported specs are errors and do not count as kills', async () => {
    const broken = copy(accountNet);
    broken.arcs.find(a => a.id === 'withdrawAccepted-balance').binding = 'missing';
    const [result] = await evaluateSpecMutants(example.suite, [{ id: 'malformed', net: broken }]);
    expect(result.selected.status).toBe('error');
    expect(result.selected.counts).toEqual({ pass: 0, fail: 0, error: 4 });
    const test = copy(example.suite.selectedTests[0]);
    test.steps[0].action = 'unknown';
    expect(await replayOracleTest(test, accountNet, accountInterface)).toMatchObject({ verdict: 'error' });
  });

  test('a blocked target is a failure, while a blocked reference rejects generation', async () => {
    const blocked = copy(accountNet);
    blocked.transitions.find(t => t.id === 'withdrawAll').guard = 'q > 0';
    expect(await replayOracleTest(example.suite.selectedTests[0], blocked, accountInterface)).toMatchObject({
      verdict: 'fail', reason: 'request-blocked', step: 2,
    });
    await expect(generate({ referenceNet: blocked })).rejects.toThrow(/Reference rejected candidate/);
  });

  test('refuses nondeterminism, illegal Nat values and writes to internal places', async () => {
    const ambiguous = copy(accountNet);
    ambiguous.transitions.find(t => t.id === 'withdrawRefused').guard = '';
    expect(await replayOracleTest(example.suite.selectedTests[1], ambiguous, accountInterface)).toMatchObject({ verdict: 'error' });
    const negative = copy(example.suite.selectedTests[1]);
    negative.steps[1].value = -1;
    expect(await replayOracleTest(negative, accountNet, accountInterface)).toMatchObject({ verdict: 'error' });
    const internal = copy(accountInterface);
    internal.actions.withdraw = 'balance';
    expect(await replayOracleTest(example.suite.selectedTests[1], accountNet, internal)).toMatchObject({ verdict: 'error' });
  });

  test('does not allow empty or malformed oracles to pass vacuously', async () => {
    await expect(evaluateOracleSuite([], accountNet, accountInterface)).rejects.toThrow(/empty suite/);
    await expect(validateOracleCandidates({ referenceNet: accountNet, io: accountInterface, candidates: [] })).rejects.toThrow(/nonempty/);
    const malformed = copy(example.suite.selectedTests[0]);
    malformed.expected = [];
    expect(await replayOracleTest(malformed, accountNet, accountInterface)).toMatchObject({ verdict: 'error' });
  });
});
