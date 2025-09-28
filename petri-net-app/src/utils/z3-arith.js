// Lightweight Z3 wrapper to evaluate int arithmetic AST using z3-solver WASM in browser
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

// Solve inequality lhs OP rhs for Int variables; returns up to maxModels solutions
export async function solveInequality(lhsAst, rhsAst, op, maxModels = 5) {
  const { ctx } = await getContext();
  const { Int, Solver } = ctx;

  const vars = Array.from(collectVariables(lhsAst)).concat(Array.from(collectVariables(rhsAst)));
  const uniqueVars = Array.from(new Set(vars));
  const symMap = new Map(uniqueVars.map((v) => [v, Int.const(v)]));
  const sym = (name) => symMap.get(name);

  const lhs = buildZ3Expr(ctx, lhsAst, sym);
  const rhs = buildZ3Expr(ctx, rhsAst, sym);

  const s = new Solver();
  
  // Add the inequality constraint
  switch (op) {
    case '<': s.add(lhs.lt(rhs)); break;
    case '<=': s.add(lhs.le(rhs)); break;
    case '>': s.add(lhs.gt(rhs)); break;
    case '>=': s.add(lhs.ge(rhs)); break;
    case '!=': s.add(lhs.neq(rhs)); break;
    default: throw new Error(`Unsupported inequality operator: ${op}`);
  }

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
        const num = Number.parseInt(txt, 10);
        modelVals[v] = Number.isFinite(num) ? num : 0;
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

// Parse a simple predicate of the form "lhs OP rhs" where OP in ==, !=, <, <=, >, >=
// lhs and rhs can be arithmetic expressions parsed by parseArithmetic in arith-parser
export function parsePredicate(expr, parseArithmetic) {
  if (typeof expr !== 'string') throw new Error('Predicate must be a string');
  const src = expr.trim();
  const ops = ['>=', '<=', '==', '!=', '>', '<'];
  // Find first top-level operator
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
  }
  let opIndex = -1;
  let foundOp = null;
  for (let i = 0, d = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(') { d++; continue; }
    if (ch === ')') { d = Math.max(0, d - 1); continue; }
    if (d !== 0) continue;
    const two = src.slice(i, i + 2);
    if (ops.includes(two)) { foundOp = two; opIndex = i; break; }
    if (ops.includes(ch)) { foundOp = ch; opIndex = i; break; }
  }
  if (!foundOp || opIndex < 0) throw new Error('Predicate must contain a comparison operator');
  const leftStr = src.slice(0, opIndex).trim();
  const rightStr = src.slice(opIndex + foundOp.length).trim();
  const leftAst = parseArithmetic(leftStr);
  const rightAst = parseArithmetic(rightStr);
  return { type: 'cmp', op: foundOp, left: leftAst, right: rightAst };
}

// Evaluate guard predicate with optional variable bindings; returns bool
export async function evaluatePredicate(predicate, bindings, parseArithmetic) {
  const { ctx } = await getContext();
  const { Int, Solver, And, Not } = ctx;
  const predAst = typeof predicate === 'string' ? parsePredicate(predicate, parseArithmetic) : predicate;
  const vars = Array.from(collectVariables(predAst.left)).concat(Array.from(collectVariables(predAst.right)));
  const uniqueVars = Array.from(new Set(vars));
  const symMap = new Map(uniqueVars.map((v) => [v, Int.const(v)]));
  const sym = (name) => symMap.get(name);
  const l = buildZ3Expr(ctx, predAst.left, sym);
  const r = buildZ3Expr(ctx, predAst.right, sym);
  let cmp;
  switch (predAst.op) {
    case '==': cmp = l.eq(r); break;
    case '!=': cmp = Not(l.eq(r)); break;
    case '<': cmp = l.lt(r); break;
    case '<=': cmp = l.le(r); break;
    case '>': cmp = l.gt(r); break;
    case '>=': cmp = l.ge(r); break;
    default: throw new Error(`Unsupported predicate operator '${predAst.op}'`);
  }
  const s = new Solver();
  try { s.set('timeout', 10000); } catch (_) {}
  if (bindings && typeof bindings === 'object') {
    const eqs = [];
    for (const [name, value] of Object.entries(bindings)) {
      if (symMap.has(name)) eqs.push(symMap.get(name).eq(Int.val(value | 0)));
    }
    if (eqs.length) s.add(And(...eqs));
  }
  s.add(cmp);
  const res = await s.check();
  return String(res) === 'sat';
}

// Evaluate arithmetic AST with variable bindings in pure JS
export function evaluateArithmeticWithBindings(ast, bindings) {
  function evalNode(node) {
    if (node.type === 'int') return node.value | 0;
    if (node.type === 'var') {
      const v = bindings?.[node.name];
      if (typeof v !== 'number') throw new Error(`Unbound variable '${node.name}'`);
      return v | 0;
    }
    const a = evalNode(node.left);
    const b = evalNode(node.right);
    switch (node.op) {
      case '+': return (a + b) | 0;
      case '-': return (a - b) | 0;
      case '*': return (a * b) | 0;
      case '/': {
        if (b === 0) throw new Error('Division by zero');
        return Math.trunc(a / b) | 0;
      }
      default: throw new Error(`Unknown operator '${node.op}'`);
    }
  }
  return evalNode(ast);
}

// Evaluate action assignments like "y = x + z, w = x - z"
export function evaluateAction(actionString, bindings, parseArithmetic) {
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
    result[left] = evaluateArithmeticWithBindings(ast, bindings);
  }
  return result;
}

