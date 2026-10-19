import { normalizeTest } from '../core/TestCase.js';
import { sequenceFormula } from '../core/HmlFormula.js';
import { checkObservation } from '../core/Observations.js';
import { equalValues } from '../../utils/value-equality.js';
import { copy } from '../../domain/snapshots.js';
import { DomainError } from '../../domain/diagnostics.js';

/** Modal paths guide experiments, not an equivalence-preserving compilation of HML
 * to traces. Each path is a separate reset. Never merge their hidden states. */
export function experimentsForTest(source, io, maxPaths = 64) {
  const test = normalizeTest(source, io);
  const formula = test.formula || sequenceFormula(test.pairs);
  const paths = new Map();
  function visit(node, calls) {
    if (node.children) return node.children.forEach(n => visit(n, calls));
    if (node.op === 'not') return visit(node.child, calls);
    if (node.stimulation) return visit(node.child, [...calls, copy(node.stimulation)]);
    const key = JSON.stringify(calls);
    if (!paths.has(key) && paths.size >= maxPaths) throw new DomainError('resource-limit', 'Too many experimental paths; simplify the property or increase maxPaths');
    paths.set(key, calls);
  }
  visit(formula, []);
  return { test, formula, paths: [...paths.values()] };
}

/** Evidence from ONE execution only. Unobserved alternatives are always unknown.
 * No invocation, including an explicit refusal, proves absence of other outcomes.
 * An observed edge witnesses diamond(true) or refutes box(false); boolean logic
 * composes this evidence without equating states from different runs. */
export function traceEvidence(formula, events, io, expectedTruth = true) {
  function visit(node, index) {
    if (node.op === 'true') return true;
    if (node.op === 'false') return false;
    if (node.op === 'marking') return Object.keys(node.markings).length ? null : true;
    if (node.op === 'not') { const v = visit(node.child, index); return v === null ? null : !v; }
    if (node.children) {
      const values = node.children.map(n => visit(n, index)), decisive = node.op === 'or';
      return values.includes(decisive) ? decisive : values.includes(null) ? null : !decisive;
    }
    const event = events[index];
    if (!event || event.response.status !== 'accepted' || node.stimulation.method !== event.stimulation.method
      || Object.keys(node.stimulation.arguments).length !== Object.keys(event.stimulation.arguments).length
      || Object.entries(node.stimulation.arguments).some(([key, value]) => !equalValues(value, event.stimulation.arguments[key]))) return null;
    if (node.observation) {
      // An output event is not a marking snapshot. Private predicates remain unknown.
      if (Object.keys(node.observation.markings || {}).length || Object.keys(node.observation.outputs).some(p => !io.outputs.includes(p))) return null;
      const matches = checkObservation(node.observation, Object.fromEntries(io.outputs.map(p => [p, []])), event.response.outputs).success;
      if (node.excludeObservation ? matches : !matches) return null;
    }
    const child = visit(node.child, index + 1);
    return node.op === 'diamond' ? child === true ? true : null : child === false ? false : null;
  }
  const value = visit(formula, 0);
  return { value, expectedTruth, verdict: value === null ? 'inconclusive' : value === expectedTruth ? 'witnessed' : 'counterexample',
    reason: value === null ? 'This execution cannot settle the property. Alternatives, refusals, or private markings may remain unobservable.'
      : value === expectedTruth ? 'This execution supplies decisive evidence for the required property polarity.'
        : 'This execution supplies decisive evidence against the required property polarity.' };
}
