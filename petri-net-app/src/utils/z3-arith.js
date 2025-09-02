// Lightweight Z3 wrapper to evaluate integer arithmetic AST using z3-solver WASM in browser
// We avoid introducing new architecture; this is a small utility.

let z3InitPromise = null;
let z3ScriptPromise = null;

async function ensureInitZ3Global() {
  if (typeof globalThis.initZ3 === 'function') return;
  if (!z3ScriptPromise) {
    z3ScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      // Served via Vite middleware from node_modules
      script.src = '/z3-built.js';
      script.async = true;
      script.onload = () => {
        if (typeof globalThis.initZ3 === 'function') resolve();
        else reject(new Error('z3-built.js loaded but initZ3 not found'));
      };
      script.onerror = () => reject(new Error('Failed to load z3-built.js'));
      document.head.appendChild(script);
    });
  }
  await z3ScriptPromise;
}

async function getContext() {
  if (!z3InitPromise) {
    z3InitPromise = (async () => {
      if (typeof SharedArrayBuffer === 'undefined') {
        throw new Error('Z3 is required but SharedArrayBuffer is not available. Ensure COOP/COEP headers are set.');
      }
      await ensureInitZ3Global();
      const { init } = await import('z3-solver');
      const z3 = await init();
      const ctx = new z3.Context('arith');
      return { z3, ctx };
    })();
  }
  return z3InitPromise;
}

// Evaluate AST deterministically via pure JS as a fallback/consistency check
function evalPure(node) {
  if (node.type === 'int') return node.value | 0;
  const a = evalPure(node.left);
  const b = evalPure(node.right);
  switch (node.op) {
    case '+': return (a + b) | 0;
    case '-': return (a - b) | 0;
    case '*': return (a * b) | 0;
    case '/': {
      if (b === 0) throw new Error('Division by zero');
      // Integer division like Z3's div for Ints (trunc toward -inf is Z3 div, toward zero is different; we match Z3's div for non-negative here)
      // For simplicity, use Math.trunc to mirror common expectations.
      return Math.trunc(a / b) | 0;
    }
    default: throw new Error(`Unknown operator '${node.op}'`);
  }
}

export async function evaluateArithmetic(ast) {
  // Quick pure evaluation used only to detect runtime errors like div-by-zero early
  const pure = evalPure(ast);

  // Use Z3 to compute/validate result
  const { ctx } = await getContext();
  const { Int, Solver } = ctx;

  function build(node) {
    if (node.type === 'int') return Int.val(node.value);
    const l = build(node.left);
    const r = build(node.right);
    switch (node.op) {
      case '+': return l.add(r);
      case '-': return l.sub(r);
      case '*': return l.mul(r);
      case '/': return l.div(r);
      default: throw new Error(`Unknown operator '${node.op}'`);
    }
  }

  const term = build(ast);
  // Constrain a fresh symbol equal to term and query the model
  const resultSym = Int.const('result');
  const s = new Solver();
  s.add(resultSym.eq(term));
  const status = await s.check();
  if (String(status) !== 'sat') {
    throw new Error('Expression is not satisfiable');
  }
  const m = s.model();
  const z3Res = m.eval(resultSym);
  // Prefer Z3's result string -> number when possible
  const txt = z3Res.toString();
  const asInt = Number.parseInt(txt, 10);
  if (!Number.isNaN(asInt)) return asInt;
  // Fallback to pure (should not happen for Int arithmetic)
  return pure;
}

// Collect variables from AST in a stable order
function collectVariables(ast, acc = new Set()) {
  if (!ast) return acc;
  if (ast.type === 'var') acc.add(ast.name);
  if (ast.type === 'bin') {
    collectVariables(ast.left, acc);
    collectVariables(ast.right, acc);
  }
  return acc;
}

// Build Z3 expression from AST given symbol map
function buildZ3Expr(ctx, ast, sym) {
  const { Int } = ctx;
  switch (ast.type) {
    case 'int':
      return Int.val(ast.value);
    case 'var':
      return sym(ast.name);
    case 'bin': {
      const l = buildZ3Expr(ctx, ast.left, sym);
      const r = buildZ3Expr(ctx, ast.right, sym);
      switch (ast.op) {
        case '+': return l.add(r);
        case '-': return l.sub(r);
        case '*': return l.mul(r);
        case '/': return l.div(r);
        default: throw new Error(`Unknown operator '${ast.op}'`);
      }
    }
    default:
      throw new Error(`Unknown AST node '${ast.type}'`);
  }
}

// Solve equation lhs = rhs for Int variables; returns up to maxModels solutions
export async function solveEquation(lhsAst, rhsAst, maxModels = 5) {
  const { ctx } = await getContext();
  const { Int, Solver } = ctx;

  const vars = Array.from(collectVariables(lhsAst)).concat(Array.from(collectVariables(rhsAst)));
  const uniqueVars = Array.from(new Set(vars));
  const symMap = new Map(uniqueVars.map((v) => [v, Int.const(v)]));
  const sym = (name) => symMap.get(name);

  const lhs = buildZ3Expr(ctx, lhsAst, sym);
  const rhs = buildZ3Expr(ctx, rhsAst, sym);

  const s = new Solver();
  s.add(lhs.eq(rhs));

  const solutions = [];
  for (let k = 0; k < maxModels; k++) {
    const res = await s.check();
    if (String(res) !== 'sat') break;
    const m = s.model();
    const modelVals = {};
    const equalities = [];
    for (const v of uniqueVars) {
      const valExpr = m.eval(symMap.get(v), true);
      // Record a readable result
      if (ctx.isIntVal(valExpr)) {
        modelVals[v] = Number.parseInt(valExpr.asString(), 10);
      } else {
        // Fallback to toString() for non-numeral forms
        const txt = String(valExpr.toString());
        const asInt = Number.parseInt(txt, 10);
        modelVals[v] = Number.isNaN(asInt) ? txt : asInt;
      }
      // Build blocking equality against this concrete value
      equalities.push(symMap.get(v).eq(valExpr));
    }
    solutions.push(modelVals);
    // Block this model to find a different one
    const notAll = ctx.Not(ctx.And(...equalities));
    s.add(notAll);
  }

  const hasMore = (await s.check()) === 'sat';
  return { solutions, hasMore };
}


