/** @jest-environment node */
import { deriveIntention, generateIntention } from '../../satel/core/IntentionPipeline.js';
import { replayOracleTest, validateOracleCandidates, evaluateOracleSuite } from '../../satel/core/ValidatedSubuniformity.js';
import { createExerciseExample } from '../../satel/examples/exercises/editor.js';
import { accountNet, accountInterface } from '../../satel/examples/oracle-account/net.js';
import { compilePublicNet, prepareMethodCall } from '../../domain/apn/PublicMethods.js';
import { semanticFingerprint } from '../../domain/apn/SemanticNet.js';
import { findConstraintWitness } from '../../satel/core/GenericSubuniformity.js';
import { parseSymbolicSource } from '../../satel/core/SymbolicSource.js';

jest.setTimeout(30000);
const copy = x => JSON.parse(JSON.stringify(x));
const explicit = (outputs = { ack: [1] }) => ({ id: 'fixed', name: 'Fixed calls', testType: 'positive', variables: [],
  pairs: [{ stimulation: { method: 'deposit', arguments: { n: 3 } }, observation: { outputs } }] });

test('explicit and symbolic encodings share stepwise verdicts with declared observation scope', async () => {
  const { suite } = await generateIntention(explicit(), accountNet);
  const test = suite.selectedTests[0];
  expect(test.pairs[0].observation.scope).toBe('listed');
  const complete = { id: 'complete', steps: [{ method: 'deposit', arguments: { n: 3 } }], expected: [{ ack: [1], paidAmount: [], balanceResult: [] }] };
  expect((await replayOracleTest(complete, accountNet, accountInterface)).verdict).toBe('pass');
  const target = copy(accountNet);
  target.arcs.push({ id: 'extra-output', source: 'deposit', target: 'paidAmount', binding: 'n' });
  expect((await replayOracleTest(test, target, accountInterface)).verdict).toBe('pass');
  expect((await replayOracleTest(complete, target, accountInterface)).verdict).toBe('fail');
  const completePairs = { ...test, pairs: [{ ...test.pairs[0], observation: { scope: 'public', outputs: complete.expected[0] } }] };
  expect((await replayOracleTest(completePairs, target, accountInterface)).reason).toBe('observation-mismatch');
});

test('an early mismatch wins over a later nondeterministic method', async () => {
  const net = createExerciseExample('exercise-door-reference');
  const { suite } = await generateIntention(net.testIntentions[0], net);
  const mutant = createExerciseExample('exercise-door-ignore-jam');
  const reset = mutant.transitions.find(t => t.id === 'reset');
  mutant.transitions.push({ ...copy(reset), id: 'secondReset' });
  mutant.arcs.push(...mutant.arcs.filter(a => a.source === 'reset' || a.target === 'reset').map(a => ({ ...copy(a), id: a.id + '-second', source: a.source === 'reset' ? 'secondReset' : a.source, target: a.target === 'reset' ? 'secondReset' : a.target })));
  const test = suite.selectedTests.find(t => t.id.includes('onJammed'));
  const result = await replayOracleTest(test, mutant, suite.interface);
  expect(result).toMatchObject({ verdict: 'fail', reason: 'observation-mismatch', step: 2 });
  expect(result.pairResults).toHaveLength(2);
  expect(result.annotations).not.toContain('reset');
});

test('admission cannot silently record missing expectations', async () => {
  await expect(validateOracleCandidates({ referenceNet: accountNet, io: accountInterface,
    candidates: [{ id: 'no-oracle', steps: [{ method: 'query', arguments: {} }] }] })).rejects.toThrow(/expected observation/);
});

test('fixed values stay fixed and infeasible expectations reject the whole suite', async () => {
  const intention = explicit({ ack: [0] });
  const report = await deriveIntention(intention, accountNet);
  expect(report.candidates[0].pairs[0].stimulation.arguments).toEqual({ n: 3 });
  await expect(generateIntention(intention, accountNet)).rejects.toThrow('Reference validation failed');
});

