import { normalizeTest, publicInterface } from '../core/TestCase.js';
import { checkObservation } from '../core/Observations.js';
import { checkInterface } from '../core/SequenceRunner.js';
import { enumerateMethodSuccessors, markingKey, isMethodRule } from '../../domain/apn/PublicMethods.js';
import { validBuiltinValue } from '../../utils/builtin-values.js';
import { copy } from '../../domain/snapshots.js';
import { checkCancelled, DomainError } from '../../domain/diagnostics.js';

/** Derive bounded, marking-preserving observation experiments after a refusal.
 * These are trace plans, NOT sequences extending the terminal-refusal HML syntax.
 * The caller supplies finite candidate calls; the APN supplies every outcome.
 * No SUT information is used, and no compatible reference state is discarded.
 */
export function derivePostRefusalProbes({ referenceNet, io = publicInterface(referenceNet), test, probeCalls }, options = {}) {
  if (!['algebraic', 'algebraic-int'].includes(referenceNet.mode) || !referenceNet.transitions.length || referenceNet.transitions.some(t => !isMethodRule(t))) {
    throw new DomainError('unsupported-model', 'Post-refusal probes require synchronous public-method APNs');
  }
  checkInterface(referenceNet, io);
  const source = normalizeTest(test, io);
  const invalid = message => { throw new DomainError('invalid-test', message); };
  if (source.formula || source.pairs.at(-1)?.assertion !== 'blocked') invalid('Post-refusal probes require a terminal-refusal sequence');
  if (source.pairs.some(p => Object.keys(p.observation.markings || {}).length || Object.keys(p.observation.outputs || {}).some(id => !io.outputs.includes(id)))) {
    invalid('Probe seeds must use public observations only; hidden markings cannot narrow black-box alternatives');
  }
  if (!Array.isArray(probeCalls)) invalid('Supply a finite list of probe calls');
  const limits = { maxStates: 512, maxBindings: 10000, maxTotalBindings: 100000, maxProbes: 64, maxTimeMs: 10000 };
  for (const key of Object.keys(limits)) {
    limits[key] = options[key] ?? limits[key];
    if (!Number.isInteger(limits[key]) || limits[key] < 1) throw new DomainError('invalid-options', `${key} must be a positive integer`);
  }
  const exhausted = message => { throw new DomainError('resource-limit', message); };
  if (probeCalls.length > limits.maxProbes) exhausted('Probe candidate budget reached');
  const candidates = copy(probeCalls), started = Date.now();
  let bindingVisits = 0;
  const budget = () => {
    checkCancelled(options.signal);
    if (Date.now() - started > limits.maxTimeMs) exhausted('Post-refusal probe time budget reached');
  };
  for (const call of [...source.pairs.map(p => p.stimulation), ...candidates]) {
    const method = io.methods.find(m => m.name === call?.method);
    if (!method || !call.arguments || JSON.stringify(Object.keys(call.arguments).sort()) !== JSON.stringify(method.parameters.map(p => p.name).sort())
      || method.parameters.some(p => !validBuiltinValue(call.arguments[p.name], p.sort))) invalid('Invalid probe or seed method call');
  }
  const search = (state, call) => {
    budget();
    const result = enumerateMethodSuccessors(state, call.method, call.arguments, {
      maxBindings: limits.maxBindings, signal: options.signal,
      onVisit: () => { budget(); if (++bindingVisits > limits.maxTotalBindings) exhausted('Post-refusal total binding budget reached'); }
    });
    if (!result.complete) exhausted(result.reason || 'Incomplete reference successor search');
    return result.successors;
  };
  const marking = state => Object.fromEntries(state.places.map(p => [p.id, p.valueTokens]));
  const outputs = produced => Object.fromEntries(io.outputs.map(p => [p, copy(produced[p] || [])]));
  let states = [copy(referenceNet)];
  for (const pair of source.pairs) {
    const next = new Map();
    for (const state of states) {
      const successors = search(state, pair.stimulation);
      if (pair.assertion === 'blocked') {
        // A selected single refusing branch is insufficient for this experiment.
        if (successors.length) invalid('The terminal call is enabled in a compatible reference state');
        if (!checkObservation(pair.observation, marking(state), outputs({})).success) invalid('Refusal marking assertion does not hold');
        next.set(markingKey(state), state);
      } else {
        for (const edge of successors) if (checkObservation(pair.observation, marking(edge.next), edge.produced).success) next.set(markingKey(edge.next), edge.next);
      }
      if (next.size > limits.maxStates) exhausted('Compatible reference state budget reached');
    }
    if (!next.size) invalid('Seed observations have no compatible reference execution');
    states = [...next.values()];
  }
  const probes = [], rejected = [];
  for (const [index, call] of candidates.entries()) {
    const outcomes = new Map();
    let unavailable = false, changesState = false;
    for (const state of states) {
      const successors = search(state, call);
      unavailable ||= successors.length === 0;
      for (const edge of successors) {
        changesState ||= markingKey(state) !== markingKey(edge.next);
        const outcome = { status: 'accepted', outputs: outputs(edge.produced) };
        outcomes.set(JSON.stringify(outcome), outcome);
      }
    }
    if (unavailable || changesState) rejected.push({ index, stimulation: call, reason: unavailable ? 'not-enabled-in-every-state' : 'changes-reference-marking' });
    else probes.push({ index, stimulation: call, expected: [...outcomes.values()] });
  }
  return { schemaVersion: 1, kind: 'post-refusal-trace-plan', sourceTestId: source.id,
    refusalStep: source.pairs.length, prefixCalls: source.pairs.map(p => copy(p.stimulation)),
    compatibleStates: states.length, probes, rejected, complete: true,
    stats: { bindingVisits, durationMs: Date.now() - started } };
}
