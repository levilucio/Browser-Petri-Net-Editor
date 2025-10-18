import * as z3 from '../utils/z3/index.js';
import { parseArithmetic } from '../utils/arith-parser.js';

const ops = {
  parseBooleanExpr: (s) => z3.parseBooleanExpr(s),
  evaluateBooleanPredicate: (astOrStr, env) => z3.evaluateBooleanPredicate(astOrStr, env, parseArithmetic),
  evaluateArithmeticWithBindings: (astOrStr, env) => z3.evaluateArithmeticWithBindings(astOrStr, env, parseArithmetic),
  evaluateAction: async (text, env) => {
    // Re-implement minimal evaluateAction in worker to avoid circular re-export
    if (!text || typeof text !== 'string') return {};
    const result = {};
    for (const part of text.split(',')) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      const left = part.slice(0, eqIdx).trim();
      const right = part.slice(eqIdx + 1).trim();
      if (!left) continue;
      const ast = parseArithmetic(right);
      result[left] = await z3.evaluateArithmeticWithBindings(ast, env, parseArithmetic);
    }
    return result;
  },
  solveEquation: (l, r) => z3.solveEquation(l, r),
  solveInequality: (l, r) => z3.solveInequality(l, r),
};

self.onmessage = async (e) => {
  const { id, op, args } = e.data || {};
  try {
    if (!id) throw new Error('missing id');
    if (!ops[op]) throw new Error('unknown op ' + op);
    const fn = ops[op];
    const res = await fn(...(args || []));
    self.postMessage({ id, ok: true, result: res });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message || err) });
  }
};


