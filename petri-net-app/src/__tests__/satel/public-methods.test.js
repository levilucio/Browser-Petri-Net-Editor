import { AlgebraicSimulator } from '../../features/simulation/algebraic-simulator.js';
import { SimulatorCore } from '../../features/simulation/simulator-core.js';
import { getPublicMethods, prepareMethodCall } from '../../features/simulation/PublicMethods.js';
import { accountNet, accountInterface, accountMutants } from '../../satel/examples/oracle-account/net.js';
import { observeBoundedTrace } from '../../satel/core/BoundedOracleAdapter.js';
import { generateTestSuite } from '../../satel/core/TestGenerator.js';
import { executeTestSuite } from '../../satel/core/TestExecutor.js';
import { generateValidatedSubuniformitySuite, evaluateOracleSuite } from '../../satel/core/ValidatedSubuniformity.js';
import { withdrawalGoal, encodeAccountWitness, requestSteps } from '../../satel/examples/oracle-account/algebra.js';

const copy = x => JSON.parse(JSON.stringify(x));
const initialize = async (net = accountNet) => { const sim = new AlgebraicSimulator(); await sim.initialize(copy(net)); return sim; };
const balance = sim => sim.getCurrentState().places.find(p => p.id === 'balance').valueTokens;
const callPair = (method, args, outputs) => ({ stimulation: { method, arguments: args }, observation: { outputs } });

test('parameters arrive through calls while state and outputs remain continuous', async () => {
  const sim = await initialize();
  const inject = jest.spyOn(sim, 'injectTokens'), replace = jest.spyOn(sim, 'setPlaceMarking');
  expect((await sim.invokeMethod('deposit', { n: 10 })).status).toBe('fired');
  expect((await sim.invokeMethod('withdraw', { n: 5 })).produced).toMatchObject({ paidAmount: [5], ack: [1] });
  expect(balance(sim)).toEqual([5]);
  expect((await sim.invokeMethod('withdraw', { n: 5 })).transitionId).toBe('withdrawAccepted');
  expect(balance(sim)).toEqual([0]);
  expect((await sim.invokeMethod('withdraw', { n: 5 })).transitionId).toBe('withdrawRefused');
  expect(sim.getCurrentState().places.find(p => p.id === 'ack').valueTokens).toEqual([1, 1, 1, 0]);
  expect((await sim.invokeMethod('query', {})).produced).toEqual({ balance: [0], balanceResult: [0] });
  expect(inject).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled();
});

test('public methods, including parameterless ones, never fire autonomously or through direct binding APIs', async () => {
  const sim = await initialize();
  expect(await sim.getEnabledTransitions()).toEqual([]);
  expect(await sim.isTransitionEnabled('query')).toBe(false);
  await expect(sim.fireTransition('query')).rejects.toThrow(/not enabled/);
  await expect(sim.fireTransitionSpecific('query', { skipEnabledCheck: true })).rejects.toThrow(/invokeMethod/);
  await expect(sim.fireWithBinding('query', { b: 0 }, [])).rejects.toThrow(/invokeMethod/);
  expect(balance(sim)).toEqual([0]);
});

test('automatic stepping and headless runs preserve waiting public methods', async () => {
  const core = new SimulatorCore(); await core.initialize(accountNet, { netMode: 'algebraic' });
  await core.stepSimulation();
  await core.runToCompletion({ maxSteps: 3 });
  expect(balance(core.currentSimulator)).toEqual([0]);
  expect((await core.invokeMethod('deposit', { n: 2 })).status).toBe('fired');
  expect(balance(core.currentSimulator)).toEqual([2]);
});

test('internal transitions remain autonomous, while the oracle rejects unsupported internal exploration', async () => {
  const net = copy(accountNet);
  net.transitions.push({ id: 'internal', guard: '' });
  net.arcs.push({ id: 'internal-in', source: 'balance', target: 'internal', sourceType: 'place', targetType: 'transition', binding: 'b' },
    { id: 'internal-out', source: 'internal', target: 'balance', sourceType: 'transition', targetType: 'place', binding: 'b + 1' });
  const sim = await initialize(net);
  expect(await sim.getEnabledTransitions()).toEqual(['internal']);
  await sim.fireTransition('internal'); expect(balance(sim)).toEqual([1]);
  await expect(observeBoundedTrace(net, accountInterface, [{ method: 'query', arguments: {} }])).rejects.toThrow(/internal exploration/i);
});

test('missing resources block a call without synthesizing or replacing tokens', async () => {
  const net = copy(accountNet); net.places[0].valueTokens = []; net.places[0].tokens = 0;
  const sim = await initialize(net), before = JSON.stringify(sim.getCurrentState());
  expect(await sim.invokeMethod('deposit', { n: 10 })).toMatchObject({ status: 'blocked' });
  expect(JSON.stringify(sim.getCurrentState())).toBe(before);
});

test.each([{ n: -1 }, { n: 1.5 }, { n: 2147483648 }, {}, { n: 1, b: 100 }, { n: '$n' }])('invalid arguments %j cannot mutate the marking', async args => {
  const sim = await initialize(), before = JSON.stringify(sim.getCurrentState());
  await expect(sim.invokeMethod('deposit', args)).rejects.toThrow();
  expect(JSON.stringify(sim.getCurrentState())).toBe(before);
});

