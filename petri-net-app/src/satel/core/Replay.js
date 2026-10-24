import { replayProperty } from './HmlEvaluator.js';
import { sequenceFormula } from './HmlFormula.js';
import { equalTokenBags } from '../../utils/builtin-values.js';
import { runSequence } from './SequenceRunner.js';
import { normalizeTest } from './TestCase.js';
import { checkObservation } from './Observations.js';
import { validBuiltinValue } from '../../utils/builtin-values.js';
import { diagnostic } from '../../domain/diagnostics.js';

/** First decisive observation wins. Execution errors are never behavioral failures. */
export async function replayTest(source, net, io, options = {}) {
  io = io || (source?.interface?.outputs ? source.interface : undefined);
  const pairResults = [];
  let test, execution;
  try {
    test = normalizeTest(source, io);
    if (test.formula) return replayProperty(test, net, io, options);
    for (const {
      observation
    } of test.pairs) {
      for (const [id, tokens] of Object.entries(observation.outputs || {})) {
        const place = net.places.find(p => p.id === id);
        if (!place || !Array.isArray(tokens) || test.pairs[0].stimulation.method && !tokens.every(t => validBuiltinValue(t, io?.outputSorts?.[id] || place.sort))) throw new Error(`Malformed oracle observation at ${id}`);
      }
    }
    execution = await runSequence(net, test.pairs, io, {
      ...options,
      initialMarking: test.initialMarking,
      onStep(event, pair) {
        let checked;
        if (pair.assertion === 'blocked') checked = {
          success: !event.enabled,
          reason: pair.stimulation.method ? event.enabled ? 'method_unexpectedly_enabled' : 'method_correctly_blocked' : event.enabled ? 'transition_unexpectedly_enabled' : 'transition_correctly_not_enabled'
        };else if (!event.enabled) checked = {
          success: false,
          reason: pair.stimulation.method ? 'method_blocked' : 'transition_not_enabled'
        };else checked = checkObservation(pair.observation, event.marking, event.produced);
        if (pair.assertion === 'blocked' && checked.success) {
          const unchanged = Object.keys(event.previousMarking).length === Object.keys(event.marking).length && Object.entries(event.previousMarking).every(([id, tokens]) => equalTokenBags(tokens, event.marking[id] || []));
          if (!unchanged) checked = { success: false, reason: 'refusal_changed_marking' };
          else {
            const observation = checkObservation(pair.observation, event.marking, event.produced);
            if (!observation.success) checked = observation;
          }
        }
        pairResults.push({
          ...checked,
          phase: checked.success ? 'complete' : 'observation',
          marking: event.marking,
          producedTokens: event.produced,
          consumedTokens: event.consumed
        });
        return checked.success;
      }
    });
    const firstFailureIndex = pairResults.findIndex(r => !r.success),
      failed = firstFailureIndex >= 0;
    const result = {
      id: test.id,
      testCaseId: test.id,
      testType: test.testType,
      verdict: failed ? 'fail' : 'pass',
      pairResults,
      markings: execution.markings,
      annotations: execution.annotations,
      firstFailureIndex,
      summary: `${pairResults.filter(r => r.success).length}/${test.pairs.length} pairs succeeded`
    };
    if (failed) {
      const index = firstFailureIndex,
        r = pairResults[index];
      Object.assign(result, {
        step: index + 1,
        reason: r.reason === 'method_blocked' ? 'request-blocked' : r.reason === 'output_mismatch' ? 'observation-mismatch' : r.reason,
        expected: test.pairs[index].observation.outputs || {},
        actual: execution.events[index].outputs
      });
    }
    return result;
  } catch (error) {
    if (error.code === 'cancelled') throw error;
    if (error.code === 'unsupported-nondeterminism' && test?.pairs.every(p => p.stimulation.method)) {
      const result = await replayProperty({ ...test, formula: sequenceFormula(test.pairs) }, net, io, options);
      return { ...result, branchingSequence: true };
    }
    execution = error.execution;
    pairResults.push({
      success: false,
      phase: 'error',
      error: error.message
    });
    return {
      id: source?.id,
      testCaseId: source?.id,
      verdict: 'error',
      reason: error.message,
      error: error.message,
      diagnostic: diagnostic(error, 'replay'),
      step: error.step,
      pairResults,
      markings: execution?.markings || [],
      annotations: execution?.annotations || []
    };
  }
}