// Evaluate arithmetic AST with Z3 under concrete int bindings for variables
export async function evaluateTermWithBindings(ast, bindings) {
  const { ctx } = await getContext();
  const { Int, Solver, And } = ctx;
  // Collect variables and create symbols
  const vars = Array.from(collectVariables(ast));
  const uniqueVars = Array.from(new Set(vars));
  const symMap = new Map(uniqueVars.map((v) => [v, Int.const(v)]));
  const sym = (name) => symMap.get(name);
  const expr = buildZ3Expr(ctx, ast, sym);
  const res = Int.const('result');
  const s = new Solver();
  try { s.set('timeout', 10000); } catch (_) {}
  s.add(res.eq(expr));
  // Bind variables to provided concrete ints
  if (bindings && typeof bindings === 'object') {
    const eqs = [];
    for (const [name, value] of Object.entries(bindings)) {
      if (symMap.has(name)) eqs.push(symMap.get(name).eq(Int.val(value | 0)));
    }
    if (eqs.length) s.add(And(...eqs));
  }
  const status = await s.check();
  if (String(status) !== 'sat') throw new Error('Unsatisfiable under bindings');
  const m = s.model();
  const v = m.eval(res, true);
  const n = Number.parseInt(v.asString?.() ?? String(v), 10);
  if (!Number.isNaN(n)) return n;
  return Number.parseInt(String(v), 10);
}

// ===================== Boolean support (tokens and guards) =====================

