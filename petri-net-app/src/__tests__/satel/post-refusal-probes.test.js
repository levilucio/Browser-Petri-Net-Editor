/** @jest-environment node */
import { builder } from '../../satel/examples/exercises/builder.js';
import { publicInterface } from '../../satel/core/TestCase.js';
import { derivePostRefusalProbes } from '../../satel/blackbox/PostRefusalProbes.js';
import { runBlackBoxExperiment } from '../../satel/blackbox/Campaign.js';

function fixture() {
  const b = builder(); b.place('state', 'Nat', [0]);
  b.net.gates = [{ name: 'value', parameters: [{ name: 'arg1', sort: 'Nat' }] }];
  const rule = (id, method, guard, next, output) => {
    b.rule(id, method, {}, guard, [['state', 'x']], [['state', next]]);
    b.net.transitions.at(-1).gates = [{ gate: 'value', arguments: [output] }];
  };
  rule('left', 'choose', 'x == 0', '1', '0');
  rule('right', 'choose', 'x == 0', '2', '0');
  rule('deny', 'deny', 'x > 2', 'x', 'x');
  rule('read', 'read', '', 'x', 'x');
  rule('partial', 'partial', 'x == 1', 'x', 'x');
  rule('write', 'write', '', 'x + 1', 'x');
  const call = method => ({ method, arguments: {} });
  const test = { id: 'ambiguous-prefix', pairs: [
    { stimulation: call('choose'), observation: { outputs: { value: [0] }, scope: 'public' } },
    { stimulation: call('deny'), assertion: 'blocked', observation: { outputs: { value: [] }, scope: 'public' } }
  ] };
  return { referenceNet: b.net, io: publicInterface(b.net), test, probeCalls: ['read', 'partial', 'write'].map(call) };
}

test('retains all compatible states and derives all probe outputs without changing caller data', () => {
  const input = fixture(), before = JSON.stringify(input);
  const plan = derivePostRefusalProbes(input);
  expect(plan.compatibleStates).toBe(2);
  expect(plan.probes).toHaveLength(1);
  expect(plan.probes[0].expected.map(x => x.outputs.value[0]).sort()).toEqual([1, 2]);
  expect(plan.rejected.map(x => x.reason)).toEqual(['not-enabled-in-every-state', 'changes-reference-marking']);
  expect(JSON.stringify(input)).toBe(before);
});

test('rejects a refusal that is only disabled on one compatible branch', () => {
  const input = fixture(); input.referenceNet.transitions.find(t => t.id === 'deny').guard = 'x == 2';
  expect(() => derivePostRefusalProbes(input)).toThrow('enabled in a compatible reference state');
});

test('resource bounds and cancellation never silently prune possibilities', () => {
  for (const options of [{ maxStates: 1 }, { maxTotalBindings: 1 }, { maxProbes: 1 }]) {
    expect(() => derivePostRefusalProbes(fixture(), options)).toThrow(expect.objectContaining({ code: 'resource-limit' }));
  }
  const controller = new AbortController(); controller.abort();
  expect(() => derivePostRefusalProbes(fixture(), { signal: controller.signal })).toThrow(expect.objectContaining({ code: 'cancelled' }));
});

test('invalid candidates and impossible seed observations fail before admitting a plan', () => {
  const input = fixture();
  expect(() => derivePostRefusalProbes({ ...input, probeCalls: [{ method: 'read', arguments: { extra: 1 } }] })).toThrow('Invalid probe');
  input.test.pairs[0].observation.outputs.value = [99];
  expect(() => derivePostRefusalProbes(input)).toThrow('no compatible reference execution');
});

test('private seed assertions cannot silently eliminate black-box alternatives', () => {
  const input = fixture();
  input.test.pairs[0].observation.markings = { state: { equals: [1] } };
  expect(() => derivePostRefusalProbes(input)).toThrow('public observations only');
  delete input.test.pairs[0].observation.markings;
  input.test.pairs[0].observation.scope = 'listed';
  input.test.pairs[0].observation.outputs.state = [1];
  expect(() => derivePostRefusalProbes(input)).toThrow('public observations only');
});

test('terminal refusal misses persisted corruption which a later probe detects', async () => {
  const input = fixture(), plan = derivePostRefusalProbes(input);
  const createSut = corrupt => () => {
    let value = 0;
    return { interface: input.io, reset: async () => { value = 0; }, invoke: async ({ method }) => {
      if (method === 'choose') { value = 1; return { status: 'accepted', outputs: { value: [0] } }; }
      if (method === 'deny') { if (corrupt) value = 99; return { status: 'refused', outputs: { value: [] } }; }
      return { status: 'accepted', outputs: { value: [value] } };
    } };
  };
  const run = (calls, corrupt) => runBlackBoxExperiment({ ...input, calls, createSut: createSut(corrupt) });
  expect((await run(plan.prefixCalls, true)).verdict).toBe('compatible');
  const extended = [...plan.prefixCalls, plan.probes[0].stimulation];
  expect((await run(extended, false)).verdict).toBe('compatible');
  expect(await run(extended, true)).toMatchObject({ verdict: 'mismatch', step: 3, reasonCode: 'unexpected-output' });
});
