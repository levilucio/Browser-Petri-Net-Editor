// Optional adapter-local measurements. Each request owns its clock so concurrent
// requests cannot overwrite one another's phase. Timings are elapsed, not CPU.
const phaseNames = ['create', 'encode', 'parse', 'handles', 'check', 'decode', 'validate', 'preferenceRefute', 'preferenceSetup', 'preferenceCheck', 'cleanup', 'other'];
const phases = () => Object.fromEntries(phaseNames.map(name => [name, 0]));
export function createSolverProfile(clock = () => performance.now()) {
  const mode = () => ({ queries: 0, ms: 0, phases: phases(), outcomes: {} });
  const stats = { backendQueries: 0, backendMs: 0, phases: phases(), byMode: { witness: mode(), check: mode() },
    mainChecks: {}, preferenceChecks: {}, preferenceRefutationAttempts: 0, preferenceRefutations: 0, cacheWitnessChecks: 0, cacheValidationMs: 0 };
  return {
    snapshot: () => JSON.parse(JSON.stringify(stats)),
    validateCached(validate, query, bindings) {
      const start = clock(); stats.cacheWitnessChecks++;
      try { return validate(query, bindings); }
      finally { stats.cacheValidationMs += clock() - start; }
    },
    start(witness) {
      const group = stats.byMode[witness ? 'witness' : 'check'];
      stats.backendQueries++; group.queries++;
      let last = clock(), current = 'create', finished = false;
      const account = () => {
        const now = clock(), elapsed = now - last; last = now;
        stats.phases[current] += elapsed; group.phases[current] += elapsed;
        stats.backendMs += elapsed; group.ms += elapsed;
      };
      return {
        phase(name) {
          if (finished) return;
          account(); current = name;
        },
        refutation(proved) {
          stats.preferenceRefutationAttempts++;
          if (proved) stats.preferenceRefutations++;
        },
        checked(status, preferred = false) {
          const counts = preferred ? stats.preferenceChecks : stats.mainChecks;
          counts[status] = (counts[status] || 0) + 1;
        },
        finish(outcome) {
          if (finished) return;
          account(); finished = true;
          group.outcomes[outcome] = (group.outcomes[outcome] || 0) + 1;
        }
      };
    }
  };
}