// Parse bool expressions with operators: not, and, or, parentheses, literals true/false,
// bool variables, and arithmetic comparisons (==, !=, <, <=, >, >=)
export function parseBooleanExpr(input, parseArithmetic) {
  if (typeof input !== 'string') throw new Error('Boolean expression must be a string');
  const src = input.trim();
  let i = 0;

  function skipWs() { while (i < src.length && /\s/.test(src[i])) i++; }
  function startsWithWord(word) {
    skipWs();
    return src.slice(i, i + word.length).toLowerCase() === word &&
      (i + word.length === src.length || /[^A-Za-z0-9_]/.test(src[i + word.length] || ''));
  }
  function parseIdentWithOptionalType() {
    skipWs();
    const start = i;
    if (!/[A-Za-z_]/.test(src[i] || '')) throw new Error(`Expected identifier at position ${i}`);
    i++;
    while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) i++;
    const name = src.slice(start, i);
    
    // Validate variable names start with lowercase to avoid T/F ambiguity
    if (name && /^[A-Z]/.test(name)) {
      throw new Error(`Variable names must start with lowercase letter, got '${name}' (use 't' instead of 'T', 'f' instead of 'F')`);
    }
    
    const save = i;
    skipWs();
    if (src[i] === ':') {
      i++;
      skipWs();
      const tStart = i;
      while (i < src.length && /[A-Za-z]/.test(src[i])) i++;
      const tWord = src.slice(tStart, i).toLowerCase();
      if (tWord === 'int' || tWord === 'bool' || tWord === 'pair') {
        return { name, varType: tWord };
      }
      // rollback if not recognized
      i = save;
      return { name };
    }
    return { name };
  }

  function parseAnyTermString(s) {
    const srcTerm = String(s || '').trim();
    // Check bools first to avoid treating T/F as variables
    if (/^true$/i.test(srcTerm) || srcTerm === 'T') return { type: 'boolLit', value: true };
    if (/^false$/i.test(srcTerm) || srcTerm === 'F') return { type: 'boolLit', value: false };
    // Try arithmetic
    try { return parseArithmetic(srcTerm); } catch (_) {}
    // Pair literal (top-level comma inside parens)
    if (srcTerm.startsWith('(') && srcTerm.endsWith(')')) {
      const inner = srcTerm.slice(1, -1).trim();
      let depth = 0, idx = -1;
      for (let j = 0; j < inner.length; j++) {
        const ch = inner[j];
        if (ch === '(') depth++;
        else if (ch === ')') depth = Math.max(0, depth - 1);
        else if (ch === ',' && depth === 0) { idx = j; break; }
      }
      if (idx >= 0) {
        const leftStr = inner.slice(0, idx).trim();
        const rightStr = inner.slice(idx + 1).trim();
        return { type: 'pairLit', fst: parseAnyTermString(leftStr), snd: parseAnyTermString(rightStr) };
      }
    }
    // Identifier (possibly annotated)
    try {
      const { name, varType } = parseIdentWithOptionalType();
      if (varType === 'bool') return { type: 'boolVar', name, varType };
      if (varType === 'pair') return { type: 'pairVar', name, varType };
      return { type: 'var', name };
    } catch (_) {
      throw new Error(`Unrecognized term '${srcTerm}'`);
    }
  }

  function parseBoolPrimary() {
    skipWs();
    if (i >= src.length) throw new Error('Unexpected end of input in bool expression');
    if (src[i] === '(') {
      i++;
      const node = parseOr();
      skipWs();
      if (src[i] !== ')') throw new Error(`Expected ')' at position ${i}`);
      i++;
      return node;
    }
    // Literal true/false
    if (startsWithWord('true')) { i += 4; return { type: 'boolLit', value: true }; }
    if (startsWithWord('false')) { i += 5; return { type: 'boolLit', value: false }; }
    // Single-letter bool literals T / F (uppercase) with word boundary
    if (src[i] === 'T') {
      const next = src[i + 1] || '';
      if (!/[A-Za-z0-9_]/.test(next)) { i += 1; return { type: 'boolLit', value: true }; }
    }
    if (src[i] === 'F') {
      const next = src[i + 1] || '';
      if (!/[A-Za-z0-9_]/.test(next)) { i += 1; return { type: 'boolLit', value: false }; }
    }

    // Try to parse a comparison predicate lhs OP rhs (supports arithmetic and pairs)
    // Look ahead for comparison operators at top level
    const ops = ['>=', '<=', '==', '!=', '>', '<'];
    // Scan ahead to find first top-level comparison operator
    let depth = 0;
    let opIndex = -1; let foundOp = null;
    for (let j = i; j < src.length; j++) {
      const ch = src[j];
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      if (depth !== 0) continue;
      const two = src.slice(j, j + 2);
      if (ops.includes(two)) { foundOp = two; opIndex = j; break; }
      if (ops.includes(ch)) { foundOp = ch; opIndex = j; break; }
    }
    if (foundOp && opIndex >= 0) {
      const leftStr = src.slice(i, opIndex).trim();
      const rightStr = src.slice(opIndex + foundOp.length).trim();
      const leftAst = parseAnyTermString(leftStr);
      const rightAst = parseAnyTermString(rightStr);
      // Advance parser to end since we consumed entire remaining expression
      i = src.length;
      return { type: 'cmp', op: foundOp, left: leftAst, right: rightAst };
    }

    // Otherwise treat as bool variable identifier (optional : type)
    const { name, varType } = parseIdentWithOptionalType();
    return varType ? { type: 'boolVar', name, varType } : { type: 'boolVar', name };
  }

  function parseNot() {
    skipWs();
    if (startsWithWord('not')) { i += 3; const expr = parseNot(); return { type: 'not', expr }; }
    return parseBoolPrimary();
  }

  function parseAnd() {
    let node = parseNot();
    while (true) {
      skipWs();
      if (startsWithWord('and')) { i += 3; const right = parseNot(); node = { type: 'and', left: node, right }; }
      else break;
    }
    return node;
  }

  function parseOr() {
    let node = parseAnd();
    while (true) {
      skipWs();
      if (startsWithWord('or')) { i += 2; const right = parseAnd(); node = { type: 'or', left: node, right }; }
      else break;
    }
    return node;
  }

  const ast = parseOr();
  skipWs();
  if (i !== src.length) throw new Error(`Unexpected token '${src[i]}' at position ${i}`);
  return ast;
}

