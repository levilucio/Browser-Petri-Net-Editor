import { getContext } from './context';
import { buildZ3Expr, collectVariables } from './builders';
import { evaluateArithmeticWithBindings } from './eval-arith';
import { evaluateBooleanWithBindings } from './booleanEvaluator';
import { parseBooleanExpr } from './booleanParser';

export async function evaluateBooleanPredicate(
  boolAstOrString,
  bindings,
  parseArithmetic
) {
  const { ctx } = await getContext();
  const { Int, Bool, Solver, And, Not, Or } = ctx;
  const ast =
    typeof boolAstOrString === 'string'
      ? parseBooleanExpr(boolAstOrString, parseArithmetic)
      : boolAstOrString;

  const intVars = new Set();
  const boolVars = new Set();

  const collect = (node) => {
    if (!node) return;
    switch (node.type) {
      case 'boolVar':
        boolVars.add(node.name);
        break;
      case 'and':
      case 'or':
        collect(node.left);
        collect(node.right);
        break;
      case 'not':
        collect(node.expr);
        break;
      case 'cmp': {
        const addArith = (t) => {
          if (!t) return;
          if (t.type === 'var') intVars.add(t.name);
          if (t.type === 'bin') {
            addArith(t.left);
            addArith(t.right);
          }
        };
        addArith(node.left);
        addArith(node.right);
        break;
      }
      default:
        break;
    }
  };

  collect(ast);

  const intSym = new Map(Array.from(intVars).map((v) => [v, Int.const(v)]));
  const boolSym = new Map(Array.from(boolVars).map((v) => [v, Bool.const(v)]));

  const buildBool = (node) => {
    switch (node.type) {
      case 'boolLit':
        return node.value ? Bool.val(true) : Bool.val(false);
      case 'boolVar':
        return boolSym.get(node.name);
      case 'boolFuncall': {
        if (node.name === 'isSubstringOf' && node.args && node.args.length === 2) {
          try {
            const sub = evaluateArithmeticWithBindings(node.args[0], bindings || {});
            const str = evaluateArithmeticWithBindings(node.args[1], bindings || {});
            if (typeof sub !== 'string' || typeof str !== 'string') {
              throw new Error('isSubstringOf requires two string arguments');
            }
            return str.includes(sub) ? Bool.val(true) : Bool.val(false);
          } catch (_) {
            try {
              const str1 = buildZ3Expr(ctx, node.args[1], (n) => intSym.get(n));
              const sub = buildZ3Expr(ctx, node.args[0], (n) => intSym.get(n));
              return str1.contains(sub);
            } catch (error) {
              return Bool.val(false);
            }
          }
        }
        throw new Error(`Unknown boolean function '${node.name}'`);
      }
      case 'not':
        return Not(buildBool(node.expr));
      case 'and':
        return And(buildBool(node.left), buildBool(node.right));
      case 'or':
        return Or(buildBool(node.left), buildBool(node.right));
      case 'cmp': {
        const canBuildIntTerm = (t) =>
          t && (t.type === 'int' || t.type === 'var' || t.type === 'bin' || t.type === 'binop');
        if (canBuildIntTerm(node.left) && canBuildIntTerm(node.right)) {
          const buildArith = (term) => {
            if (term.type === 'int') return Int.val(term.value);
            if (term.type === 'var') return intSym.get(term.name);
            if (term.type === 'bin' || term.type === 'binop') {
              const left = buildArith(term.left);
              const right = buildArith(term.right);
              switch (term.op) {
                case '+':
                  return left.add(right);
                case '-':
                  return left.sub(right);
                case '*':
                  return left.mul(right);
                case '/':
                  return left.div(right);
                default:
                  throw new Error('Unknown arithmetic operator');
              }
            }
            throw new Error('Unknown arithmetic AST in bool comparison');
          };
          const left = buildArith(node.left);
          const right = buildArith(node.right);
          switch (node.op) {
            case '==':
              return left.eq(right);
            case '!=':
              return Not(left.eq(right));
            case '<':
              return left.lt(right);
            case '<=':
              return left.le(right);
            case '>':
              return left.gt(right);
            case '>=':
              return left.ge(right);
            default:
              throw new Error(`Unsupported predicate operator '${node.op}'`);
          }
        }
        const pure = evaluateBooleanWithBindings(
          { type: 'cmp', op: node.op, left: node.left, right: node.right },
          bindings || {},
          parseArithmetic
        );
        return pure ? Bool.val(true) : Bool.val(false);
      }
      default:
        throw new Error(`Unknown bool AST node '${node.type}'`);
    }
  };

  const solver = new Solver();
  try {
    let timeout = 10000;
    try {
      if (
        typeof window !== 'undefined' &&
        window.__Z3_SETTINGS__ &&
        typeof window.__Z3_SETTINGS__.solverTimeoutMs === 'number'
      ) {
        timeout = window.__Z3_SETTINGS__.solverTimeoutMs | 0;
      }
    } catch (_) {}
    solver.set('timeout', timeout);
  } catch (_) {}

  if (bindings && typeof bindings === 'object') {
    const equalities = [];
    for (const [name, value] of Object.entries(bindings)) {
      if (intSym.has(name) && typeof value === 'number') {
        equalities.push(intSym.get(name).eq(Int.val(value | 0)));
      } else if (boolSym.has(name) && typeof value === 'boolean') {
        equalities.push(boolSym.get(name).eq(value ? Bool.val(true) : Bool.val(false)));
      }
    }
    if (equalities.length) {
      solver.add(And(...equalities));
    }
  }

  solver.add(buildBool(ast));
  const result = await solver.check();
  return String(result) === 'sat';
}

