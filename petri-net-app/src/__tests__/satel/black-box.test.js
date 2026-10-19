/** @jest-environment node */
import { runBlackBoxCampaign, runBlackBoxExperiment } from '../../satel/blackbox/Campaign.js';
import { experimentsForTest, traceEvidence } from '../../satel/blackbox/Experiments.js';
import { createDemoSystem } from '../../satel/blackbox/DemoSystems.js';
import { createNondeterminismExample, modal } from '../../satel/examples/nondeterminism/editor.js';
import { createHmlSelectionExample } from '../../satel/examples/hml-selection/editor.js';
import { publicInterface } from '../../satel/core/TestCase.js';
import { generateIntention } from '../../satel/core/IntentionPipeline.js';
import { evaluateFormula } from '../../satel/core/HmlEvaluator.js';
import { builder, pairValue } from '../../satel/examples/exercises/builder.js';

jest.setTimeout(30000);
const net = id => createNondeterminismExample(`nondeterminism-${id}-reference`);
const call = (method, args = {}) => ({ method, arguments: args });
const accepted = (outputs) => ({ status: 'accepted', outputs });
const refused = outputs => ({ status: 'refused', outputs });
function scripted(referenceNet, responses) {
  return () => { let index = 0; return { interface: publicInterface(referenceNet), reset: async () => { index = 0; }, invoke: jest.fn(async () => responses[index++]) }; };
}
const run = (referenceNet, calls, responses, options) => runBlackBoxExperiment({ referenceNet, calls, createSut: scripted(referenceNet, responses) }, options);

test('ambiguous observations retain both hidden reference states and later distinguish them', async () => {
  const reference = net('branch');
  const result = await run(reference, [call('open'), call('right')], [accepted({ reply: [0] }), accepted({ reply: [2] })]);
  expect(result.verdict).toBe('compatible');
  expect(result.events.map(e => e.compatibleAfter)).toEqual([2, 1]);
  expect(reference.places.find(p => p.id === 'state').valueTokens).toEqual([0]);
  expect(result.events[0]).not.toHaveProperty('transitionId');
  expect(result.events[0]).not.toHaveProperty('marking');
});

test('explicit refusal can select a disabled compatible state without rejecting allowed nondeterminism', async () => {
  const result = await run(net('branch'), [call('open'), call('right'), call('left')], [accepted({ reply: [0] }), refused({ reply: [] }), accepted({ reply: [1] })]);
  expect(result.verdict).toBe('compatible');
  expect(result.events.map(e => e.compatibleAfter)).toEqual([2, 1, 1]);
});

test.each([
  ['unexpected-refusal', [refused({ reply: [] })], [call('open')]],
  ['unexpected-output', [accepted({ reply: [99] })], [call('open')]],
  ['unexpected-acceptance', [accepted({ reply: [1] })], [call('left')]],
])('distinguishes %s from other execution failures', async (reasonCode, responses, calls) => {
  expect(await run(net('branch'), calls, responses)).toMatchObject({ verdict: 'mismatch', reasonCode, step: 1 });
});

test('multiset duplicate occurrences and output events survive continuous execution', async () => {
  const result = await run(net('bag'), Array(4).fill(call('take')), [accepted({ picked: [1] }), accepted({ picked: [2] }), accepted({ picked: [1] }), refused({ picked: [] })]);
  expect(result.verdict).toBe('compatible');
  expect(result.events[2].expected).toEqual([{ status: 'accepted', outputs: { picked: [1] } }]);
});

test('typed List/Pair/Bool/String observations use structural bag equality', async () => {
  const b = builder(); b.place('out', 'Pair', [], true);
  b.rule('echo', 'echo', { p: 'Pair' }, '', [], [['out', 'p']]);
  const value = pairValue([1, true, 'hello'], pairValue(2, false));
  expect((await run(b.net, [call('echo', { p: value })], [accepted({ out: [JSON.parse(JSON.stringify(value))] })])).verdict).toBe('compatible');
});

test('shared input variables and multiplicity follow the existing APN semantics', async () => {
  const b = builder(); b.place('stock', 'Int', [1, 1, 2]); b.place('out', 'Int', [], true);
  b.rule('takeTwo', 'takeTwo', {}, '', [['stock', 'x'], ['stock', 'x']], [['out', 'x']]);
  expect((await run(b.net, [call('takeTwo'), call('takeTwo')], [accepted({ out: [1] }), refused({ out: [] })])).verdict).toBe('compatible');
});

