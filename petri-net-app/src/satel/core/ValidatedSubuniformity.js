import { deriveSymbolicSubdomains } from './SymbolicSubuniformity.js';
import { copy, freeze } from '../../domain/snapshots.js';
import { checkCancelled } from '../../domain/diagnostics.js';
import { replayTest } from './Replay.js';
import { normalizeTest } from './TestCase.js';
export const replayOracleTest = replayTest;

/**
 * Derive symbolic subdomains BEFORE execution; instantiate one witness per
 * subdomain; encode it as public APN stimuli and expected observations;
 * replay supplied expectations before admission. Execution traces have
 * no role in defining the subdomains.
 */
export async function generateValidatedSubuniformitySuite({
  referenceNet,
  io,
  symbolicGoal,
  encodeWitness
}) {
  if (typeof encodeWitness !== 'function') throw new Error('An explicit symbolic-to-public-stimulus adapter is required');
  referenceNet = copy(referenceNet);
  io = copy(io);
  const goal = copy(symbolicGoal);
  const decomposition = deriveSymbolicSubdomains(goal);
  const candidates = decomposition.domains.map(domain => ({
    ...encodeWitness(copy(domain.witnessArgs), copy(domain.witnessResult)),
    id: domain.id,
    symbolicDomain: domain
  }));
  if (candidates.some(c => !c.expected)) throw new Error('The adapter must encode the equation result as expected public observations');
  const validated = await validateOracleCandidates({
    referenceNet,
    io,
    candidates
  });
  return freeze({
    schemaVersion: 3,
    executionSemantics: 'public-methods-with-model-initial-marking',
    scope: 'symbolic-conditional-equations-with-synchronous-nat-apn-adapter',
    symbolicGoal: goal,
    decomposition,
    interface: copy(io),
    referenceNet: copy(referenceNet),
    selectedTests: validated,
    validation: {
      generated: candidates.length,
      referencePassed: validated.length
    }
  });
}

/** Validate explicit concrete stimuli; this function does not partition them. */
export async function validateOracleCandidates({
  referenceNet,
  io,
  candidates,
  ...options
}) {
  if (!Array.isArray(candidates) || candidates.length === 0) throw new Error('Candidate domain must be nonempty');
  if (candidates.some(c => !c || typeof c.id !== 'string' || !c.id) || new Set(candidates.map(c => c.id)).size !== candidates.length) throw new Error('Candidate IDs must be nonempty and unique');
  // Capture the specification and interface at entry; no mutable caller state is
  // consulted after asynchronous work starts. Each replay starts from this net.
  const reference = copy(referenceNet),
    contract = io ? copy(io) : undefined,
    domain = copy(candidates);
  const validated = [];
  for (const candidate of domain) {
    checkCancelled(options.signal);
    if (candidate.initialMarking !== undefined && (candidate.steps || candidate.pairs?.map(p => p.stimulation) || []).some(s => s.method)) throw new Error("Method candidates cannot override the model initial marking");
    const canonical = normalizeTest(candidate, contract);
    const validation = await replayOracleTest(canonical, reference, contract, options);
    options.onValidation?.(validation);
    if (validation.verdict !== 'pass') throw new Error(`Reference validation failed for ${candidate.id}: ${validation.reason}`);
    const test = freeze({
      ...canonical,
      referenceInitialMarking: validation.markings[0],
      referenceMarkings: validation.markings,
      referenceAnnotations: validation.annotations,
      ...(validation.propertyResult ? { referencePropertyResult: validation.propertyResult } : {}),
      ...(validation.branchingSequence ? { branchingSequence: true } : {})
    });
    validated.push(test);
  }
  return freeze(validated);
}

/** No oracle generation occurs here; errors never count as mutant kills. */
export async function evaluateOracleSuite(tests, targetNet, io, options = {}) {
  if (!Array.isArray(tests) || tests.length === 0) throw new Error('Cannot evaluate an empty suite');
  if (new Set(tests.map(t => t.id)).size !== tests.length) throw new Error('Duplicate test IDs');
  const results = [];
  for (const [index, test] of tests.entries()) {
    checkCancelled(options.signal);
    options.onProgress?.({
      current: index + 1,
      total: tests.length,
      testCaseId: test.id
    });
    results.push(await replayOracleTest(test, targetNet, io, options));
  }
  const counts = {
    pass: 0,
    fail: 0,
    error: 0
  };
  results.forEach(r => { counts[r.verdict] = (counts[r.verdict] || 0) + 1; });
  return {
    counts,
    results
  };
}
export async function evaluateSpecMutants(suite, mutants, auditTests = null) {
  if (!Array.isArray(mutants) || mutants.some(m => !m?.id) || new Set(mutants.map(m => m.id)).size !== mutants.length) {
    throw new Error('Mutants require unique nonempty IDs');
  }
  const results = [];
  for (const mutant of mutants) {
    const selected = await evaluateOracleSuite(suite.selectedTests, mutant.net, suite.interface);
    const status = run => run.counts.error ? 'error' : run.counts.fail ? 'killed' : run.counts.inconclusive ? 'inconclusive' : 'survived';
    const result = {
      id: mutant.id,
      description: mutant.description,
      selected: {
        status: status(selected),
        ...selected
      }
    };
    if (auditTests) {
      const audit = await evaluateOracleSuite(auditTests, mutant.net, suite.interface);
      result.audit = {
        status: status(audit),
        ...audit
      };
    }
    results.push(result);
  }
  return results;
}
