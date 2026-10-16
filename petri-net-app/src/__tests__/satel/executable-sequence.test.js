/** @jest-environment node */
import { deriveSymbolicIntention, admitSymbolicIntention } from '../../satel/core/SymbolicIntention';
import { compileSymbolicIntention } from '../../satel/core/SymbolicSource';
import { deriveGenericSubdomains } from '../../satel/core/GenericSubuniformity';
import { evaluateOracleSuite } from '../../satel/core/ValidatedSubuniformity';
import { createExecutableSequenceExample } from '../../satel/examples/executable-sequence/editor';

jest.setTimeout(30000);
const derive = net => deriveSymbolicIntention(net.testIntentions[0], net);
const copy = x => JSON.parse(JSON.stringify(x));
function tokenNet(tokens = [2, 7, 7], sort = 'Nat') {
  return { mode: 'algebraic', places: [
    { id: 'stock', sort, io_type: 'internal', valueTokens: tokens, tokens: tokens.length },
    { id: 'out', sort, io_type: 'output', valueTokens: [], tokens: 0 }],
  transitions: [{ id: 'take', method: { name: 'take', parameters: [{ name: 'n', sort }] }, guard: '' }],
  arcs: [{ id: 'in1', source: 'stock', target: 'take', binding: 'n' }, { id: 'in2', source: 'stock', target: 'take', binding: 'n' }, { id: 'out1', source: 'take', target: 'out', binding: 'n' }],
  testIntentions: [{ id: 'tokens', name: 'Token binding', kind: 'symbolic', symbolic: {
    source: `operation identity(${sort}): ${sort}\nrule identity.def(n: ${sort}): identity(n) = n`, operation: 'identity', variablesText: `n: ${sort}`, argsText: 'n', maxDepth: 1,
    protocolSource: `case take(n: ${sort}):\ninputs n\nresult n\npair take(n=n) => out(n)` } }] };
}

test('later observations constrain earlier parameters; frozen tests kill a no-debit mutant', async () => {
  const net = createExecutableSequenceExample(), before = JSON.stringify(net);
  const staticClasses = await deriveGenericSubdomains(compileSymbolicIntention(net.testIntentions[0]).goal);
  expect(staticClasses.domains.map(d => d.witnessArgs[0])).toEqual([0, 1]);
  const report = await derive(net);
  expect(report.encodingError).toBeNull();
  expect(report.execution.blocked).toEqual([]); expect(report.execution.unresolved).toEqual([]);
  expect(report.candidates.map(c => c.steps[0].arguments.n)).toEqual([0, 3]);
  const suite = await admitSymbolicIntention(report, net);
  expect(suite.validation).toEqual({ generated: 2, referencePassed: 2 });
  expect(suite.selectedTests[1].referenceMarkings.map(m => m.balance)).toEqual([[10], [7], [0], [0]]);
  expect((await evaluateOracleSuite(suite.selectedTests, createExecutableSequenceExample(true), suite.interface)).counts).toEqual({ pass: 0, fail: 2, error: 0 });
  expect(JSON.stringify(net)).toBe(before);
  expect(Object.isFrozen(suite.selection)).toBe(true);
});

test('shared input/parameter variables consume distinct occurrences, not a reusable value', async () => {
  const net = tokenNet(), report = await derive(net);
  expect(report.execution.unresolved).toEqual([]);
  expect(report.candidates[0].steps[0].arguments.n).toBe(7);
  const suite = await admitSymbolicIntention(report, net);
  expect(suite.selectedTests[0].referenceMarkings[1].stock).toEqual([2]);
  const insufficient = tokenNet([7]);
  const blocked = await derive(insufficient);
  expect(blocked.execution.blocked).toHaveLength(1);
  expect(blocked.candidates).toEqual([]);
  await expect(admitSymbolicIntention(blocked, insufficient)).rejects.toThrow(/No partial suite/);
});

test('tokens consumed by a prefix are unavailable in the following pair', async () => {
  const net = tokenNet([7, 7]);
  net.testIntentions[0].symbolic.protocolSource += '\npair take(n=n) => out(n)';
  const report = await derive(net);
  expect(report.execution.blocked).toHaveLength(1);
  expect(report.execution.unresolved).toEqual([]);
});

test('shared variables across different places select their intersection', async () => {
  const net = tokenNet([2, 7]);
  net.places.push({ id: 'other', sort: 'Nat', io_type: 'internal', valueTokens: [7], tokens: 1 });
  net.arcs[1].source = 'other';
  const report = await derive(net);
  expect(report.candidates[0].steps[0].arguments.n).toBe(7);
  expect((await admitSymbolicIntention(report, net)).validation.referencePassed).toBe(1);
});

test.each([['Bool', true], ['String', 'hello'], ['List', [true, 7]], ['Pair', { __pair__: true, fst: 'a', snd: [2] }]])('available %s tokens constrain method values', async (sort, value) => {
  const net = tokenNet([value, copy(value)], sort);
  if (sort === 'Bool') net.testIntentions[0].symbolic.conditionsText = 'n == true';
  const report = await derive(net);
  expect(report.encodingError).toBeNull(); expect(report.execution.unresolved).toEqual([]);
  expect(report.candidates[0].steps[0].arguments.n).toEqual(value);
  expect((await admitSymbolicIntention(report, net)).validation.referencePassed).toBe(1);
});

test('search exhaustion is unresolved, not an infeasible class or negative test', async () => {
  const net = tokenNet();
  const report = await deriveSymbolicIntention(net.testIntentions[0], net, { maxSequenceBranches: 1 });
  expect(report.execution.blocked).toEqual([]); expect(report.execution.unresolved).toHaveLength(1);
  await expect(admitSymbolicIntention(report, net)).rejects.toThrow(/unresolved/);
});

test('nondeterministic paths cannot bypass concrete reference admission', async () => {
  const net = tokenNet([7, 7]);
  net.transitions.push({ ...copy(net.transitions[0]), id: 'alsoTake' });
  net.arcs.push(...net.arcs.map(a => ({ ...a, id: a.id + '-other', source: a.source === 'take' ? 'alsoTake' : a.source, target: a.target === 'take' ? 'alsoTake' : a.target })));
  const report = await derive(net);
  expect(report.candidates).toHaveLength(1);
  await expect(admitSymbolicIntention(report, net)).rejects.toThrow(/Nondeterministic/);
});