test.each([{ maxBindings: 1 }, { maxTotalBindings: 1 }])('incomplete successor enumeration never calls or rejects the SUT: %j', async options => {
  const referenceNet = net('branch');
  const sut = { interface: publicInterface(referenceNet), reset: jest.fn(), invoke: jest.fn() };
  const result = await runBlackBoxExperiment({ referenceNet, calls: [call('open')], createSut: () => sut }, options);
  expect(result.verdict).toBe('inconclusive'); expect(sut.invoke).not.toHaveBeenCalled();
});

test('state budget does not keep only the first successor and manufacture a later failure', async () => {
  const result = await run(net('branch'), [call('open'), call('right')], [accepted({ reply: [0] }), accepted({ reply: [2] })], { maxStates: 1 });
  expect(result.verdict).toBe('inconclusive'); expect(result.events).toHaveLength(1);
  expect(result.events[0].compatibleAfter).toBe(2);
});

test.each([{}, { status: 'refused', outputs: { reply: [1] } }, accepted({ reply: ['bad'] }), accepted({ reply: [], secret: [0] })])('malformed adapter response is an error, not a detected fault: %j', async response => {
  expect((await run(net('branch'), [call('open')], [response])).verdict).toBe('error');
});

test('reported timeout and hanging invoke remain inconclusive, never a refusal', async () => {
  expect((await run(net('branch'), [call('open')], [{ status: 'timeout' }])).verdict).toBe('inconclusive');
  const referenceNet = net('branch');
  const result = await runBlackBoxExperiment({ referenceNet, calls: [call('open')], createSut: () => ({ interface: publicInterface(referenceNet), reset() {}, invoke: () => new Promise(() => {}) }) }, { callTimeoutMs: 5 });
  expect(result).toMatchObject({ verdict: 'inconclusive', diagnostic: { code: 'adapter-timeout' } });
});

test('cancellation interrupts a pending adapter operation', async () => {
  const referenceNet = net('branch'), controller = new AbortController();
  const promise = runBlackBoxExperiment({ referenceNet, calls: [call('open')], createSut: () => ({ interface: publicInterface(referenceNet), reset() {}, invoke: () => new Promise(() => {}) }) }, { signal: controller.signal });
  setTimeout(() => controller.abort(), 5);
  await expect(promise).rejects.toMatchObject({ code: 'cancelled' });
});

test('invalid later parameters are rejected before reset', async () => {
  const referenceNet = createHmlSelectionExample(), reset = jest.fn();
  expect((await runBlackBoxExperiment({ referenceNet, calls: [call('open', { n: 3 }), call('open', { n: true })], createSut: () => ({ interface: publicInterface(referenceNet), reset, invoke() {} }) })).verdict).toBe('error');
  expect(reset).not.toHaveBeenCalled();
});

test('per-run evidence witnesses existential sequences and refutes forbidden observable output', () => {
  const io = publicInterface(net('branch')), event = { stimulation: call('open'), response: accepted({ reply: [0] }) };
  const possible = modal('diamond', 'open', { reply: [0] });
  expect(traceEvidence(possible, [event], io)).toMatchObject({ value: true, verdict: 'witnessed' });
  expect(traceEvidence({ ...possible, op: 'box', child: { op: 'false' } }, [event], io)).toMatchObject({ value: false, verdict: 'counterexample' });
  expect(traceEvidence(possible, [event], io, false).verdict).toBe('counterexample');
  expect(traceEvidence(possible, [{ ...event, response: refused({ reply: [] }) }], io).value).toBeNull();
  expect(traceEvidence(modal('diamond', 'open', { reply: [99] }), [event], io).value).toBeNull();
});

test('private marking predicates and universal existence obligations are not settled by a trace', () => {
  const io = publicInterface(net('branch'));
  const events = [{ stimulation: call('open'), response: accepted({ reply: [0] }) }];
  const formula = modal('diamond', 'open', null, { op: 'marking', markings: { state: { equals: [1] } } });
  expect(traceEvidence(formula, events, io).value).toBeNull();
  expect(traceEvidence(modal('box', 'open', null), events, io).value).toBeNull();
});

