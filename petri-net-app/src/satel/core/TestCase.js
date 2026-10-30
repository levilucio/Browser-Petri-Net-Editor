import { getGates, observationChannels } from '../../domain/apn/Gates.js';
import { validateFormula } from './HmlFormula.js';
import { getPublicMethods } from '../../domain/apn/PublicMethods.js';
import { copy } from '../../domain/snapshots.js';
import { DomainError } from '../../domain/diagnostics.js';

/**
 * Canonical test: ordered pairs with a fixed stimulation and observation.
 * observation.scope = 'listed' checks only named places; 'public' checks every
 * public output, including explicit empty bags. Markings are separate assertions.
 * assertion = 'required' | 'blocked'; it never inverts an entire test verdict.
 */
export function publicInterface(net) {
  const outputs = observationChannels(net).filter(p => p.io_type === 'output');
  return {
    methods: getPublicMethods(net).map(({
      name,
      parameters
    }) => ({
      name,
      parameters
    })),
    ...(net.gates ? { gates: copy(getGates(net)) } : {}),
    outputs: outputs.map(p => p.id),
    outputSorts: Object.fromEntries(outputs.map(p => [p.id, p.sort]))
  };
}
export function normalizeTest(test, io) {
  if (typeof test?.id !== 'string' || !test.id) throw new DomainError('invalid-test', 'A nonempty test ID is required');
  if (test.testType === 'negative') throw new DomainError('unsupported-negative-test', 'Legacy whole-test verdict inversion is unsupported. Specify a blocked pair explicitly; use a positive prefix and a final refused call.');
  if (test.formula) {
    validateFormula(test.formula);
    if (test.expectedTruth !== undefined && typeof test.expectedTruth !== 'boolean') throw new DomainError('invalid-test', 'Expected property truth must be boolean');
    if (test.pairs?.length || test.steps?.length) throw new DomainError('invalid-test', 'Use a property or a sequence, not both');
    return { ...copy(test), ...(io ? { interface: copy(io) } : {}), schemaVersion: 8, expectedTruth: test.expectedTruth ?? true, pairs: [] };
  }
  let pairs = test.pairs;
  if (!pairs) {
    if (!Array.isArray(test.steps) || !Array.isArray(test.expected) || test.steps.length !== test.expected.length) {
      throw new DomainError('invalid-test', 'Malformed test: one expected observation per stimulation is required');
    }
    pairs = test.steps.map((stimulation, i) => ({
      stimulation,
      observation: {
        outputs: test.expected[i],
        scope: 'public'
      }
    }));
  }
  if (!Array.isArray(pairs) || !pairs.length) throw new DomainError('invalid-test', 'A nonempty pair sequence is required');
  if (test.pairs && test.steps && JSON.stringify(test.steps) !== JSON.stringify(test.pairs.map(p => p.stimulation))) throw new DomainError('invalid-test', 'Conflicting legacy steps and canonical pairs');
  if (test.pairs && test.expected && JSON.stringify(test.expected) !== JSON.stringify(test.pairs.map(p => p.observation.outputs))) throw new DomainError('invalid-test', 'Conflicting legacy expectations and canonical pairs');
  pairs = pairs.map((pair, index) => {
    if (!pair.stimulation || !pair.observation) throw new DomainError('invalid-test', 'Each pair requires a stimulation and an observation');
    const scope = pair.observation.scope || 'listed';
    if (!['listed', 'public'].includes(scope)) throw new DomainError('invalid-test', 'Unknown observation scope');
    const assertion = pair.assertion || (pair.observation.type === 'notEnabled' ? 'blocked' : 'required');
    if (!['required', 'blocked'].includes(assertion)) throw new DomainError('unsupported-assertion', `Unsupported pair assertion: ${assertion}`);
    if (assertion === 'blocked') {
      if (index !== pairs.length - 1) throw new DomainError('invalid-test', 'A refused call must be the final pair');
      if (Object.values(pair.observation.outputs || {}).some(tokens => !Array.isArray(tokens) || tokens.length)) throw new DomainError('invalid-test', 'Refusal cannot expect produced tokens');
    }
    if (scope === 'public' && (!io?.outputs || JSON.stringify(Object.keys(pair.observation.outputs || {}).sort()) !== JSON.stringify([...io.outputs].sort()))) {
      throw new DomainError('invalid-test', 'Public observations must name every public output exactly once');
    }
    return {
      ...copy(pair),
      assertion,
      observation: {
        ...copy(pair.observation),
        scope
      }
    };
  });
  return {
    ...copy(test),
    ...(io ? {
      interface: copy(io)
    } : {}),
    schemaVersion: 7,
    pairs
  };
}
