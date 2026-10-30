import { validObservationValue, observationChannels } from '../../domain/apn/Gates.js';
import { enumerateMethodSuccessors, markingKey, isMethodRule, getPublicMethods, compilePublicNet } from '../../domain/apn/PublicMethods.js';
import { checkInterface } from './SequenceRunner.js';
import { initialMarkingOf } from './InitialMarking.js';
import { checkObservation } from './Observations.js';
import { validateFormula, mapFormula } from './HmlFormula.js';
import { validBuiltinValue } from '../../utils/builtin-values.js';
import { checkCancelled, DomainError, diagnostic } from '../../domain/diagnostics.js';
import { copy } from '../../domain/snapshots.js';
import { explainProperty } from './HmlExplanation.js';

/** Three-valued bounded model checking. Errors are separate from logical false/unknown.
 * Successor caches never identify states by observations alone. Evaluation is lazy,
 * so a witness/counterexample can decide a modality without exploring every continuation.
 */
export async function evaluateFormula(formula, sourceNet, io, options = {}) {
  formula = copy(formula);
  validateFormula(formula);
  const net = copy(sourceNet), maxTotalBindings = options.maxTotalBindings ?? 100000, maxNodes = options.maxFormulaNodes ?? 5000, maxTimeMs = options.maxFormulaTimeMs ?? 10000;
  if (![maxNodes, maxTimeMs, maxTotalBindings].every(n => Number.isInteger(n) && n > 0)) throw new DomainError('invalid-test', 'Property budgets must be positive integers');
  if (!['algebraic', 'algebraic-int'].includes(net.mode) || !net.transitions.length || net.transitions.some(t => !isMethodRule(t))) throw new DomainError('unsupported-model', 'Branching properties require an algebraic net with public methods only');
  if (io) checkInterface(net, io);
  const methods = getPublicMethods(net);
  compilePublicNet(net);
  for (const p of net.places) if (!Array.isArray(p.valueTokens) || p.tokens !== p.valueTokens.length || !p.valueTokens.every(v => validBuiltinValue(v, p.sort))) throw new DomainError('invalid-model', `Invalid marking at ${p.id}`);
  // Preflight every label, including unreachable branches: malformed tests cannot pass vacuously.
  mapFormula(formula, node => {
    if (node.op === 'marking') {
      for (const [id, c] of Object.entries(node.markings)) checkObservation({ outputs: {}, markings: { [id]: c } }, initialMarkingOf(net));
      return node;
    }
    const m = methods.find(m => m.name === node.stimulation.method), args = node.stimulation.arguments;
    if (!m || JSON.stringify(Object.keys(args).sort()) !== JSON.stringify(m.parameters.map(p => p.name).sort()) || m.parameters.some(p => !validBuiltinValue(args[p.name], p.sort))) throw new DomainError('invalid-test', 'Invalid method signature or argument in property');
    if (node.observation) {
      for (const [id, tokens] of Object.entries(node.observation.outputs)) {
        const p = observationChannels(net).find(p => p.id === id);
        if (!p || !tokens.every(t => validObservationValue(net, id, t))) throw new DomainError('invalid-test', `Invalid property observation at ${id}`);
      }
      if (node.observation.scope === 'public' && (!io || JSON.stringify(Object.keys(node.observation.outputs).sort()) !== JSON.stringify([...io.outputs].sort()))) throw new DomainError('invalid-test', 'Public observations must list every public output');
      // Exercise validation of marking predicates independently of their truth value.
      for (const [id, c] of Object.entries(node.observation.markings || {})) {
        checkObservation({ outputs: {}, markings: { [id]: c } }, initialMarkingOf(net));
      }
    }
    return node;
  });
  const started = Date.now(), cache = new Map();
  let totalBindings = 0;
  const checkedStates = new WeakMap();
  const stats = { evaluatedNodes: 0, successorSearches: 0, bindingVisits: 0, cacheHits: 0, formulaCacheHits: 0, incompleteSearches: 0 };
  const budget = () => {
    checkCancelled(options.signal);
    if (Date.now() - started > maxTimeMs) throw new DomainError('resource-limit', 'Property time budget reached');
  };
  const visit = async (node, state, path) => {
    budget();
    if (++stats.evaluatedNodes > maxNodes) return { op: node.op, value: null, reason: 'Property node budget reached', path };
    if (stats.evaluatedNodes % 32 === 0) { await new Promise(resolve => setTimeout(resolve, 0)); budget(); }
    const result = { op: node.op, path, value: null };
    if (node.op === 'marking') {
      const marking = initialMarkingOf(state);
      const observationCheck = checkObservation({ outputs: {}, markings: node.markings }, marking);
      return { ...result, value: observationCheck.success, marking, observationCheck };
    }
    if (node.op === 'true' || node.op === 'false') return { ...result, value: node.op === 'true' };
    if (node.op === 'not') {
      const child = await safeVisit(node.child, state, `${path}.1`);
      return { ...result, value: child.value === null ? null : !child.value, children: [child] };
    }
    if (node.children) {
      result.children = [];
      const decisive = node.op === 'or';
      for (const [i, child] of node.children.entries()) {
        const checked = await safeVisit(child, state, `${path}.${i + 1}`);
        result.children.push(checked);
        if (checked.value === decisive) return { ...result, value: decisive };
      }
      return { ...result, value: result.children.some(c => c.value === null) ? null : !decisive };
    }
    const key = JSON.stringify([markingKey(state), node.stimulation.method, Object.entries(node.stimulation.arguments).sort()]);
    let edges = cache.get(key);
    if (!edges) {
      edges = enumerateMethodSuccessors(state, node.stimulation.method, node.stimulation.arguments, { ...options, onVisit: () => { budget(); if (++totalBindings > maxTotalBindings) throw new DomainError('resource-limit', 'Property total binding budget reached'); } });
      stats.successorSearches++; stats.bindingVisits += edges.visited;
      if (!edges.complete) stats.incompleteSearches++;
      cache.set(key, edges);
    } else stats.cacheHits++;
    Object.assign(result, { stimulation: copy(node.stimulation), beforeMarking: initialMarkingOf(state), complete: edges.complete, successorCount: edges.successors.length, branches: [], rejectedBranches: [] });
    if (!edges.complete) result.reason = edges.reason;
    const decisive = node.op === 'diamond';
    for (const [index, edge] of edges.successors.entries()) {
      const marking = initialMarkingOf(edge.next);
      const observationCheck = node.observation ? checkObservation(node.observation, marking, edge.produced) : { success: true };
      const branch = { outcome: index + 1, transitionId: edge.transitionId, binding: copy(edge.env), marking, produced: copy(edge.produced), observationCheck };
      if (node.excludeObservation ? observationCheck.success : !observationCheck.success) {
        result.rejectedBranches.push(branch);
        continue;
      }
      const child = await safeVisit(node.child, edge.next, `${path}.${result.branches.length + 1}`);
      result.branches.push({ ...branch, child });
      if (child.value === decisive) return { ...result, value: decisive };
    }
    return { ...result, value: !edges.complete || result.branches.some(b => b.child.value === null) ? null : !decisive };
  };
  const safeVisit = async (...args) => {
    try {
      checkCancelled(options.signal);
      const [node, state, path] = args, key = markingKey(state);
      const previous = checkedStates.get(node)?.get(key);
      if (previous) {
        stats.formulaCacheHits++;
        return { op: node.op, path, value: previous.value, reusedFrom: previous.path };
      }
      const result = await visit(...args);
      if (result.value !== null) {
        if (!checkedStates.has(node)) checkedStates.set(node, new Map());
        checkedStates.get(node).set(key, { value: result.value, path });
      }
      return result;
    } catch (e) {
      if (e.code !== 'resource-limit') throw e;
      return { op: args[0].op, path: args[2], value: null, reason: e.message };
    }
  };
  const evidence = await safeVisit(formula, net, '1');
  return { value: evidence.value, evidence, initialMarking: initialMarkingOf(net), stats: { ...stats, durationMs: Date.now() - started } };
}
export async function replayProperty(test, net, io, options = {}) {
  try {
    if (test.initialMarking !== undefined) throw new DomainError('invalid-test', 'Property tests use the model initial marking');
    const result = await evaluateFormula(test.formula, net, io, options);
    const expected = test.expectedTruth ?? true;
    const explanation = explainProperty(test.formula, result, expected);
    return { id: test.id, testCaseId: test.id, verdict: result.value === null ? 'inconclusive' : result.value === expected ? 'pass' : 'fail',
      reason: explanation.summary, propertyExplanation: explanation,
      expectedTruth: expected, actualTruth: result.value, propertyResult: result, pairResults: [], markings: [initialMarkingOf(net)], annotations: [] };
  } catch (error) {
    if (error.code === 'cancelled') throw error;
    return { id: test.id, testCaseId: test.id, verdict: 'error', reason: error.message, error: error.message,
      diagnostic: diagnostic(error, 'property-replay'), pairResults: [], markings: [initialMarkingOf(net)], annotations: [] };
  }
}
