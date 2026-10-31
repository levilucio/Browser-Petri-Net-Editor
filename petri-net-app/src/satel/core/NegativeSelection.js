import { compilePublicNet } from '../../domain/apn/PublicMethods.js';
import { parseSymbolicSource } from './SymbolicSource.js';
import { createConstraintSearch } from './GenericSubuniformity.js';
import { refusalConstraints, parameterRange } from './RefusalConstraints.js';
import { symbolicToValue, valueToSymbolic, validBuiltinValue } from '../../utils/builtin-values.js';
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
  const explicitTargets = options.negativeTargets !== undefined;
  if (explicitTargets && !Array.isArray(options.negativeTargets)) throw new DomainError('invalid-options', 'Negative targets must be an array');
  const seeds = new Map(suite.selectedTests.map(seed => [seed.id, seed]));
  const eligible = seed => seed && !seed.formula && !seed.branchingSequence && !seed.pairs.some(p => p.assertion === 'blocked' || !p.stimulation.method);
  const targets = explicitTargets ? copy(options.negativeTargets) : suite.selectedTests.filter(eligible).flatMap(seed => seed.pairs.map((p, index) => ({ seedId: seed.id, prefixLength: index, method: p.stimulation.method })));
  for (const target of targets) {
    const seed = seeds.get(target?.seedId), method = compiled.methods.find(m => m.name === target?.method);
    if (!eligible(seed) || !Number.isInteger(target.prefixLength) || target.prefixLength < 0 || target.prefixLength > seed.pairs.length || !method) throw new DomainError('invalid-options', 'Negative target needs an admitted positive seed, valid prefix length and method');
    const domains = target.parameterDomains ?? {};
    if (!domains || typeof domains !== 'object' || Array.isArray(domains) || Object.keys(domains).some(name => !method.parameters.some(p => p.name === name))) throw new DomainError('invalid-options', 'Unknown negative target parameter');
    for (const parameter of method.parameters) if (Object.hasOwn(domains, parameter.name)) {
      const values = domains[parameter.name];
      if (!Array.isArray(values) || !values.length || values.some(value => !validBuiltinValue(value, parameter.sort))) throw new DomainError('invalid-options', 'Negative parameter domains must contain well-sorted values');
    }
  }
  const report = { requestedTargets: targets.length, visitedTargets: 0, skippedCandidateDuplicates: 0, scoped: explicitTargets, policy: explicitTargets ? 'one refused valuation per explicit prefix/method/domain target' : 'one refused valuation per selected positive prefix/call; terminal parameters range over their declared sorts', limits, candidates: [], attempts: [], unresolved: [], truncated: false, skippedDuplicates: 0 };
  const seen = new Set(), candidateKeys = new Set();
  const usedIds = new Set(suite.selectedTests.map(t => t.id));
  let visited = 0;
  for (const target of targets) {
      checkCancelled(options.signal);
      if (report.candidates.length >= limits.maxTests || report.attempts.length >= limits.maxAttempts) { report.truncated = true; break; }
      report.visitedTargets++;
      const seed = seeds.get(target.seedId), index = target.prefixLength;
      const prefix = seed.pairs.slice(0, index), methodName = target.method;
      const method = compiled.methods.find(m => m.name === methodName);
      const domains = target.parameterDomains ?? {};
      const orderedDomains = Object.fromEntries(method.parameters.filter(p => Object.hasOwn(domains, p.name)).map(p => [p.name, domains[p.name]]));
      const key = JSON.stringify([prefix, methodName, orderedDomains]);
      if (seen.has(key)) { report.skippedDuplicates++; continue; }
      seen.add(key);
      const attempt = { seedId: seed.id, pair: index + 1, method: methodName, ...(explicitTargets ? { parameterDomains: copy(orderedDomains), ...(target.label ? { label: target.label } : {}) } : {}) };
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
        const variables = Object.create(null), args = Object.create(null), domainConditions = [];
        method.parameters.forEach((p, i) => {
          const values = Object.hasOwn(domains, p.name) ? domains[p.name] : undefined;
          if (values?.length === 1) args[p.name] = valueToSymbolic(values[0]);
          else {
            variables[`arg${i}`] = p.sort; args[p.name] = { var: `arg${i}` };
            if (values) domainConditions.push(values.map(value => ({ op: '==', left: args[p.name], right: valueToSymbolic(value) })).reduce((left, right) => ({ op: 'or', left, right })));
          }
        });
        const before = seed.referenceMarkings?.[index];
        if (!before) throw new DomainError('missing-evidence', 'Negative selection requires admitted prefix markings');
        const marking = Object.fromEntries(Object.entries(before).map(([id, tokens]) => [id, tokens.map(valueToSymbolic)]));
        const refusal = refusalConstraints(compiled.plans[methodName], marking, args, algebra, tick, { ...options, checkIndex });
        const conditions = [...method.parameters.flatMap(p => parameterRange(args[p.name], p.sort)), ...domainConditions, ...refusal.conditions];
        const result = await search.witness({ algebra, variables, conditions }, { maxTimeMs: Math.max(1, deadline - Date.now()) });
        checkCancelled(options.signal);
        attempt.rules = refusal.evidence;
        if (result.status === 'unknown') {
          attempt.status = 'unresolved'; attempt.reason = result.unresolved.map(u => u.reason).join('; ');
          report.unresolved.push(copy(attempt));
        } else if (result.status === 'unsat') {
          attempt.status = 'no-refusal'; attempt.reason = explicitTargets ? 'No refused call exists within this target parameter scope in the completed search.' : 'No well-sorted refused call exists at this prefix in the completed search.';
        } else {
          const argumentsMap = Object.fromEntries(method.parameters.map((p, i) => [p.name, Object.hasOwn(domains, p.name) && domains[p.name].length === 1 ? copy(domains[p.name][0]) : symbolicToValue(result.witness.witnessBindings[`arg${i}`])]));
          attempt.status = 'selected';
          const candidateKey = JSON.stringify([prefix, methodName, argumentsMap]);
          if (candidateKeys.has(candidateKey)) { attempt.status = 'duplicate-candidate'; report.skippedCandidateDuplicates++; continue; }
          candidateKeys.add(candidateKey);
          let id = `${seed.id}-refusal-${index + 1}`;
          while (usedIds.has(id)) id += '-companion';
          usedIds.add(id);
          report.candidates.push({ id, pairs: [...copy(prefix), { assertion: 'blocked', stimulation: { method: methodName, arguments: argumentsMap }, observation: { scope: 'public', outputs: Object.fromEntries(io.outputs.map(id => [id, []])) } }],
            negativeSelection: { ...copy(attempt), policy: report.policy, terminalConstraints: explicitTargets ? 'declared sorts and recorded target domains; seed conditions apply only to the frozen prefix' : 'declared parameter sorts only; seed conditions apply to the frozen prefix', expectedMarking: copy(before) } });
        }
      } catch (error) {
        if (error.code === 'cancelled') throw error;
        attempt.status = 'unresolved'; attempt.reason = error.message; attempt.diagnostic = diagnostic(error, 'negative-selection');
        report.unresolved.push(copy(attempt));
        if (error.code === 'resource-limit') { report.truncated = true; break; }
      }
      if (Date.now() >= deadline) { report.truncated = true; break; }
  }
  report.unvisitedTargets = targets.length - report.visitedTargets;
  if (explicitTargets) report.policy = 'one refused valuation per explicit prefix/method/domain target';
  report.visited = visited;
  report.scope = 'Bounded negative companions; no exhaustive negative or subuniformity coverage claim.';
  return report;
}
