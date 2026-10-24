import { DomainError } from '../diagnostics.js';
import { addBuiltins } from './BuiltinAlgebra.js';
import { elaborateTerm, evaluateGround, substitute, unify, variablesIn } from './SymbolicTerms.js';
const builtinAlgebra = addBuiltins({
  constructors: {},
  operations: {}
});
/** Evaluate an instantiated term using its oriented equations, including the
 * built-in equations. Ground evaluation never invents bindings for input data.
 * Ambiguous, undefined and nonterminating definitions remain errors. */
export function evaluateGroundTerm(term, algebra = builtinAlgebra, maxSteps = 10000) {
  if (variablesIn(term).size) throw new DomainError('not-ground', 'Term is not ground');
  let steps = 0;
  const definitions = new Map();
  const run = t => {
    if (++steps > maxSteps) throw new DomainError('resource-limit', 'Ground evaluation budget exhausted');
    if (t?.termGraph) return evaluateGround(t);
    if (t?.test || t?.field || t?.valid || t?.if !== undefined) return evaluateGround(t);
    if (t?.undefined) throw new DomainError('undefined-term', t.undefined);
    if (t?.ctor) return {
      ...t,
      args: t.args.map(run)
    };
    if (t?.op) {
      const left = run(t.left);
      if (t.op === 'and' && left === false) return false;
      if (t.op === 'or' && left === true || t.op === 'implies' && left === false) return true;
      return evaluateGround({
        ...t,
        left,
        ...(t.op === 'not' ? {} : {
          right: run(t.right)
        })
      });
    }
    if (!t?.call) return t;
    const args = t.args.map(run),
      signature = algebra.operations[t.call];
    if (!signature) throw new DomainError('unsupported-operation', `Unknown operation: ${t.call}`);
    if (signature.primitive) return evaluateGround({
      ...t,
      args
    });
    if (!definitions.has(t.call)) definitions.set(t.call, signature.rules.map(r => ({
      ...r,
      patterns: r.patterns.map((p, i) => elaborateTerm(p, r.variables || {}, algebra, signature.parameters[i])),
      result: elaborateTerm(r.result, r.variables || {}, algebra, signature.result),
      conditions: (r.conditions || []).map(c => elaborateTerm(c, r.variables || {}, algebra, 'Bool'))
    })));
    const matches = [];
    for (const rule of definitions.get(t.call)) {
      const bindings = new Map();
      if (rule.patterns.every((p, i) => unify(p, args[i], bindings)) && rule.conditions.every(c => run(substitute(c, bindings)) === true)) matches.push({
        rule,
        bindings
      });
    }
    if (matches.length !== 1) throw new DomainError(matches.length ? 'ambiguous-equations' : 'undefined-term', `Ground operation ${t.call} matched ${matches.length} equations`);
    return run(substitute(matches[0].rule.result, matches[0].bindings));
  };
  return run(elaborateTerm(term, {}, algebra));
}

/** Fold only ground subexpressions. Failed/undefined reductions stay symbolic
 * so the bounded narrowing engine retains responsibility for diagnostics.
 * This does not select paths, erase constraints or prune symbolic alternatives. */
export function foldGroundTerms(term, algebra) {
  if (!term || typeof term !== 'object') return term;
  // Graph nodes contain scoped references, not standalone ground terms. Keep
  // the graph intact for lazy concrete checking and scoped SMT translation.
  if (term.termGraph) return term;
  if (Array.isArray(term)) return term.map(t => foldGroundTerms(t, algebra));
  if (term.var) return term;
  // Preserve Any tags before reducing comparisons or projected components.
  if (!variablesIn(term).size && (term.call || term.op || term.ctor)) {
    try {
      return evaluateGroundTerm(term, algebra);
    } catch (error) {
      if (error instanceof TypeError || error instanceof ReferenceError) throw error;
      // A known reduction failure is retained for narrowing, never interpreted as false.
      return term;
    }
  }
  return Object.fromEntries(Object.entries(term).map(([k, v]) => [k, foldGroundTerms(v, algebra)]));
}
