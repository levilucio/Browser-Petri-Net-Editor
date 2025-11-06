import * as z3Pool from '../../../utils/z3-remote.js';
import { evaluateBooleanPredicate as evaluateBooleanPredicateDirect } from '../../../utils/z3-arith.js';

export const evaluateBooleanPredicateWithPool = async (
  guardAst,
  env,
  parseArithmeticFn
) => {
  try {
    const poolEnabled = typeof z3Pool.isWorkerPoolEnabled === 'function'
      ? z3Pool.isWorkerPoolEnabled()
      : false;
    if (poolEnabled && typeof z3Pool.evaluateBooleanPredicate === 'function') {
      try {
        return await z3Pool.evaluateBooleanPredicate(
          guardAst,
          env,
          parseArithmeticFn
        );
      } catch (_) {
        // fall through to inline evaluation
      }
    }
  } catch (_) {}
  return evaluateBooleanPredicateDirect(guardAst, env, parseArithmeticFn);
};

export const deepCloneNet = (net) =>
  JSON.parse(JSON.stringify(net || { places: [], transitions: [], arcs: [] }));

export const getUnboundBooleanGuardVars = (ast, env) => {
  const names = new Set();

  const collect = (node) => {
    if (!node) return;
    switch (node.type) {
      case 'boolVar':
      case 'pairVar':
        names.add(node.name);
        break;
      case 'and':
      case 'or':
        collect(node.left);
        collect(node.right);
        break;
      case 'not':
        collect(node.expr);
        break;
      case 'cmp':
        collectArith(node.left);
        collectArith(node.right);
        break;
      default:
        break;
    }
  };

  const collectArith = (arithAst) => {
    if (!arithAst) return;
    if (arithAst.type === 'var' || arithAst.type === 'boolVar' || arithAst.type === 'pairVar') {
      names.add(arithAst.name);
    } else if (arithAst.type === 'bin') {
      collectArith(arithAst.left);
      collectArith(arithAst.right);
    } else if (arithAst.type === 'pairLit') {
      collectArith(arithAst.fst);
      collectArith(arithAst.snd);
    }
  };

  collect(ast);
  const bound = new Set(Object.keys(env || {}));
  return Array.from(names).filter((name) => !bound.has(name));
};

export const computeCacheSignature = (net) => {
  try {
    const transitions = Array.isArray(net?.transitions) ? net.transitions.slice() : [];
    const arcs = Array.isArray(net?.arcs) ? net.arcs.slice() : [];
    transitions.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    arcs.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const tSig = transitions
      .map((t) => `${t.id}|g:${String(t.guard || '')}|a:${String(t.action || '')}`)
      .join(';');
    const aSig = arcs
      .map((a) =>
        `${a.id}|b:${
          Array.isArray(a.bindings)
            ? a.bindings.join(',')
            : a.binding
            ? String(a.binding)
            : ''
        }`
      )
      .join(';');
    return `${tSig}||${aSig}`;
  } catch (_) {
    return String(Math.random());
  }
};

