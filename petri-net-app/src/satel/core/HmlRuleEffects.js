import { and, eq, implies, valueValid } from './HmlTerms.js';

/** Construction-local rule calculations, not successor states or HML verdicts.
 * Keys preserve input token order because picks contain token indices. A prefix
 * includes all preceding input arcs and method arguments, hence multiplicity and
 * shared-variable matching. Unread places are never copied into a cached result.
 */
export function createHmlRuleEffects(places, expression, tick, stats) {
  const rules = new WeakMap();
  Object.assign(stats, { ruleCacheHits: 0, bindingCacheHits: 0, bindingPrefixArcsReused: 0, effectReplays: 0 });
  return function* effects(plan, args, marking) {
    tick('ruleLookup'); stats.ruleRequests++;
    if (!rules.has(plan)) rules.set(plan, new Map());
    const calls = rules.get(plan), key = JSON.stringify(Object.entries(args).sort(([a], [b]) => a.localeCompare(b)));
    if (!calls.has(key)) calls.set(key, { bindings: [{ env: args, picks: [], matching: true }], children: new Map() });
    let entry = calls.get(key), start = 0;
    const keys = plan.ins.map(input => JSON.stringify(marking[input.place]));
    while (start < plan.ins.length && entry.children.has(keys[start])) entry = entry.children.get(keys[start++]);
    if (entry.effects) {
      stats.ruleCacheHits++;
      for (const event of entry.effects) {
        tick('effectReplay'); stats.effectReplays++;
        yield event;
      }
      return;
    }
    if (start) { stats.bindingCacheHits++; stats.bindingPrefixArcsReused += start; }
    else stats.bindingVisits++;
    for (let i = start; i < plan.ins.length; i++) {
      const input = plan.ins[i], bindings = [];
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
      const child = { bindings, children: new Map() };
      entry.children.set(keys[i], child); entry = child;
    }
    const events = [];
    for (const { env, picks, matching } of entry.bindings) {
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
        Object.assign(event, { produced, outputSafety: implies(event.enabled, and(...safety)) });
      }
      events.push(event);
      yield event;
    }
    // A stopped/failed iterator never publishes an incomplete rule calculation.
    entry.effects = events;
  };
}
