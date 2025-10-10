export * from './z3/index.js';

// Keep evaluateAction available as a convenience export for callers that depend on it.
// This uses the parseArithmetic from arith-parser and the shared arithmetic evaluator.
import { evaluateArithmeticWithBindings as _evalArithWithBindings } from './z3/eval-arith';
import { evaluateBooleanPredicate as _evaluateBooleanPredicate } from './z3/eval-bool';
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
