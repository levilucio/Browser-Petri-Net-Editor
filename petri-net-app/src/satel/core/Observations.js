import { equalTokenBags } from '../../utils/builtin-values.js';
import { DomainError } from '../../domain/diagnostics.js';
import { equalValues } from '../../utils/value-equality.js';
export function checkObservation(observation, marking, producedTokens = {}) {
  const {
    outputs,
    markings
  } = observation;
  for (const place of Object.keys(markings || {})) {
    if (!Object.hasOwn(marking, place)) throw new Error(`Unknown observation place: ${place}`);
  }

  for (const id of Object.keys(outputs || {})) {
    if (!Object.hasOwn(marking, id) && !Object.hasOwn(producedTokens, id)) throw new Error(`Unknown observation channel: ${id}`);
  }
  // 1. Check output tokens (use produced tokens from this firing, not marking)
  for (const [place, expectedTokens] of Object.entries(outputs || {})) {
    // Only this firing's production is observable; old tokens are not new events.
    const actualTokens = producedTokens[place] || [];
    if (!tokensMatch(actualTokens, expectedTokens)) {
      return {
        success: false,
        reason: 'output_mismatch',
        place,
        expected: expectedTokens,
        actual: actualTokens
      };
    }
  }

  // 2. Check markings (optional)
  if (markings) {
    for (const [place, constraint] of Object.entries(markings)) {
      const tokens = marking[place] || [];
      if (!checkMarkingConstraint(tokens, constraint)) {
        return {
          success: false,
          reason: 'marking_constraint_failed',
          place,
          constraint,
          actual: tokens
        };
      }
    }
  }
  return {
    success: true
  };
}

/**
 * Check if actual tokens match expected tokens (deep equality)
 */
const tokensMatch = equalTokenBags;

/**
 * Check if marking satisfies constraint
 */
function checkMarkingConstraint(tokens, constraint) {
  if (!constraint || typeof constraint !== 'object' || Object.keys(constraint).length !== 1) throw new DomainError('invalid-test', 'Use one explicit marking assertion per place');
  const [kind] = Object.keys(constraint);
  if (!['equals', 'length', 'empty', 'contains'].includes(kind) || ['equals', 'contains'].includes(kind) && !Array.isArray(constraint[kind]) || kind === 'length' && (!Number.isInteger(constraint.length) || constraint.length < 0) || kind === 'empty' && typeof constraint.empty !== 'boolean') throw new DomainError('invalid-test', `Invalid marking assertion: ${kind}`);
  if (constraint.equals !== undefined) return tokensMatch(tokens, constraint.equals);
  if (constraint.length !== undefined) {
    return tokens.length === constraint.length;
  }
  if (constraint.empty !== undefined) {
    return constraint.empty ? tokens.length === 0 : tokens.length > 0;
  }
  if (constraint.contains !== undefined) {
    // Check if marking contains specified tokens
    const remaining = [...tokens];
    return constraint.contains.every(expected => {
      const index = remaining.findIndex(actual => equalValues(actual, expected));
      if (index < 0) return false;
      remaining.splice(index, 1);
      return true;
    });
  }
  return true;
}
