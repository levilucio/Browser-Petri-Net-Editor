import { variablesIn } from '../algebra/SymbolicTerms.js';
import { foldGroundTerms } from '../algebra/GroundTerms.js';
import { evaluateMethodTerm } from './MethodTerms.js';

export function guardConjuncts(term) {
  return term?.op === 'and' ? [...guardConjuncts(term.left), ...guardConjuncts(term.right)]
    : term === null || term === undefined ? [] : [{term, variables:[...variablesIn(term)]}];
}
// Simultaneous substitution: inserted terms belong to the intention's scope.
export function instantiateKnown(term, env) {
  if (term?.var) return Object.hasOwn(env,term.var) ? env[term.var] : term;
  if (Array.isArray(term)) return term.map(t=>instantiateKnown(t,env));
  return term && typeof term==='object' ? Object.fromEntries(Object.entries(term).map(([k,v])=>[k,instantiateKnown(v,env)])) : term;
}
export function groundGuardIsFalse(checks,env,algebra) {
  return checks.some(({term,variables})=>variables.every(v=>Object.hasOwn(env,v)) && foldGroundTerms(instantiateKnown(term,env),algebra)===false);
}
// Only evaluate a bound prefix in concrete guards, preserving left-to-right
// short-circuit/error behavior. Errors remain for the full-binding evaluator.
export function boundGuardIsFalse(checks,env) {
  for(const {term,variables}of checks) {
    if(!variables.every(v=>Object.hasOwn(env,v)))return false;
    try { if(evaluateMethodTerm(term,env)===false)return true; }
    catch { return false; }
  }
  return false;
}
