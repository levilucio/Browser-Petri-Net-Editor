import { createTokenIndex } from '../../domain/apn/TokenIndex.js';
import { guardConjuncts, groundGuardIsFalse } from '../../domain/apn/BoundGuards.js';
import { foldGroundTerms } from './GroundTerms.js';
import { integerBounds } from '../../utils/builtin-values.js';

export const equalTerm = (left, right) => ({ op: '==', left, right });
export const conjoin = terms => terms.reduce((left, right) => ({ op: 'and', left, right }), true);
export const parameterRange = (term, sort) => ['Nat', 'Int'].includes(sort)
  ? [{ op: '>=', left: term, right: integerBounds(sort).min }, { op: '<=', left: term, right: integerBounds(sort).max }] : [];
export const instantiateLocals = (term, env) => term?.var ? env[term.var]
  : Array.isArray(term) ? term.map(t => instantiateLocals(t, env))
  : term && typeof term === 'object' ? Object.fromEntries(Object.entries(term).map(([k, v]) => [k, instantiateLocals(v, env)])) : term;

/** Refusal is the conjunction of the negated enabling conditions of EVERY
 * distinct input binding of EVERY rule. Finite token occurrences come from the
 * current marking. Output computation errors are not alternative refusal cases.
 * tick must throw on cancellation/resource exhaustion; no partial formula escapes. */
export function refusalConstraints(plans, marking, args, algebra, tick, options = {}) {
  const conditions = [], evidence = [];
  const tokenCandidates = options.tokenCandidates || createTokenIndex({ symbolic: true, algebra, check: options.checkIndex || tick });
  for (const plan of plans) {
    let bindings = 0, prunedBindings = 0, indexedOutOccurrences = 0;
    const checks=plan.guardChecks || guardConjuncts(plan.guard);
    function bind(i, env, picks, equalities) {
      tick();
      if (options.pruneGroundMethodGuards !== false && groundGuardIsFalse(checks,env,algebra)) { prunedBindings++; return; }
      if (i < plan.ins.length) {
        const input = plan.ins[i], seen = new Set();
        const candidates = tokenCandidates(marking[input.place], input.variable, checks, env, options.useTokenIndex !== false);
        if (Array.isArray(candidates)) indexedOutOccurrences += marking[input.place].length - candidates.length;
        for (const [tokenIndex, value] of candidates) {
          if (picks.some(p => p.place === input.place && p.tokenIndex === tokenIndex)) continue;
          const key = JSON.stringify(value);
          if (seen.has(key)) continue;
          seen.add(key);
          const extra = Object.hasOwn(env, input.variable) ? [equalTerm(env[input.variable], value)] : [];
          bind(i + 1, { ...env, [input.variable]: value }, [...picks, { place: input.place, tokenIndex }], [...equalities, ...extra]);
        }
        return;
      }
      bindings++;
      const enabled = conjoin([...equalities, ...(plan.guard !== null && plan.guard !== undefined ? [instantiateLocals(plan.guard, env)] : [])]);
      conditions.push(foldGroundTerms({ op: 'not', left: enabled }, algebra));
    }
    bind(0, args, [], []);
    evidence.push({ transitionId: plan.id, bindings, prunedBindings, indexedOutOccurrences });
  }
  return { conditions, evidence };
}