// Pure JS bool evaluation with mixed env (bools and ints)
export function evaluateBooleanWithBindings(ast, bindings, parseArithmetic) {
  function toBool(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (v && typeof v === 'object' && v.__pair__) {
      // For now, pairs are truthy only via non-null check when used as bool
      return true;
    }
    throw new Error('Non-bool binding in bool expression');
  }
  function evalBool(node) {
    switch (node.type) {
      case 'boolLit': return !!node.value;
      case 'boolVar': return toBool(bindings?.[node.name]);
      case 'not': return !evalBool(node.expr);
      case 'and': return evalBool(node.left) && evalBool(node.right);
      case 'or': return evalBool(node.left) || evalBool(node.right);
      case 'cmp': {
        const l = tryEvalAnyTerm(node.left, bindings, parseArithmetic);
        const r = tryEvalAnyTerm(node.right, bindings, parseArithmetic);
        const eq = (a, b) => {
          if (a && typeof a === 'object' && a.__pair__ && b && typeof b === 'object' && b.__pair__) {
            return eq(a.fst, b.fst) && eq(a.snd, b.snd);
          }
          return a === b;
        };
        switch (node.op) {
          case '==': return eq(l, r);
          case '!=': return !eq(l, r);
          case '<': return l < r;
          case '<=': return l <= r;
          case '>': return l > r;
          case '>=': return l >= r;
          default: return false;
        }
      }
      default:
        throw new Error(`Unknown bool AST node '${node.type}'`);
    }
  }
  return evalBool(ast);
}

// Try to evaluate a term that may be arithmetic, bool, or pair-construction
function tryEvalAnyTerm(ast, bindings, parseArithmetic) {
  // For now, we reuse arithmetic parser AST shape; extend with simple pair literal detection in bindings/guards via variable lookup
  if (!ast) throw new Error('Invalid term');
  if (ast.type === 'int' || ast.type === 'bin' || ast.type === 'var') {
    try { return evaluateArithmeticWithBindings(ast, bindings); } catch (_) {}
    // If not arith, maybe a bool variable
    if (ast.type === 'var' && typeof bindings?.[ast.name] !== 'undefined') {
      return bindings[ast.name];
    }
  }
  if (ast.type === 'boolLit') return !!ast.value;
  if (ast.type === 'boolVar') return !!(bindings?.[ast.name]);
  if (ast.type === 'pairVar') return bindings?.[ast.name];
  if (ast.type === 'pairLit') {
    const left = tryEvalAnyTerm(ast.fst, bindings, parseArithmetic);
    const right = tryEvalAnyTerm(ast.snd, bindings, parseArithmetic);
    return { __pair__: true, fst: left, snd: right };
  }
  return evaluateArithmeticWithBindings(ast, bindings);
}

