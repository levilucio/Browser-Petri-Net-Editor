/** @jest-environment node */
import { AlgebraicSimulator } from '../../features/simulation/algebraic-simulator';
import { prepareMethodCall, validMethodValue } from '../../features/simulation/PublicMethods';
import { parseMethodValue } from '../../features/simulation/MethodTerms';
import { createTypedStoreExample } from '../../satel/examples/typed-store/editor';
import { deriveSymbolicIntention, admitSymbolicIntention } from '../../satel/core/SymbolicIntention';
import { evaluateOracleSuite, replayOracleTest } from '../../satel/core/ValidatedSubuniformity';
import { compileSymbolicIntention, encodeProtocolWitness } from '../../satel/core/SymbolicSource';
import { equalTokenBags } from '../../utils/builtin-values';

jest.setTimeout(30000);
const pair = (fst, snd) => ({ __pair__: true, fst, snd });
const initialize = async net => { const sim = new AlgebraicSimulator(); await sim.initialize(net); return sim; };
const args = () => ({ items: [1, true, '😀', [false, 'nested'], pair('k', [2])], label: 'a', enabled: true, meta: pair('a', false) });

test('all richer values pass through calls, persistent state, observations and detached snapshots', async () => {
  const net = createTypedStoreExample(), before = JSON.stringify(net), sim = await initialize(net);
  const input = args(), frozen = JSON.parse(JSON.stringify(input));
  const result = await sim.invokeMethod('store', input);
  expect(result.produced).toMatchObject({ ack: [true], echoed: [frozen.items], labelOut: ['a'], metaOut: [frozen.meta] });
  input.items[3][0] = 'changed'; result.state.places.find(p => p.id === 'storage').valueTokens[0].push('changed'); result.produced.echoed[0].push('changed');
  expect((await sim.invokeMethod('read')).produced.saved).toEqual([frozen.items]);
  expect((await sim.invokeMethod('store', { ...args(), enabled: false })).produced.ack).toEqual([false]);
  expect((await sim.invokeMethod('read')).produced.saved).toEqual([frozen.items]);
  expect(JSON.stringify(net)).toBe(before);
  expect(await sim.getEnabledTransitions()).toEqual([]);
});

test.each([{ enabled: 'true' }, { label: 2 }, { meta: ['a', false] }, { items: [null] }, { items: [2147483648] }])('ill-sorted arguments %j cannot alter the marking', async change => {
  const sim = await initialize(createTypedStoreExample()), before = JSON.stringify(sim.getCurrentState());
  await expect(sim.invokeMethod('store', { ...args(), ...change })).rejects.toThrow();
  expect(JSON.stringify(sim.getCurrentState())).toBe(before);
});

test('missing resource blocks calls, partial outputs fail atomically, and direct rule firing stays prohibited', async () => {
  const empty = createTypedStoreExample(); empty.places[0].valueTokens = []; empty.places[0].tokens = 0;
  const sim = await initialize(empty);
  expect((await sim.invokeMethod('store', args())).status).toBe('blocked');
  await expect(sim.fireTransitionSpecific('accept', { skipEnabledCheck: true })).rejects.toThrow('invokeMethod');
  const partial = createTypedStoreExample(); partial.arcs.find(a => a.id === 'accept-storage').binding = 'tail(head([]))';
  const invalid = await initialize(partial), before = JSON.stringify(invalid.getCurrentState());
  await expect(invalid.invokeMethod('store', args())).rejects.toThrow();
  expect(JSON.stringify(invalid.getCurrentState())).toBe(before);
});

test('shared rich input variables match structurally and duplicate tokens retain multiplicity', () => {
  const net = createTypedStoreExample(); net.transitions = [net.transitions[0]];
  net.transitions[0].guard = ''; net.arcs = [net.arcs[0]]; net.arcs[0].binding = 'items';
  net.places[0].valueTokens = [[1, pair('a', false)], [1, pair('a', false)]]; net.places[0].tokens = 2;
  const call = prepareMethodCall(net, 'store', { ...args(), items: [1, pair('a', false)] });
  expect(call.next.places[0].valueTokens).toEqual([[1, pair('a', false)]]);
  expect(prepareMethodCall(net, 'store', { ...args(), items: [2] })).toBeNull();
  expect(equalTokenBags([[1, 2], false, false], [false, [1, 2], false])).toBe(true);
  expect(equalTokenBags([[1, 2], false, false], [[2, 1], false, false])).toBe(false);
  expect(equalTokenBags([false, false], [false, true])).toBe(false);
});

