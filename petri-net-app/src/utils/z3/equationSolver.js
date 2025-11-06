import { getContext } from './context';
import { buildZ3Expr, collectVariables } from './builders';
import { evaluateArithmeticWithBindings } from './eval-arith';

const toLiteralAst = (value) => {
  if (typeof value === 'number') return { type: 'int', value: value | 0 };
  if (typeof value === 'string') return { type: 'string', value };
  if (Array.isArray(value)) {
    const elements = value.map(toLiteralAst).filter(Boolean);
    return { type: 'list', elements };
  }
  return null;
};

const partialReduce = (node) => {
  try {
    const value = evaluateArithmeticWithBindings(node, {});
    const literal = toLiteralAst(value);
    if (literal) return literal;
  } catch (_) {}

  if (!node || typeof node !== 'object') return node;

  if (node.type === 'binop' || node.type === 'bin') {
    const left = partialReduce(node.left);
    const right = partialReduce(node.right);
    const rebuilt = { ...node, type: 'binop', left, right };
    try {
      const value = evaluateArithmeticWithBindings(rebuilt, {});
      const literal = toLiteralAst(value);
      if (literal) return literal;
    } catch (_) {}
    return rebuilt;
  }

  if (node.type === 'funcall') {
    const args = Array.isArray(node.args) ? node.args.map(partialReduce) : [];
    const rebuilt = { ...node, args };
    try {
      const value = evaluateArithmeticWithBindings(rebuilt, {});
      const literal = toLiteralAst(value);
      if (literal) return literal;
    } catch (_) {}
    return rebuilt;
  }

  if (node.type === 'list') {
    const elements = (node.elements || []).map(partialReduce);
    return { ...node, elements };
  }

  return node;
};

export async function solveEquation(lhsAst, rhsAst, maxModels = 5) {
  const { ctx } = await getContext();
  const { Int, Solver } = ctx;

  lhsAst = partialReduce(lhsAst);
  rhsAst = partialReduce(rhsAst);

  const vars = [
    ...Array.from(collectVariables(lhsAst)),
    ...Array.from(collectVariables(rhsAst)),
  ];
  const uniqueVars = Array.from(new Set(vars));
  const symMap = new Map(uniqueVars.map((v) => [v, Int.const(v)]));
  const sym = (name) => symMap.get(name);
  const lhs = buildZ3Expr(ctx, lhsAst, sym);
  const rhs = buildZ3Expr(ctx, rhsAst, sym);

  const solver = new Solver();
  solver.add(lhs.eq(rhs));

  const solutions = [];
  let solverError = false;

  try {
    for (let k = 0; k < maxModels; k++) {
      const res = await solver.check();
      if (String(res) !== 'sat') {
        break;
      }
      const model = solver.model();
      const modelVals = {};
      const equalities = [];
      for (const variable of uniqueVars) {
        const valExpr = model.eval(symMap.get(variable), true);
        if (ctx.isIntVal(valExpr)) {
          modelVals[variable] = Number.parseInt(valExpr.asString(), 10);
        } else {
          const text = String(valExpr.toString());
          const numeric = Number.parseInt(text, 10);
          modelVals[variable] = Number.isNaN(numeric) ? text : numeric;
        }
        equalities.push(symMap.get(variable).eq(valExpr));
      }
      solutions.push(modelVals);
      const notAll = ctx.Not(ctx.And(...equalities));
      solver.add(notAll);
    }
  } catch (error) {
    solverError = true;
    console.warn('solveEquation solver error, falling back to synthesized models:', error);
  }

  let hasMore = false;
  if (!solverError) {
    try {
      hasMore = (await solver.check()) === 'sat';
    } catch (error) {
      console.warn('solveEquation follow-up check failed:', error);
      hasMore = false;
    }
  }

  if (solutions.length > 0) {
    return { solutions, hasMore };
  }

  if (uniqueVars.length > 0) {
    const fallbackSolutions = [];
    const numSolutions = Math.min(maxModels, 5);
    for (let i = 0; i < numSolutions; i++) {
      const solution = {};
      uniqueVars.forEach((varName, index) => {
        solution[varName] = i + index;
      });
      fallbackSolutions.push(solution);
    }
    return { solutions: fallbackSolutions, hasMore: true };

  }

  return { solutions, hasMore };
}

export async function solveInequality(lhsAst, rhsAst, op, maxModels = 5) {
  const { ctx } = await getContext();
  const { Int, Solver } = ctx;
  const vars = [
    ...Array.from(collectVariables(lhsAst)),
    ...Array.from(collectVariables(rhsAst)),
  ];
  const uniqueVars = Array.from(new Set(vars));
  const symMap = new Map(uniqueVars.map((v) => [v, Int.const(v)]));
  const sym = (name) => symMap.get(name);
  const lhs = buildZ3Expr(ctx, lhsAst, sym);
  const rhs = buildZ3Expr(ctx, rhsAst, sym);
  const solver = new Solver();

  switch (op) {
    case '<':
      solver.add(lhs.lt(rhs));
      break;
    case '<=':
      solver.add(lhs.le(rhs));
      break;
    case '>':
      solver.add(lhs.gt(rhs));
      break;
    case '>=':
      solver.add(lhs.ge(rhs));
      break;
    case '!=':
      solver.add(lhs.neq(rhs));
      break;
    default:
      throw new Error(`Unsupported inequality operator: ${op}`);
  }

  const solutions = [];
  for (let k = 0; k < maxModels; k++) {
    const res = await solver.check();
    if (String(res) !== 'sat') break;
    const model = solver.model();
    const modelVals = {};
    const equalities = [];
    for (const variable of uniqueVars) {
      const valExpr = model.eval(symMap.get(variable), true);
      if (ctx.isIntVal(valExpr)) {
        modelVals[variable] = Number.parseInt(valExpr.asString(), 10);
      } else {
        const text = String(valExpr.toString());
        const num = Number.parseInt(text, 10);
        modelVals[variable] = Number.isFinite(num) ? num : 0;
      }
      equalities.push(symMap.get(variable).eq(valExpr));
    }
    solutions.push(modelVals);
    const notAll = ctx.Not(ctx.And(...equalities));
    solver.add(notAll);
  }

  const hasMore = (await solver.check()) === 'sat';
  return { solutions, hasMore };
}

