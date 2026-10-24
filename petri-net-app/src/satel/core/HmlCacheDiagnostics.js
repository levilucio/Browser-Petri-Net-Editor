/** Internal experiment controls. Defaults preserve production caching. These
 * switches affect reuse only, never budgets, definedness or oracle admission. */
export const hmlCacheNames = ['ruleEffects', 'bindingPrefixes', 'expressions', 'operations', 'formulaStates'];
export const hmlCacheEnabled = (options, name) => options.hmlCaches?.[name] !== false;

/** Opt-in timing; normal GUI runs do not read the clock for every cache access.
 * Timings are inclusive wall time. Key characters and retained item counts are
 * structural measures, NOT heap bytes. A discarded construction has no report. */
export function cacheDiagnostics(options, stats, name) {
  if (!options.profileHmlCaches) return { measure: (_phase, action) => action(), retain: () => {} };
  const record = (stats.cacheProfile ||= {})[name] ||= { calls: {}, milliseconds: {}, keyCharacters: 0, retained: {} };
  return {
    measure(phase, action) {
      const start = performance.now();
      record.calls[phase] = (record.calls[phase] || 0) + 1;
      try {
        const result = action();
        if (phase === 'key' && typeof result === 'string') record.keyCharacters += result.length;
        return result;
      } finally { record.milliseconds[phase] = (record.milliseconds[phase] || 0) + performance.now() - start; }
    },
    retain(kind, count = 1) { record.retained[kind] = (record.retained[kind] || 0) + count; }
  };
}