test('inconsistent signatures, undeclared variables and ambiguous calls are explicit errors', async () => {
  const badSignature = copy(accountNet); badSignature.transitions[2].method.parameters[0].sort = 'Int';
  expect(() => getPublicMethods(badSignature)).toThrow(/Inconsistent/);
  const malformed = copy(accountNet); malformed.arcs.find(a => a.id === 'deposit-balance').binding = 'unknown';
  expect(() => prepareMethodCall(malformed, 'deposit', { n: 1 })).toThrow(/Unbound/);
  const ambiguous = copy(accountNet); ambiguous.transitions[2].guard = '';
  const sim = await initialize(ambiguous), before = JSON.stringify(sim.getCurrentState());
  await expect(sim.invokeMethod('withdraw', { n: 0 })).rejects.toThrow(/Nondeterministic/);
  expect(JSON.stringify(sim.getCurrentState())).toBe(before);
});

test('output arithmetic errors leave state intact and a subsequent valid call works', async () => {
  const sim = await initialize();
  await sim.invokeMethod('deposit', { n: 2147483647 });
  await expect(sim.invokeMethod('deposit', { n: 1 })).rejects.toThrow(/range/);
  expect(balance(sim)).toEqual([2147483647]);
  expect((await sim.invokeMethod('query', {})).produced.balanceResult).toEqual([2147483647]);
});

test('method declarations, sorts, interface roles and model metadata survive firing and JSON round-trip', async () => {
  const net = { ...copy(accountNet), testIntentions: [{ id: 'saved' }], satelExample: { id: 'reference' } };
  const sim = await initialize(net); await sim.invokeMethod('deposit', { n: 2 });
  const saved = JSON.parse(JSON.stringify(sim.getCurrentState()));
  expect(saved.testIntentions).toEqual(net.testIntentions);
  expect(saved.places[0]).toMatchObject({ sort: 'Nat', io_type: 'internal' });
  expect(getPublicMethods(saved)).toHaveLength(4);
  const loaded = await initialize(saved); await loaded.invokeMethod('withdraw', { n: 1 });
  expect(balance(loaded)).toEqual([1]);
});

test('same-named parameters on incoming arcs constrain matching; they cannot overwrite supplied arguments', async () => {
  const net = copy(accountNet); net.arcs.find(a => a.id === 'balance-deposit').binding = 'n';
  net.arcs.find(a => a.id === 'deposit-balance').binding = 'n + 1';
  const sim = await initialize(net);
  expect((await sim.invokeMethod('deposit', { n: 5 })).status).toBe('blocked');
  expect((await sim.invokeMethod('deposit', { n: 0 })).status).toBe('fired');
  expect(balance(sim)).toEqual([1]);
});

test('symbolic suite uses each target initial marking and detects the initialization mutant', async () => {
  const suite = await generateValidatedSubuniformitySuite({ referenceNet: accountNet, io: accountInterface, symbolicGoal: withdrawalGoal, encodeWitness: encodeAccountWitness });
  expect(suite.selectedTests[0].initialMarking).toBeUndefined();
  const mutant = accountMutants().find(m => m.id === 'wrong-initial-balance');
  const result = await evaluateOracleSuite(suite.selectedTests, mutant.net, accountInterface);
  expect(result.counts).toEqual({ pass: 0, fail: 4, error: 0 });
  expect(mutant.net.places[0].valueTokens).toEqual([1]);
});

test('method intentions instantiate arguments without treating alternative guards as a conjunction', async () => {
  const intention = { id: 'calls', name: 'Calls', testType: 'positive',
    variables: [{ name: 'n', sort: 'Nat', hypothesis: { type: 'uniformity', representative: 10 } }],
    pairs: [callPair('deposit', { n: '$n' }, { ack: [1] }), callPair('withdraw', { n: '$n' }, { ack: [1], paidAmount: ['$n'] }), callPair('query', {}, { balanceResult: [0] })] };
  const suite = await generateTestSuite([intention], accountNet, {});
  expect(suite.testCases).toHaveLength(1);
  expect(suite.testCases[0].pairs[0].stimulation.arguments).toEqual({ n: 10 });
  expect((await executeTestSuite(suite, accountNet, new AlgebraicSimulator())).statistics.passed).toBe(1);
  const target = accountMutants().find(m => m.id === 'wrong-initial-balance').net;
  expect((await executeTestSuite(suite, target, new AlgebraicSimulator())).statistics.failed).toBe(1);
  await expect(generateTestSuite([{ ...intention, initialMarking: { balance: [10] } }], accountNet, {})).rejects.toThrow(/initial marking/);
});

test('account trace records event-local observations and all intermediate markings', async () => {
  const trace = await observeBoundedTrace(accountNet, accountInterface, requestSteps({ ctor: 'Amount', args: [10] }));
  expect(trace.markings.map(m => m.balance)).toEqual([[0], [10], [0], [0]]);
  expect(trace.markings.at(-1).ack).toEqual([1, 1]);
  expect(trace.observations.at(-1)).toEqual({ ack: [], paidAmount: [], balanceResult: [0] });
});

test('compound arithmetic guards and multiplication agree with firing; overflow preserves the marking', async () => {
  const { createCompoundGuardExample } = await import('../../satel/examples/compound-guard/editor');
  const net = createCompoundGuardExample();
  net.transitions[0].guard = 'x * x < 100 and (x > 0 or x == 0)';
  net.transitions[1].guard = `not (${net.transitions[0].guard})`;
  const sim = await initialize(net);
  expect((await sim.invokeMethod('check', { x: 3 })).produced.accepted).toEqual([1]);
  expect((await sim.invokeMethod('check', { x: -3 })).produced.accepted).toEqual([0]);
  expect((await sim.invokeMethod('check', { x: 11 })).produced.accepted).toEqual([0]);
  const before = JSON.stringify(sim.getCurrentState());
  await expect(sim.invokeMethod('check', { x: 50000 })).rejects.toThrow('32-bit range');
  expect(JSON.stringify(sim.getCurrentState())).toBe(before);
});