test('typed symbolic selection produces five executable classes and a frozen two-pair suite detects the mutant', async () => {
  const net = createTypedStoreExample();
  const report = await deriveSymbolicIntention(net.testIntentions[0], net);
  expect(report.encodingError).toBeNull(); expect(report.decomposition.unresolved).toEqual([]); expect(report.decomposition.overlaps).toEqual([]);
  expect(report.candidates).toHaveLength(5);
  const suite = await admitSymbolicIntention(report, net);
  expect(suite.validation).toEqual({ generated: 5, referencePassed: 5 });
  const run = await evaluateOracleSuite(suite.selectedTests, createTypedStoreExample(true), suite.interface);
  expect(run.counts).toEqual({ pass: 4, fail: 1, error: 0 });
  expect(run.results.find(r => r.verdict === 'fail').step).toBe(2);
  const wrong = createTypedStoreExample(); wrong.places.find(p => p.id === 'ack').sort = 'String';
  expect((await replayOracleTest(suite.selectedTests[0], wrong, suite.interface)).verdict).toBe('error');
});

test('protocol literals preserve nested commas, quoted arrows, empty-list tokens and signed observations', () => {
  const intention = { id: 'p', name: 'p', symbolic: { source: 'operation f(Int): Int\nrule f(x: Int): f(x) = x', operation: 'f', argsText: '-1', variablesText: '', maxDepth: 1,
    protocolSource: 'case p(x: Int):\ninputs x\nresult x\npair send(items=[1, ("a,)=>b", false)], label="$cash", enabled=true) => result((x, [true, "a,b"])), empty([])' } };
  const { protocol } = compileSymbolicIntention(intention);
  const encoded = encodeProtocolWitness(protocol, [-1], -1, { outputs: ['result', 'empty'] });
  expect(encoded.steps[0].arguments).toEqual({ items: [1, pair('a,)=>b', false)], label: '$cash', enabled: true });
  expect(encoded.expected[0]).toEqual({ result: [pair(-1, [true, 'a,b'])], empty: [[]] });
});

test('value entry preserves quoted strings, Bool, nested List/Pair and rejects wrong sorts', () => {
  expect(parseMethodValue('("$cash", [true, "😀"])', 'Pair')).toEqual(pair('$cash', [true, '😀']));
  expect(parseMethodValue('false', 'Bool')).toBe(false);
  expect(parseMethodValue('""', 'String')).toBe('');
  expect(() => parseMethodValue('"false"', 'Bool')).toThrow();
  expect(() => parseMethodValue('[]', 'Pair')).toThrow();
  expect(validMethodValue(false, 'Int')).toBe(false);
});

test('typed oracle checks signed Int and multiset observations, distinguishes empty bags from empty-list tokens', async () => {
  const net = createTypedStoreExample();
  net.places.push({ id: 'signed', sort: 'Int', io_type: 'output', valueTokens: [], tokens: 0 });
  net.arcs.push({ id: 'read-extra', source: 'read', target: 'saved', sourceType: 'transition', targetType: 'place', binding: '[true]' },
    { id: 'read-signed', source: 'read', target: 'signed', sourceType: 'transition', targetType: 'place', binding: '-7' });
  const { getPublicMethods } = await import('../../features/simulation/PublicMethods');
  const io = { methods: getPublicMethods(net).map(({ name, parameters }) => ({ name, parameters })), outputs: net.places.filter(p => p.io_type === 'output').map(p => p.id), outputSorts: Object.fromEntries(net.places.filter(p => p.io_type === 'output').map(p => [p.id, p.sort])) };
  const expected = Object.fromEntries(io.outputs.map(id => [id, []])); expected.saved = [[true], []]; expected.signed = [-7];
  const test = { id: 'bags', steps: [{ method: 'read', arguments: {} }], expected: [expected] };
  expect((await replayOracleTest(test, net, io)).verdict).toBe('pass');
  expect((await replayOracleTest({ ...test, expected: [{ ...expected, saved: [[true]] }] }, net, io)).verdict).toBe('fail');
  expect((await replayOracleTest({ ...test, expected: [{ ...expected, ack: [1] }] }, net, io)).verdict).toBe('error');
});

test('all built-in operation families evaluate in checked method terms', () => {
  const cases = [
    ['concat("a", "b")', 'String', 'ab'], ['substring("a😀b", -3, 2)', 'String', '😀'], ['isSubstringOf("a", "abc")', 'Bool', true], ['length("a😀b")', 'Int', 4],
    ['concat([1], [true])', 'List', [1, true]], ['append([1], ("k", false))', 'List', [1, pair('k', false)]],
    ['sublist([1, 2, 3], -2, 1)', 'List', [2]], ['isSublistOf([[1]], [false, [1]])', 'Bool', true], ['length([1, true])', 'Int', 2],
    ['asBool(head([false]))', 'Bool', false], ['tail([])', 'List', []], ['fst(("x", false))', 'String', 'x'], ['snd(("x", false))', 'Bool', false],
    ['([1], false) == ([1], false)', 'Bool', true], ['[1, 2] != [2, 1]', 'Bool', true], ['true and not false', 'Bool', true], ['true xor false', 'Bool', true], ['false implies true', 'Bool', true], ['true iff false', 'Bool', false],
  ];
  for (const [text, sort, expected] of cases) expect(parseMethodValue(text, sort)).toEqual(expected);
  expect(() => parseMethodValue('asInt(head([true]))', 'Int')).toThrow();
});
