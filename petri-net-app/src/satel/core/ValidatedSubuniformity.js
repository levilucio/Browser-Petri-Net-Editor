import { initialMarkingOf } from './InitialMarking.js';
import { observeBoundedTrace } from './BoundedOracleAdapter.js';
import { deriveSymbolicSubdomains } from './SymbolicSubuniformity.js';

const copy = value => JSON.parse(JSON.stringify(value));
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function validateTest(test, io) {
  if (!test || typeof test.id !== 'string' || !test.id || !Array.isArray(test.steps) || !test.steps.length ||
      !Array.isArray(test.expected) || test.expected.length !== test.steps.length) {
    throw new Error('Malformed test: nonempty ID, stimuli and one observation per step are required');
  }
  for (const observation of test.expected) {
    if (!observation || JSON.stringify(Object.keys(observation).sort()) !== JSON.stringify([...io.outputs].sort()) ||
        !Object.values(observation).every(tokens => Array.isArray(tokens) && tokens.length <= 1 &&
          tokens.every(n => Number.isInteger(n) && n >= 0 && n <= 2147483647))) {
      throw new Error('Malformed oracle: all public outputs must have singleton/empty Nat observations');
    }
  }
}

/** Replay a fixed oracle. Internal transition identity is not a verdict. */
export async function replayOracleTest(test, net, io) {
  try {
    validateTest(test, io);
    if (test.initialMarking !== undefined) throw new Error("Method tests cannot override the model initial marking");
    const execution = await observeBoundedTrace(net, io, test.steps);
    for (let i = 0; i < execution.observations.length; i++) {
      const actual = execution.observations[i];
      if (io.outputs.some(id => JSON.stringify(actual[id]) !== JSON.stringify(test.expected[i][id]))) {
        return { id: test.id, verdict: 'fail', reason: 'observation-mismatch', step: i + 1,
          expected: copy(test.expected[i]), actual, annotations: execution.annotations };
      }
    }
    if (execution.status === 'blocked') {
      return { id: test.id, verdict: 'fail', reason: 'request-blocked', step: execution.step,
        expected: copy(test.expected[execution.step - 1]), annotations: execution.annotations };
    }
    return { id: test.id, verdict: 'pass', annotations: execution.annotations };
  } catch (error) {
    return { id: test?.id, verdict: 'error', reason: error.message };
  }
}

/**
 * Derive symbolic subdomains BEFORE execution; instantiate one witness per
 * subdomain; encode it as public APN stimuli; record reference observations;
 * independently replay the frozen test before admission. Execution traces have
 * no role in defining the subdomains.
 */
export async function generateValidatedSubuniformitySuite({ referenceNet, io, symbolicGoal, encodeWitness }) {
  if (typeof encodeWitness !== 'function') throw new Error('An explicit symbolic-to-public-stimulus adapter is required');
  referenceNet = copy(referenceNet);
  io = copy(io);
  const goal = copy(symbolicGoal);
  const decomposition = deriveSymbolicSubdomains(goal);
  const candidates = decomposition.domains.map(domain => ({
    ...encodeWitness(copy(domain.witnessArgs), copy(domain.witnessResult)),
    id: domain.id, symbolicDomain: domain,
  }));
  if (candidates.some(c => !c.expected)) throw new Error('The adapter must encode the equation result as expected public observations');
  const validated = await validateOracleCandidates({ referenceNet, io, candidates });
  return freeze({
    schemaVersion: 3,
    executionSemantics: 'public-methods-with-model-initial-marking',
    scope: 'symbolic-conditional-equations-with-synchronous-nat-apn-adapter',
    symbolicGoal: goal,
    decomposition,
    interface: copy(io), referenceNet: copy(referenceNet),
    selectedTests: validated,
    validation: { generated: candidates.length, referencePassed: validated.length },
  });
}

/** Validate explicit concrete stimuli; this function does not partition them. */
export async function validateOracleCandidates({ referenceNet, io, candidates }) {
  if (!Array.isArray(candidates) || candidates.length === 0) throw new Error('Candidate domain must be nonempty');
  if (candidates.some(c => !c || typeof c.id !== 'string' || !c.id) ||
      new Set(candidates.map(c => c.id)).size !== candidates.length) throw new Error('Candidate IDs must be nonempty and unique');
  // Capture the specification and interface at entry; no mutable caller state is
  // consulted after asynchronous work starts. Each replay starts from this net.
  const reference = copy(referenceNet), contract = copy(io), domain = copy(candidates);
  const validated = [];
  for (const candidate of domain) {
    if (candidate.initialMarking !== undefined) throw new Error("Method candidates cannot override the model initial marking");
    const execution = await observeBoundedTrace(reference, contract, candidate.steps);
    if (execution.status !== 'completed') throw new Error(`Reference rejected candidate ${candidate.id} at step ${execution.step}`);
    const test = freeze({ ...candidate, referenceInitialMarking: initialMarkingOf(reference), referenceMarkings: execution.markings, steps: copy(candidate.steps),
      expected: copy(candidate.expected ?? execution.observations), referenceAnnotations: copy(execution.annotations) });
    const validation = await replayOracleTest(test, reference, contract);
    if (validation.verdict !== 'pass') throw new Error(`Reference validation failed for ${candidate.id}: ${validation.reason}`);
    validated.push(test);
  }
  return freeze(validated);
}

/** No oracle generation occurs here; errors never count as mutant kills. */
export async function evaluateOracleSuite(tests, targetNet, io) {
  if (!Array.isArray(tests) || tests.length === 0) throw new Error('Cannot evaluate an empty suite');
  if (new Set(tests.map(t => t.id)).size !== tests.length) throw new Error('Duplicate test IDs');
  const results = [];
  for (const test of tests) results.push(await replayOracleTest(test, targetNet, io));
  const counts = { pass: 0, fail: 0, error: 0 };
  results.forEach(r => counts[r.verdict]++);
  return { counts, results };
}

export async function evaluateSpecMutants(suite, mutants, auditTests = null) {
  if (!Array.isArray(mutants) || mutants.some(m => !m?.id) || new Set(mutants.map(m => m.id)).size !== mutants.length) {
    throw new Error('Mutants require unique nonempty IDs');
  }
  const results = [];
  for (const mutant of mutants) {
    const selected = await evaluateOracleSuite(suite.selectedTests, mutant.net, suite.interface);
    const status = run => run.counts.error ? 'error' : run.counts.fail ? 'killed' : 'survived';
    const result = { id: mutant.id, description: mutant.description,
      selected: { status: status(selected), ...selected } };
    if (auditTests) {
      const audit = await evaluateOracleSuite(auditTests, mutant.net, suite.interface);
      result.audit = { status: status(audit), ...audit };
    }
    results.push(result);
  }
  return results;
}
