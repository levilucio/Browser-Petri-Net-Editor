import { evaluateArithmeticWithBindings } from './eval-arith';

export function evaluateBooleanWithBindings(ast, bindings, parseArithmetic) {
  const toBool = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (value && typeof value === 'object' && value.__pair__) return true;
    throw new Error('Non-bool binding in bool expression');
  };

  const tryEvalAnyTerm = (node) => {
    if (!node) throw new Error('Invalid term');
    if (node.type === 'int' || node.type === 'bin' || node.type === 'var') {
      try {
        return evaluateArithmeticWithBindings(node, bindings);
      } catch (_) {}
      if (node.type === 'var' && typeof bindings?.[node.name] !== 'undefined') {
        return bindings[node.name];
      }
    }
    if (node.type === 'boolLit') return !!node.value;
    if (node.type === 'boolVar') return !!(bindings?.[node.name]);
    if (node.type === 'pairVar') return bindings?.[node.name];
    if (node.type === 'pairLit') {
      return {
        __pair__: true,
        fst: tryEvalAnyTerm(node.fst),
        snd: tryEvalAnyTerm(node.snd),
      };
    }
    return evaluateArithmeticWithBindings(node, bindings);
  };

  const evalBool = (node) => {
    switch (node.type) {
      case 'boolLit':
        return !!node.value;
      case 'boolVar':
        return toBool(bindings?.[node.name]);
      case 'boolFuncall': {
        if (node.name === 'isSubstringOf' && node.args && node.args.length === 2) {
          const sub = evaluateArithmeticWithBindings(node.args[0], bindings || {});
          const str = evaluateArithmeticWithBindings(node.args[1], bindings || {});
          if (typeof sub !== 'string' || typeof str !== 'string') {
            throw new Error('isSubstringOf requires two string arguments');
          }
          return str.includes(sub);
        }
        throw new Error(`Unknown boolean function '${node.name}'`);
      }
      case 'not':
        return !evalBool(node.expr);
      case 'and':
        return evalBool(node.left) && evalBool(node.right);
      case 'or':
        return evalBool(node.left) || evalBool(node.right);
      case 'xor': {
        const left = evalBool(node.left);
        const right = evalBool(node.right);
        return (left && !right) || (!left && right);
      }
      case 'implies': {
        const left = evalBool(node.left);
        const right = evalBool(node.right);
        return (!left) || right;
      }
      case 'iff': {
        const left = evalBool(node.left);
        const right = evalBool(node.right);
        return left === right;
      }
      case 'cmp': {
        const left = tryEvalAnyTerm(node.left);
        const right = tryEvalAnyTerm(node.right);
        const eq = (a, b) => {
          if (
            a &&
            typeof a === 'object' &&
            a.__pair__ &&
            b &&
            typeof b === 'object' &&
            b.__pair__
          ) {
            return eq(a.fst, b.fst) && eq(a.snd, b.snd);
          }
          return a === b;
        };
        switch (node.op) {
          case '==':
            return eq(left, right);
          case '!=':
            return !eq(left, right);
          case '<':
            return left < right;
          case '<=':
            return left <= right;
          case '>':
            return left > right;
          case '>=':
            return left >= right;
          default:
            return false;
        }
      }
      default:
        throw new Error(`Unknown bool AST node '${node.type}'`);
    }
  };

  return evalBool(ast);
}

