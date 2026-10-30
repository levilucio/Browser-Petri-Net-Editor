import { compilePublicNet } from '../../domain/apn/PublicMethods.js';
import { parseSymbolicSource } from './SymbolicSource.js';
import { createConstraintSearch } from './GenericSubuniformity.js';
import { refusalConstraints, parameterRange } from './RefusalConstraints.js';
import { symbolicToValue, valueToSymbolic } from '../../utils/builtin-values.js';
import { checkCancelled, DomainError, diagnostic } from '../../domain/diagnostics.js';
import { copy } from '../../domain/snapshots.js';

/** Bounded companion policy, NOT an inferred subuniformity partition.
 * Keep an admitted prefix and its observations fixed. At each selected position,
 * replace that call's arguments by one well-sorted refused valuation, and end.
 * The final call is deliberately free of the seed intention's value constraints.
 * Every proposed test must still pass the common reference admission. */
export async function selectNegativeCompanions(suite, options = {}) {
  const { referenceNet: net, interface: io } = suite;
  const limits = { maxTests: 10, maxAttempts: 40, maxTimeMs: 20000, maxBindings: 10000, ...(options.negativeLimits || {}) };
  for (const [key, value] of Object.entries(limits)) if (!Number.isSafeInteger(value) || value < 1) throw new DomainError('invalid-options', `Negative search ${key} must be a positive integer`);
  const compiled = compilePublicNet(net), algebra = parseSymbolicSource('');
  const search = await createConstraintSearch(algebra, options);
  const deadline = Date.now() + limits.maxTimeMs;
  const report = { policy: 'one refused valuation per selected positive prefix/call; terminal parameters range over their declared sorts', limits, candidates: [], attempts: [], unresolved: [], truncated: false, skippedDuplicates: 0 };
  const seen = new Set();
  const usedIds = new Set(suite.selectedTests.map(t => t.id));
  let visited = 0;
  outer: for (const seed of suite.selectedTests) {
    if (seed.formula || seed.branchingSequence || seed.pairs.some(p => p.assertion === 'blocked' || !p.stimulation.method)) continue;
    for (let index = 0; index < seed.pairs.length; index++) {
      checkCancelled(options.signal);
      const prefix = seed.pairs.slice(0, index), methodName = seed.pairs[index].stimulation.method;
      const key = JSON.stringify([prefix, methodName]);
      if (seen.has(key)) { report.skippedDuplicates++; continue; }
      seen.add(key);
      if (report.candidates.length >= limits.maxTests || report.attempts.length >= limits.maxAttempts) { report.truncated = true; break outer; }
      const attempt = { seedId: seed.id, pair: index + 1, method: methodName };
      report.attempts.push(attempt);
      try {
        const checkIndex = () => {
          checkCancelled(options.signal);
          if (Date.now() >= deadline) throw new DomainError('resource-limit', 'Negative selection budget exhausted');
        };
        const tick = () => {
          checkIndex();
          if (++visited > limits.maxBindings) throw new DomainError('resource-limit', 'Negative selection budget exhausted');
        };
        tick();
        const method = compiled.methods.find(m => m.name === methodName);
        const variables = Object.fromEntries(method.parameters.map((p, i) => [`arg${i}`, p.sort]));
        const args = Object.fromEntries(method.parameters.map((p, i) => [p.name, { var: `arg${i}` }]));
        const before = seed.referenceMarkings?.[index];
        if (!before) throw new DomainError('missing-evidence', 'Negative selection requires admitted prefix markings');
        const marking = Object.fromEntries(Object.entries(before).map(([id, tokens]) => [id, tokens.map(valueToSymbolic)]));
        const refusal = refusalConstraints(compiled.plans[methodName], marking, args, algebra, tick, { ...options, checkIndex });
        const conditions = [...method.parameters.flatMap(p => parameterRange(args[p.name], p.sort)), ...refusal.conditions];
        const result = await search.witness({ algebra, variables, conditions }, { maxTimeMs: Math.max(1, deadline - Date.now()) });
        checkCancelled(options.signal);
        attempt.rules = refusal.evidence;
        if (result.status === 'unknown') {
          attempt.status = 'unresolved'; attempt.reason = result.unresolved.map(u => u.reason).join('; ');
          report.unresolved.push(copy(attempt));
        } else if (result.status === 'unsat') {
          attempt.status = 'no-refusal'; attempt.reason = 'No well-sorted refused call exists at this prefix in the completed search.';
        } else {
          const argumentsMap = Object.fromEntries(method.parameters.map((p, i) => [p.name, symbolicToValue(result.witness.witnessBindings[`arg${i}`])]));
          attempt.status = 'selected';
          let id = `${seed.id}-refusal-${index + 1}`;
          while (usedIds.has(id)) id += '-companion';
          usedIds.add(id);
          report.candidates.push({ id, pairs: [...copy(prefix), { assertion: 'blocked', stimulation: { method: methodName, arguments: argumentsMap }, observation: { scope: 'public', outputs: Object.fromEntries(io.outputs.map(id => [id, []])) } }],
            negativeSelection: { ...copy(attempt), policy: report.policy, terminalConstraints: 'declared parameter sorts only; seed conditions apply to the frozen prefix', expectedMarking: copy(before) } });
        }
      } catch (error) {
        if (error.code === 'cancelled') throw error;
        attempt.status = 'unresolved'; attempt.reason = error.message; attempt.diagnostic = diagnostic(error, 'negative-selection');
        report.unresolved.push(copy(attempt));
        if (error.code === 'resource-limit') { report.truncated = true; break outer; }
      }
      if (Date.now() >= deadline) { report.truncated = true; break outer; }
    }
  }
  report.visited = visited;
  report.scope = 'Bounded negative companions; no exhaustive negative or subuniformity coverage claim.';
  return report;
}
