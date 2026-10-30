import { cacheDiagnostics, hmlCacheEnabled } from './HmlCacheDiagnostics.js';
import { and, eq, implies, valueValid } from './HmlTerms.js';

/** Construction-local rule calculations, not successor states or HML verdicts.
 * Keys preserve input token order because picks contain token indices. A prefix
 * includes all preceding input arcs and method arguments, hence multiplicity and
 * shared-variable matching. Unread places are never copied into a cached result.
 */
export function createHmlRuleEffects(places, expression, tick, stats, options = {}) {
  const rules = new WeakMap();
  const reuseEffects = hmlCacheEnabled(options, 'ruleEffects'), reusePrefixes = hmlCacheEnabled(options, 'bindingPrefixes');
  const reuse = reuseEffects || reusePrefixes;
  const profile = cacheDiagnostics(options, stats, 'rules');
  Object.assign(stats, { ruleCacheHits: 0, bindingCacheHits: 0, bindingPrefixArcsReused: 0, effectReplays: 0 });
  return function* effects(plan, args, marking) {
    tick('ruleLookup'); stats.ruleRequests++;
    const root = () => ({ bindings: [{ env: args, picks: [], matching: true }], children: new Map() });
    let entry = root(), callRoot = entry, start = 0, keys = [];
    if (reuse) {
      if (!rules.has(plan)) rules.set(plan, new Map());
      const calls = rules.get(plan);
      const key = profile.measure('key', () => JSON.stringify(Object.entries(args).sort(([a], [b]) => a.localeCompare(b))));
      if (!calls.has(key)) { calls.set(key, entry); profile.retain('argumentRoots'); }
      entry = callRoot = profile.measure('lookup', () => calls.get(key));
      keys = plan.ins.map(input => profile.measure('key', () => JSON.stringify(marking[input.place])));
      profile.measure('lookup', () => {
        while (start < plan.ins.length && entry.children.has(keys[start])) entry = entry.children.get(keys[start++]);
      });
    }
    if (reuseEffects && entry.effects) {
      stats.ruleCacheHits++;
      for (const event of entry.effects) {
        tick('effectReplay'); stats.effectReplays++;
        yield event;
      }
      return;
    }
    // Effect-only mode may traverse the trie to find complete results, but must
    // enumerate from the root when that lookup misses.
    if (!reusePrefixes) { start = 0; entry = callRoot; }
    if (start) { stats.bindingCacheHits++; stats.bindingPrefixArcsReused += start; }
    else stats.bindingVisits++;
    for (let i = start; i < plan.ins.length; i++) {
      const input = plan.ins[i], bindings = [];
      profile.measure('bindingComputation', () => {
        for (const { env, picks, matching } of entry.bindings) {
          const seen = new Set();
          for (const [j, token] of marking[input.place].entries()) {
            const tokenKey = JSON.stringify(token);
            if (picks.some(p => p.place === input.place && p.index === j) || seen.has(tokenKey)) continue;
            seen.add(tokenKey);
            tick('binding'); stats.bindingVisits++;
            const matches = and(matching, Object.hasOwn(env, input.variable) ? eq(env[input.variable], token) : true);
            if (matches !== false) bindings.push({ env: { ...env, [input.variable]: token }, picks: [...picks, { place: input.place, index: j }], matching: matches });
          }
        }
      });
      const child = { bindings, children: new Map() };
      if (reuse) {
        // Preserve completed descendants in effect-only mode.
        const old = entry.children.get(keys[i]);
        if (old) child.children = old.children;
        entry.children.set(keys[i], child);
        if (!old) { profile.retain('prefixes'); profile.retain('bindingRecords', bindings.length); }
      }
      entry = child;
    }
    const events = [];
    for (const { env, picks, matching } of entry.bindings) {
      const event = profile.measure('effectComputation', () => {
        stats.guardEvaluations++;
        const guard = plan.guard === null || plan.guard === undefined ? { term: true, safe: true } : expression(plan.guard, env, plan.variables, 'Bool');
        const event = { guardSafety: implies(matching, guard.safe), enabled: and(matching, guard.term), picks };
        if (event.enabled !== false) {
          const produced = {}, safety = [];
          for (const output of plan.outs) {
            const sort = places.get(output.place).sort, v = expression(output.ast, env, plan.variables, sort);
            safety.push(v.safe, valueValid(v.term, sort));
            (produced[output.place] ||= []).push(v.term);
          }
          const stateProduced = { ...produced };
          for (const gate of plan.gates || []) {
            const v = expression(gate.ast, env, plan.variables, gate.sort);
            safety.push(v.safe);
            gate.args.forEach((arg, i) => {
              const sort = gate.declaration.parameters[i].sort, p = expression(arg, env, plan.variables, sort);
              safety.push(p.safe, valueValid(p.term, sort));
            });
            (produced[gate.gate] ||= []).push(v.term);
          }
          Object.assign(event, { produced, stateProduced, outputSafety: implies(event.enabled, and(...safety)) });
        }
        return event;
      });
      if (reuseEffects) events.push(event);
      yield event;
    }
    // A stopped/failed iterator never publishes an incomplete rule calculation.
    if (reuseEffects) { entry.effects = events; profile.retain('effectEvents', events.length); }
  };
}