test('class evidence keeps static witness separate from whole-sequence witness', async () => {
  const net = createExerciseExample('exercise-quota-reference');
  const report = await deriveIntention(net.testIntentions[0], net);
  const small = report.decomposition.domains.find(d => d.id === 'small');
  const selected = report.execution.selected.find(d => d.id === 'small');
  expect(small.witnessArgs).toEqual([1]);
  expect(selected.staticWitness.args).toEqual([1]);
  expect(selected.witnessArgs).toEqual([3]);
});

test('compiled definitions are reused across markings/layout, never freeze caller state, and invalidate on semantic edits', () => {
  const net = copy(accountNet), compiled = compilePublicNet(net);
  net.arcs[0].x = 25;
  net.places[0].valueTokens = [7];
  expect(compilePublicNet(net)).toBe(compiled);
  expect(Object.isFrozen(net.arcs[0])).toBe(false);
  const changed = copy(net); changed.transitions[0].guard = 'n > 0';
  expect(compilePublicNet(changed)).not.toBe(compiled);
  const call = prepareMethodCall(net, 'deposit', { n: 2 });
  expect(call.next.places.find(p => p.id === 'balance').valueTokens).toEqual([9]);
  expect(net.places[0].valueTokens).toEqual([7]);
});

test('fingerprints ignore layout but retain marking, guard and intention changes', () => {
  const net = copy(accountNet), original = semanticFingerprint(net, { intentions: true });
  net.places[0].x = 999;
  expect(semanticFingerprint(net, { intentions: true })).toBe(original);
  net.testIntentions = [explicit()];
  expect(semanticFingerprint(net, { intentions: true })).not.toBe(original);
  const before = semanticFingerprint(net);
  net.places[0].valueTokens = [2];
  expect(semanticFingerprint(net)).not.toBe(before);
});

test('single-witness solving distinguishes sat, unsat and solver uncertainty without overlap queries', async () => {
  const algebra = parseSymbolicSource('');
  const request = { algebra, variables: { n: 'Int' }, conditions: [{ op: '==', left: { var: 'n' }, right: 3 }] };
  const sat = await findConstraintWitness(request);
  expect(sat.status).toBe('sat');
  expect(sat.witness.witnessBindings.n).toBe(3);
  const unknown = await findConstraintWitness(request, { solve: async () => ({ status: 'unknown', reason: 'test timeout' }) });
  expect(unknown.status).toBe('unknown');
  const unsat = await findConstraintWitness({ ...request, conditions: [...request.conditions, { op: '==', left: { var: 'n' }, right: 4 }] });
  expect(unsat.status).toBe('unsat');
});

test('legacy negative inversion is rejected and cancellation is not a mutant kill', async () => {
  const test = { ...explicit(), testType: 'negative' };
  expect((await replayOracleTest(test, accountNet, accountInterface)).diagnostic.code).toBe('unsupported-negative-test');
  const controller = new AbortController(); controller.abort();
  await expect(evaluateOracleSuite([explicit()], accountNet, accountInterface, { signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' });
});

test('marking containment respects multiplicity', async () => {
  const test = explicit();
  test.pairs[0].observation.markings = { ack: { contains: [1, 1] } };
  expect((await replayOracleTest(test, accountNet, accountInterface)).verdict).toBe('fail');
});

test('finite selection enumerates every declared value rather than taking one solver model', async () => {
  const intention = explicit();
  intention.variables = [{ name: 'n', sort: 'Nat', hypothesis: { type: 'finite', values: [1, 3, 7] } }];
  intention.pairs[0].stimulation.arguments.n = '$n';
  const { suite } = await generateIntention(intention, accountNet);
  expect(suite.selectedTests.map(t => t.pairs[0].stimulation.arguments.n)).toEqual([1, 3, 7]);
});

test('the legacy transition transport uses common admission and records its actual declared setup', async () => {
  const { accountNet: tokenAccount } = await import('../../test-fixtures/satel/token-account.js');
  const intention = { id: 'legacy', name: 'Legacy fixed sequence', testType: 'positive', variables: [],
    initialMarking: { depositRequest: [7] }, pairs: [{ stimulation: { transition: 'deposit', inputs: { depositRequest: [7] } }, observation: { outputs: { ack: [1] } } }] };
  const { suite } = await generateIntention(intention, tokenAccount);
  expect(suite.validation.referencePassed).toBe(1);
  expect(suite.selectedTests[0].referenceInitialMarking.depositRequest).toEqual([7]);
});