test('different continuations from the same visible prefix never establish shared-state branching', async () => {
  const reference = net('branch');
  const { suite } = await generateIntention(reference.testIntentions[0], reference);
  const report = await runBlackBoxCampaign({ suite, createSut: () => createDemoSystem('branch'), repetitions: 8 });
  expect(report.counts).toMatchObject({ compatible: 16, mismatch: 0, error: 0 });
  expect(report.runs.some(r => r.events[1]?.response.outputs.reply[0] === 1)).toBe(true);
  expect(report.runs.some(r => r.events[1]?.response.outputs.reply[0] === 2)).toBe(true);
  expect(report.evidenceCounts).toEqual({ witnessed: 0, counterexample: 0, inconclusive: 16 });
});

test('existing HML-selection suite drives independent workers and catches missing completion/output faults', async () => {
  const reference = createHmlSelectionExample();
  const { suite } = await generateIntention(reference.testIntentions[0], reference);
  const good = await runBlackBoxCampaign({ suite, createSut: () => createDemoSystem('jobs'), repetitions: 8 });
  expect(good.counts.mismatch).toBe(0); expect(good.counts.error).toBe(0);
  for (const [id, code] of [['jobs-missing-finish', 'unexpected-refusal'], ['jobs-wrong-receipt', 'unexpected-output']]) {
    const bad = await runBlackBoxCampaign({ suite, createSut: () => createDemoSystem(id), repetitions: 8 });
    expect(bad.counts.mismatch).toBeGreaterThan(0);
    expect(bad.runs.filter(r => r.verdict === 'mismatch').every(r => r.reasonCode === code && r.step === 2)).toBe(true);
    // Refusing one sampled finish does not disprove the existential continuation.
    expect(bad.evidenceCounts.counterexample).toBe(0);
  }
});

test('campaigns preserve multiplicity, isolate reset runs, and reproduce seeds', async () => {
  const reference = net('bag'), { suite } = await generateIntention(reference.testIntentions[0], reference);
  const execute = id => runBlackBoxCampaign({ suite, createSut: () => createDemoSystem(id), repetitions: 4 });
  const good = await execute('bag'), repeated = await execute('bag');
  expect(good.counts).toEqual({ compatible: 4, mismatch: 0, inconclusive: 0, error: 0 });
  expect(good.runs.map(r => r.events)).toEqual(repeated.runs.map(r => r.events));
  const short = await execute('bag-missing-duplicate');
  expect(short.counts.mismatch).toBe(4);
  expect(short.runs.every(r => r.step === 3 && r.reasonCode === 'unexpected-refusal')).toBe(true);
  const wrong = await execute('bag-wrong-output');
  expect(wrong.runs.every(r => r.step === 1 && r.reasonCode === 'unexpected-output')).toBe(true);
});

test('a negative forbidden-output baseline gets a genuine HML counterexample', async () => {
  const reference = net('bag'), { suite } = await generateIntention(reference.testIntentions[1], reference);
  const bad = await runBlackBoxCampaign({ suite, createSut: () => createDemoSystem('bag-wrong-output'), repetitions: 2 });
  expect(bad.evidenceCounts.counterexample).toBe(2);
  expect(bad.runs.every(r => r.propertyEvidence.value === false)).toBe(true);
});

test('path/run budgets and missing suites are explicit, not silently partial', async () => {
  const reference = net('branch'), { suite } = await generateIntention(reference.testIntentions[0], reference);
  expect(() => experimentsForTest(suite.selectedTests[0], suite.interface, 1)).toThrow(/Too many/);
  await expect(runBlackBoxCampaign({ suite, createSut: () => createDemoSystem('branch'), repetitions: 4 }, { maxRuns: 1 })).rejects.toThrow(/budget/);
  await expect(runBlackBoxCampaign({ createSut: () => createDemoSystem('branch') })).rejects.toThrow(/admit/);
});

test('per-trace definite evidence agrees with complete HML truth on the known reference', async () => {
  const reference = net('bag'), io = publicInterface(reference);
  const formulas = [modal('diamond', 'take', { picked: [1] }), modal('box', 'take', null, { op: 'false' }), { op: 'not', child: modal('diamond', 'take', { picked: [99] }) }];
  for (const formula of formulas) {
    const exact = await evaluateFormula(formula, reference, io);
    for (const picked of [1, 2]) {
      const evidence = traceEvidence(formula, [{ stimulation: call('take'), response: accepted({ picked: [picked] }) }], io);
      if (evidence.value !== null) expect(evidence.value).toBe(exact.value);
    }
  }
});
