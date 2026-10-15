import { AlgebraicSimulator } from '../../features/simulation/algebraic-simulator.js';
import { executeV2TestCase } from '../../satel/core/ObservationChecker.js';
import { generateTestSuite } from '../../satel/core/TestGenerator.js';
import { observeBoundedTrace } from '../../satel/core/BoundedOracleAdapter.js';
import { replayOracleTest } from '../../satel/core/ValidatedSubuniformity.js';
import { accountNet, accountInterface, accountInitialMarking } from '../../satel/examples/oracle-account/net.js';
import { requestSteps } from '../../satel/examples/oracle-account/algebra.js';

const copy = x => JSON.parse(JSON.stringify(x));
const request = { ctor: 'Amount', args: [10] };
const pair = (transition, inputs, outputs) => ({ stimulation: { transition, inputs }, observation: { outputs } });
const run = (pairs, initialMarking = {}, net = accountNet) => executeV2TestCase({ id: 'test', testType: 'positive', pairs, initialMarking }, net, new AlgebraicSimulator());

test('account firings preserve pending requests and accumulated outputs, with event-local observations', async () => {
  const inject = jest.spyOn(AlgebraicSimulator.prototype, 'injectTokens');
  const replace = jest.spyOn(AlgebraicSimulator.prototype, 'setPlaceMarking');
  try {
    const trace = await observeBoundedTrace(accountNet, accountInterface, requestSteps(request), accountInitialMarking(request));
    expect(trace.status).toBe('completed');
    expect(trace.markings.map(m => m.balance)).toEqual([[0], [10], [0], [0]]);
    expect(trace.markings[1].withdrawRequest).toEqual([10]);
    expect(trace.markings[2].ack).toEqual([1, 1]);
    expect(trace.markings[3].ack).toEqual([1, 1]);
    expect(trace.observations[2]).toEqual({ ack: [], paidAmount: [], balanceResult: [0] });
    expect(inject).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  } finally { inject.mockRestore(); replace.mockRestore(); }
});

test('missing intermediate request blocks the account trace instead of injecting it', async () => {
  const trace = await observeBoundedTrace(accountNet, accountInterface, requestSteps(request), { withdrawRequest: [] });
  expect(trace).toMatchObject({ status: 'blocked', step: 2, annotations: ['deposit'] });
  expect(trace.markings.at(-1).balance).toEqual([10]);
});

test('incorrect requested value does not consume a different existing token', async () => {
  const steps = requestSteps({ ctor: 'Amount', args: [9] });
  const trace = await observeBoundedTrace(accountNet, accountInterface, steps);
  expect(trace).toMatchObject({ status: 'blocked', step: 2 });
});

test('reusing a consumed request cannot fire a second deposit', async () => {
  const trace = await observeBoundedTrace(accountNet, accountInterface, [{ action: 'deposit', value: 10 }, { action: 'deposit', value: 10 }]);
  expect(trace).toMatchObject({ status: 'blocked', step: 2 });
  expect(trace.markings.at(-1).balance).toEqual([10]);
});

test('generic pairs start once, preserve marking, and stop at a blocked pair', async () => {
  const deposit = pair('deposit', { depositRequest: [10] }, { ack: [1] });
  const result = await run([deposit, deposit, pair('query', {}, {})]);
  expect(result.verdict).toBe('fail');
  expect(result.pairResults).toHaveLength(2);
  expect(result.pairResults[1].reason).toBe('transition_not_enabled');
  expect(result.markings.at(-1).balance).toEqual([10]);
});

test('generic input parameters select an existing binding, including a non-first token', async () => {
  const result = await run([pair('deposit', { depositRequest: [7] }, { ack: [1] })], { depositRequest: [3, 7] });
  expect(result.verdict).toBe('pass');
  expect(result.markings.at(-1).depositRequest).toEqual([3]);
  expect(result.markings.at(-1).balance).toEqual([7]);
});

test('self-loop production is observed even when marking size does not change', async () => {
  const result = await run([pair('deposit', { depositRequest: [10] }, { balance: [10], ack: [1] })], { ack: [1] });
  expect(result.verdict).toBe('pass');
  expect(result.pairResults[0].producedTokens.balance).toEqual([10]);
  expect(result.markings.at(-1).ack).toEqual([1, 1]);
});

test('old output tokens do not masquerade as new observations', async () => {
  const result = await run([pair('query', {}, { ack: [], balanceResult: [0] })], { ack: [1] });
  expect(result.verdict).toBe('pass');
  expect(result.markings.at(-1).ack).toEqual([1]);
});

test('initial marking and pairs use the same variable substitution, without changing the editor net', async () => {
  const original = JSON.stringify(accountNet);
  const intention = { id: 'parameter', name: 'Parameterized setup', testType: 'positive',
    variables: [{ name: 'n', sort: 'Nat', hypothesis: { type: 'uniformity', representative: 7 } }],
    initialMarking: { depositRequest: ['$n'] },
    pairs: [pair('deposit', { depositRequest: ['$n'] }, { balance: ['$n'] })] };
  const suite = await generateTestSuite([intention], accountNet, {});
  const tc = suite.testCases[0];
  expect(tc.initialMarking.depositRequest).toEqual([7]);
  expect((await executeV2TestCase(tc, accountNet, new AlgebraicSimulator())).verdict).toBe('pass');
  expect(JSON.stringify(accountNet)).toBe(original);
});

test('notEnabled checks available resources without replacing them', async () => {
  const test = { id: 'disabled', testType: 'positive', initialMarking: { depositRequest: [] }, pairs: [
    { stimulation: { transition: 'deposit', inputs: { depositRequest: [10] } }, observation: { type: 'notEnabled', outputs: {} } },
  ] };
  const result = await executeV2TestCase(test, accountNet, new AlgebraicSimulator());
  expect(result.verdict).toBe('pass');
  expect(result.markings[1]).toEqual(result.markings[0]);
});

test('malformed initial markings are execution errors', async () => {
  const tc = { id: 'bad', initialMarking: { missing: [1] }, steps: [{ action: 'deposit', value: 10 }],
    expected: [{ ack: [1], paidAmount: [], balanceResult: [] }] };
  expect(await replayOracleTest(tc, accountNet, accountInterface)).toMatchObject({ verdict: 'error' });
});