// SAT check for bool expression with Z3 given optional concrete bindings
export async function evaluateBooleanPredicate(boolAstOrString, bindings, parseArithmetic) {
  const { ctx } = await getContext();
  const { Int, Bool, Solver, And, Not, Or } = ctx;

  const ast = typeof boolAstOrString === 'string'
    ? parseBooleanExpr(boolAstOrString, parseArithmetic)
    : boolAstOrString;

  const intVars = new Set();
  const boolVars = new Set();
  const pairVars = new Set();

  function collect(node) {
    if (!node) return;
    switch (node.type) {
      case 'boolVar': boolVars.add(node.name); break;
      case 'and': case 'or': collect(node.left); collect(node.right); break;
      case 'not': collect(node.expr); break;
      case 'cmp': {
        const addArith = (t) => {
          if (!t) return;
          if (t.type === 'var') intVars.add(t.name);
          if (t.type === 'bin') { addArith(t.left); addArith(t.right); }
        };
        addArith(node.left); addArith(node.right);
        break;
      }
      default: break;
    }
  }
  collect(ast);

  const intSym = new Map(Array.from(intVars).map(v => [v, Int.const(v)]));
  const boolSym = new Map(Array.from(boolVars).map(v => [v, Bool.const(v)]));

  function buildBool(node) {
    switch (node.type) {
      case 'boolLit': return node.value ? Bool.val(true) : Bool.val(false);
      case 'boolVar': return boolSym.get(node.name);
      case 'not': return Not(buildBool(node.expr));
      case 'and': return And(buildBool(node.left), buildBool(node.right));
      case 'or': return Or(buildBool(node.left), buildBool(node.right));
      case 'cmp': {
        // Support only Int comparisons in Z3; for pairs we will fall back to pure evaluation
        const canBuildIntTerm = (t) => t && (t.type === 'int' || t.type === 'var' || t.type === 'bin');
        if (canBuildIntTerm(node.left) && canBuildIntTerm(node.right)) {
          const buildArith = (t) => {
            if (t.type === 'int') return Int.val(t.value);
            if (t.type === 'var') return intSym.get(t.name);
            if (t.type === 'bin') {
              const l = buildArith(t.left); const r = buildArith(t.right);
              switch (t.op) {
                case '+': return l.add(r);
                case '-': return l.sub(r);
                case '*': return l.mul(r);
                case '/': return l.div(r);
                default: throw new Error('Unknown arithmetic operator');
              }
            }
            throw new Error('Unknown arithmetic AST in bool comparison');
          };
          const l = buildArith(node.left); const r = buildArith(node.right);
          switch (node.op) {
            case '==': return l.eq(r);
            case '!=': return Not(l.eq(r));
            case '<': return l.lt(r);
            case '<=': return l.le(r);
            case '>': return l.gt(r);
            case '>=': return l.ge(r);
            default: throw new Error(`Unsupported predicate operator '${node.op}'`);
          }
        }
        // Fallback: evaluate outside Z3 during SAT check by constraining a fresh Bool to the pure result
        const pure = evaluateBooleanWithBindings({ type: 'cmp', op: node.op, left: node.left, right: node.right }, bindings || {}, parseArithmetic);
        return pure ? Bool.val(true) : Bool.val(false);
      }
      default: throw new Error(`Unknown bool AST node '${node.type}'`);
    }
  }

  const s = new Solver();
  try { s.set('timeout', 10000); } catch (_) {}

  // Bind provided env values
  if (bindings && typeof bindings === 'object') {
    const eqs = [];
    for (const [name, value] of Object.entries(bindings)) {
      if (intSym.has(name) && typeof value === 'number') {
        eqs.push(intSym.get(name).eq(Int.val(value|0)));
      } else if (boolSym.has(name) && typeof value === 'boolean') {
        eqs.push(boolSym.get(name).eq(value ? Bool.val(true) : Bool.val(false)));
      } else if (value && typeof value === 'object' && value.__pair__ && value.hasOwnProperty('fst') && value.hasOwnProperty('snd')) {
        // We don't introduce a Pair sort in this simplified infra; for equality between pairs we directly compare concrete JS values elsewhere.
      }
    }
    if (eqs.length) s.add(And(...eqs));
  }

  s.add(buildBool(ast));
  const res = await s.check();
  return String(res) === 'sat';
}


