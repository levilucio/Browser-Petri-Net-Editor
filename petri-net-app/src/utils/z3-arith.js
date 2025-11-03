export { getContext } from './z3/context.js';
export { buildZ3Expr, collectVariables } from './z3/builders.js';
export { evaluateArithmetic, evaluateArithmeticWithBindings, evaluateTermWithBindings } from './z3/eval-arith.js';
export { parseBooleanExpr, evaluateBooleanWithBindings, evaluateBooleanPredicate, parsePredicate, solveInequality } from './z3/eval-bool.js';

// Use direct Z3 import to avoid worker WASM loading issues
export async function solveEquation(lhs, rhs, maxModels = 5) {
  const { solveEquation: directSolveEquation } = await import('./z3/eval-bool.js');
  return await directSolveEquation(lhs, rhs, maxModels);
}

// Note: keep evaluateArithmeticWithBindings synchronous (re-exported above) to
// match existing tests and code paths; ADT uses `await` safely on a sync value.

// Keep evaluateAction available as a convenience export for callers that depend on it.
// This uses the parseArithmetic from arith-parser and the shared arithmetic evaluator.
import { evaluateArithmeticWithBindings as _evalArithWithBindings } from './z3/eval-arith.js';
import { evaluateBooleanPredicate as _evaluateBooleanPredicate } from './z3/eval-bool.js';
import { parseArithmetic as _parseArithmetic } from './arith-parser';

export function evaluateAction(actionString, bindings, parseArithmetic = _parseArithmetic) {
  if (!actionString || typeof actionString !== 'string') return {};
  const result = {};
  const parts = actionString.split(',');
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const left = part.slice(0, eqIdx).trim();
    const right = part.slice(eqIdx + 1).trim();
    if (!left) continue;
    const ast = parseArithmetic(right);
    result[left] = _evalArithWithBindings(ast, bindings);
  }
  return result;
}

// Backwards-compatibility alias for callers still importing evaluatePredicate
export function evaluatePredicate(boolAstOrString, bindings, parseArithmetic = _parseArithmetic) {
  return _evaluateBooleanPredicate(boolAstOrString, bindings, parseArithmetic);
}
