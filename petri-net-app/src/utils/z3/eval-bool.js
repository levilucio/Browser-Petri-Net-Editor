import { getContext } from './context';
import { buildZ3Expr, collectVariables } from './builders';
import { evaluateArithmeticWithBindings } from './eval-arith';

export function parsePredicate(expr, parseArithmetic) {
  if (typeof expr !== 'string') throw new Error('Predicate must be a string');
  const src = expr.trim();
  const ops = ['>=', '<=', '==', '!=', '>', '<'];
  let depth = 0; let opIndex = -1; let foundOp = null;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(') depth++; else if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth !== 0) continue;
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

export function parseBooleanExpr(input, parseArithmetic) {
  if (typeof input !== 'string') throw new Error('Boolean expression must be a string');
  const src = input.trim();
  let i = 0;
  function skipWs() { while (i < src.length && /\s/.test(src[i])) i++; }
  function isWordBoundaryAt(pos, len) {
    return (pos === 0 || /[^A-Za-z0-9_]/.test(src[pos - 1] || '')) &&
      (pos + len === src.length || /[^A-Za-z0-9_]/.test(src[pos + len] || ''));
  }
  function startsWithWord(word) {
    skipWs();
    return src.slice(i, i + word.length).toLowerCase() === word && isWordBoundaryAt(i, word.length);
  }
  function parseIdentWithOptionalType() {
    skipWs();
    const start = i;
    if (!/[A-Za-z_]/.test(src[i] || '')) throw new Error(`Expected identifier at position ${i}`);
    i++;
    while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) i++;
    const name = src.slice(start, i);
    if (name && /^[A-Z]/.test(name)) throw new Error(`Variable names must start with lowercase letter, got '${name}'`);
    const save = i; skipWs();
    if (src[i] === ':') {
      i++; skipWs();
      const tStart = i; while (i < src.length && /[A-Za-z]/.test(src[i])) i++;
      const tWord = src.slice(tStart, i).toLowerCase();
      if (tWord === 'int' || tWord === 'bool' || tWord === 'pair') return { name, varType: tWord };
      i = save; return { name };
    }
    return { name };
  }
  function parseAnyTermString(s) {
    const srcTerm = String(s || '').trim();
    if (/^true$/i.test(srcTerm) || srcTerm === 'T') return { type: 'boolLit', value: true };
    if (/^false$/i.test(srcTerm) || srcTerm === 'F') return { type: 'boolLit', value: false };
    // Try to parse a pair literal like (2, (T, 3)) with balanced parentheses
    if (srcTerm.startsWith('(') && srcTerm.endsWith(')')) {
      const inner = srcTerm.slice(1, -1).trim();
      let depth = 0; let splitAt = -1;
      for (let k = 0; k < inner.length; k++) {
        const ch = inner[k];
        if (ch === '(') depth++;
        else if (ch === ')') depth = Math.max(0, depth - 1);
        else if (ch === ',' && depth === 0) { splitAt = k; break; }
      }
      if (splitAt >= 0) {
        const leftStr = inner.slice(0, splitAt).trim();
        const rightStr = inner.slice(splitAt + 1).trim();
        if (leftStr.length && rightStr.length) {
          return { type: 'pairLit', fst: parseAnyTermString(leftStr), snd: parseAnyTermString(rightStr) };
        }
      }
    }
    try { return parseArithmetic(srcTerm); } catch (_) {}
    try {
      const { name, varType } = parseIdentWithOptionalType();
      if (varType === 'bool') return { type: 'boolVar', name, varType };
      if (varType === 'pair') return { type: 'pairVar', name, varType };
      return { type: 'var', name };
    } catch (_) { throw new Error(`Unrecognized term '${srcTerm}'`); }
  }
  function parseBoolPrimary() {
    skipWs(); if (i >= src.length) throw new Error('Unexpected end');
    if (src[i] === '(') { i++; const node = parseOr(); skipWs(); if (src[i] !== ')') throw new Error(`Expected ')' at ${i}`); i++; return node; }
    if (src.slice(i).startsWith('isSubstringOf')) {
      i += 'isSubstringOf'.length; skipWs(); if (src[i] !== '(') throw new Error(`Expected '('`);
      let startArgs = i + 1; let d = 1; i++;
      for (; i < src.length && d > 0; i++) { const ch = src[i]; if (ch === '(') d++; else if (ch === ')') d--; }
      if (d !== 0) throw new Error('Unterminated isSubstringOf arguments');
      const inside = src.slice(startArgs, i - 1).trim();
      let depth = 0; let cur = ''; const parts = [];
      for (let k = 0; k < inside.length; k++) { const ch = inside[k]; if (ch === '(') { depth++; cur += ch; continue; } if (ch === ')') { depth = Math.max(0, depth - 1); cur += ch; continue; } if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; } cur += ch; }
      if (cur.trim().length) parts.push(cur.trim());
      if (parts.length !== 2) throw new Error('isSubstringOf expects two arguments');
      const a0 = parseArithmetic(parts[0]); const a1 = parseArithmetic(parts[1]);
      return { type: 'boolFuncall', name: 'isSubstringOf', args: [a0, a1] };
    }
    const ops = ['>=', '<=', '==', '!=', '>', '<'];
    let depth = 0; let opIndex = -1; let foundOp = null;
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
      // determine the end of the right-hand arithmetic term by scanning until a top-level 'and'/'or' word
      const afterOp = opIndex + foundOp.length;
      let end = src.length;
      depth = 0;
      const isWordBoundary = (pos) => (pos === 0 || /[^A-Za-z0-9_]/.test(src[pos - 1] || '')) && (pos + 3 <= src.length ? /[^A-Za-z0-9_]/.test(src[pos + 3] || '') : true);
      for (let k = afterOp; k < src.length; k++) {
        const ch = src[k];
        if (ch === '(') { depth++; continue; }
        if (ch === ')') { if (depth === 0) { end = k; break; } depth = Math.max(0, depth - 1); continue; }
        if (depth !== 0) continue;
        // look for ' and ' or ' or ' with word boundaries
        if (src.slice(k).toLowerCase().startsWith('and') && isWordBoundary(k)) { end = k; break; }
        if (src.slice(k).toLowerCase().startsWith('or') && (k === 0 || /[^A-Za-z0-9_]/.test(src[k - 1] || '')) && (k + 2 === src.length || /[^A-Za-z0-9_]/.test(src[k + 2] || ''))) { end = k; break; }
      }
      const rightStr = src.slice(afterOp, end).trim();
      const leftAst = parseAnyTermString(leftStr);
      const rightAst = parseAnyTermString(rightStr);
      i = end; // stop right before ')' or logical operator; outer parser consumes next token
      return { type: 'cmp', op: foundOp, left: leftAst, right: rightAst };
    }
    const { name, varType } = parseIdentWithOptionalType();
    return varType ? { type: 'boolVar', name, varType } : { type: 'boolVar', name };
  }
  // Supported operators (words + symbol aliases) with precedence (high -> low)
  const OP_WORDS = { not: ['not'], and: ['and'], xor: ['xor'], or: ['or'], implies: ['implies'], iff: ['iff'] };
  const OP_SYMS = { not: ['!'], and: ['&&'], xor: ['^'], or: ['||'], implies: ['->'], iff: ['<->'] };

  function tryConsumeSymbolOrWord(symbols, words) {
    skipWs();
    for (const s of symbols) { if (src.slice(i, i + s.length) === s) { i += s.length; return true; } }
    for (const w of words) { if (src.slice(i, i + w.length).toLowerCase() === w && isWordBoundaryAt(i, w.length)) { i += w.length; return true; } }
    return false;
  }

  function parseNot() {
    skipWs();
    if (tryConsumeSymbolOrWord(OP_SYMS.not, OP_WORDS.not)) { const expr = parseNot(); return { type: 'not', expr }; }
    return parseBoolPrimary();
  }

  function parseAnd() { let node = parseNot(); while (true) { skipWs(); if (tryConsumeSymbolOrWord(OP_SYMS.and, OP_WORDS.and)) { const right = parseNot(); node = { type: 'and', left: node, right }; } else break; } return node; }
  function parseXor() { let node = parseAnd(); while (true) { skipWs(); if (tryConsumeSymbolOrWord(OP_SYMS.xor, OP_WORDS.xor)) { const right = parseAnd(); node = { type: 'xor', left: node, right }; } else break; } return node; }
  function parseOr() { let node = parseXor(); while (true) { skipWs(); if (tryConsumeSymbolOrWord(OP_SYMS.or, OP_WORDS.or)) { const right = parseXor(); node = { type: 'or', left: node, right }; } else break; } return node; }
  function parseImplies() { let node = parseOr(); while (true) { skipWs(); if (tryConsumeSymbolOrWord(OP_SYMS.implies, OP_WORDS.implies)) { const right = parseOr(); node = { type: 'implies', left: node, right }; } else break; } return node; }
  function parseIff() { let node = parseImplies(); while (true) { skipWs(); if (tryConsumeSymbolOrWord(OP_SYMS.iff, OP_WORDS.iff)) { const right = parseImplies(); node = { type: 'iff', left: node, right }; } else break; } return node; }
  const ast = parseIff(); skipWs(); if (i !== src.length) throw new Error(`Unexpected token '${src[i]}' at position ${i}`); return ast;
}

export function evaluateBooleanWithBindings(ast, bindings, parseArithmetic) {
  function toBool(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (v && typeof v === 'object' && v.__pair__) return true;
    throw new Error('Non-bool binding in bool expression');
  }
  function tryEvalAnyTerm(ast2) {
    if (!ast2) throw new Error('Invalid term');
    if (ast2.type === 'int' || ast2.type === 'bin' || ast2.type === 'var') {
      try { return evaluateArithmeticWithBindings(ast2, bindings); } catch (_) {}
      if (ast2.type === 'var' && typeof bindings?.[ast2.name] !== 'undefined') return bindings[ast2.name];
    }
    if (ast2.type === 'boolLit') return !!ast2.value;
    if (ast2.type === 'boolVar') return !!(bindings?.[ast2.name]);
    if (ast2.type === 'pairVar') return bindings?.[ast2.name];
    if (ast2.type === 'pairLit') return { __pair__: true, fst: tryEvalAnyTerm(ast2.fst), snd: tryEvalAnyTerm(ast2.snd) };
    return evaluateArithmeticWithBindings(ast2, bindings);
  }
  function evalBool(node) {
    switch (node.type) {
      case 'boolLit': return !!node.value;
      case 'boolVar': return toBool(bindings?.[node.name]);
      case 'boolFuncall': {
        if (node.name === 'isSubstringOf' && node.args && node.args.length === 2) {
          const sub = evaluateArithmeticWithBindings(node.args[0], bindings || {});
          const str = evaluateArithmeticWithBindings(node.args[1], bindings || {});
          if (typeof sub !== 'string' || typeof str !== 'string') throw new Error('isSubstringOf requires two string arguments');
          return str.includes(sub);
        }
        throw new Error(`Unknown boolean function '${node.name}'`);
      }
      case 'not': return !evalBool(node.expr);
      case 'and': return evalBool(node.left) && evalBool(node.right);
      case 'or': return evalBool(node.left) || evalBool(node.right);
      case 'cmp': {
        const l = tryEvalAnyTerm(node.left); const r = tryEvalAnyTerm(node.right);
        const eq = (a, b) => { if (a && typeof a === 'object' && a.__pair__ && b && typeof b === 'object' && b.__pair__) return eq(a.fst, b.fst) && eq(a.snd, b.snd); return a === b; };
        switch (node.op) { case '==': return eq(l, r); case '!=': return !eq(l, r); case '<': return l < r; case '<=': return l <= r; case '>': return l > r; case '>=': return l >= r; default: return false; }
      }
      default: throw new Error(`Unknown bool AST node '${node.type}'`);
    }
  }
  return evalBool(ast);
}

export async function evaluateBooleanPredicate(boolAstOrString, bindings, parseArithmetic) {
  const { ctx } = await getContext();
  const { Int, Bool, Solver, And, Not, Or } = ctx;
  const ast = typeof boolAstOrString === 'string' ? parseBooleanExpr(boolAstOrString, parseArithmetic) : boolAstOrString;
  const intVars = new Set(); const boolVars = new Set();
  function collect(node) { if (!node) return; switch (node.type) { case 'boolVar': boolVars.add(node.name); break; case 'and': case 'or': collect(node.left); collect(node.right); break; case 'not': collect(node.expr); break; case 'cmp': const addArith = (t) => { if (!t) return; if (t.type === 'var') intVars.add(t.name); if (t.type === 'bin') { addArith(t.left); addArith(t.right); } }; addArith(node.left); addArith(node.right); break; default: break; } }
  collect(ast);
  const intSym = new Map(Array.from(intVars).map(v => [v, Int.const(v)]));
  const boolSym = new Map(Array.from(boolVars).map(v => [v, Bool.const(v)]));
  function buildBool(node) {
    switch (node.type) {
      case 'boolLit': return node.value ? Bool.val(true) : Bool.val(false);
      case 'boolVar': return boolSym.get(node.name);
      case 'boolFuncall': {
        if (node.name === 'isSubstringOf' && node.args && node.args.length === 2) {
          try {
            const sub = evaluateArithmeticWithBindings(node.args[0], bindings || {});
            const str = evaluateArithmeticWithBindings(node.args[1], bindings || {});
            if (typeof sub !== 'string' || typeof str !== 'string') throw new Error('isSubstringOf requires two string arguments');
            return str.includes(sub) ? Bool.val(true) : Bool.val(false);
          } catch (_) {
            try {
              const str1 = buildZ3Expr(ctx, node.args[1], (n) => intSym.get(n));
              const sub = buildZ3Expr(ctx, node.args[0], (n) => intSym.get(n));
              return str1.contains(sub);
            } catch (e) {
              return Bool.val(false);
            }
          }
        }
        throw new Error(`Unknown boolean function '${node.name}'`);
      }
      case 'not': return Not(buildBool(node.expr));
      case 'and': return And(buildBool(node.left), buildBool(node.right));
      case 'or': return Or(buildBool(node.left), buildBool(node.right));
      case 'cmp': {
        const canBuildIntTerm = (t) => t && (t.type === 'int' || t.type === 'var' || t.type === 'bin' || t.type === 'binop');
        if (canBuildIntTerm(node.left) && canBuildIntTerm(node.right)) {
          const buildArith = (t) => { if (t.type === 'int') return Int.val(t.value); if (t.type === 'var') return intSym.get(t.name); if (t.type === 'bin' || t.type === 'binop') { const l = buildArith(t.left); const r = buildArith(t.right); switch (t.op) { case '+': return l.add(r); case '-': return l.sub(r); case '*': return l.mul(r); case '/': return l.div(r); default: throw new Error('Unknown arithmetic operator'); } } throw new Error('Unknown arithmetic AST in bool comparison'); };
          const l = buildArith(node.left); const r = buildArith(node.right);
          switch (node.op) { case '==': return l.eq(r); case '!=': return Not(l.eq(r)); case '<': return l.lt(r); case '<=': return l.le(r); case '>': return l.gt(r); case '>=': return l.ge(r); default: throw new Error(`Unsupported predicate operator '${node.op}'`); }
        }
        const pure = evaluateBooleanWithBindings({ type: 'cmp', op: node.op, left: node.left, right: node.right }, bindings || {}, parseArithmetic);
        return pure ? Bool.val(true) : Bool.val(false);
      }
      default: throw new Error(`Unknown bool AST node '${node.type}'`);
    }
  }
  const s = new Solver();
  try { s.set('timeout', 10000); } catch (_) {}
  if (bindings && typeof bindings === 'object') {
    const eqs = [];
    for (const [name, value] of Object.entries(bindings)) {
      if (intSym.has(name) && typeof value === 'number') eqs.push(intSym.get(name).eq(Int.val(value|0)));
      else if (boolSym.has(name) && typeof value === 'boolean') eqs.push(boolSym.get(name).eq(value ? Bool.val(true) : Bool.val(false)));
    }
    if (eqs.length) s.add(And(...eqs));
  }
  s.add(buildBool(ast));
  const res = await s.check();
  return String(res) === 'sat';
}

export async function solveEquation(lhsAst, rhsAst, maxModels = 5) {
  const { ctx } = await getContext();
  const { Int, Solver } = ctx;
  // Partially reduce any fully-ground arithmetic subterms (e.g., length([1,2,3]) → 3)
  function toLiteralAst(value) {
    if (typeof value === 'number') return { type: 'int', value: value | 0 };
    if (typeof value === 'string') return { type: 'string', value };
    if (Array.isArray(value)) {
      const els = value.map(toLiteralAst).filter(Boolean);
      return { type: 'list', elements: els };
    }
    // Pairs and other structures are not converted here
    return null;
  }
  function partialReduce(node) {
    // Attempt to evaluate the subtree; fall back to structural recursion
    try {
      const val = evaluateArithmeticWithBindings(node, {});
      const lit = toLiteralAst(val);
      if (lit) return lit;
    } catch (_) {}
    if (!node || typeof node !== 'object') return node;
    if (node.type === 'binop' || node.type === 'bin') {
      const left = partialReduce(node.left);
      const right = partialReduce(node.right);
      const rebuilt = { ...node, type: 'binop', left, right };
      try {
        const v = evaluateArithmeticWithBindings(rebuilt, {});
        const lit = toLiteralAst(v);
        if (lit) return lit;
      } catch (_) {}
      return rebuilt;
    }
    if (node.type === 'funcall') {
      const args = Array.isArray(node.args) ? node.args.map(partialReduce) : [];
      const rebuilt = { ...node, args };
      try {
        const v = evaluateArithmeticWithBindings(rebuilt, {});
        const lit = toLiteralAst(v);
        if (lit) return lit;
      } catch (_) {}
      return rebuilt;
    }
    if (node.type === 'list') {
      const elements = (node.elements || []).map(partialReduce);
      return { ...node, elements };
    }
    return node;
  }

  lhsAst = partialReduce(lhsAst);
  rhsAst = partialReduce(rhsAst);

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
    const res = await s.check(); if (String(res) !== 'sat') break;
    const m = s.model(); const modelVals = {}; const equalities = [];
    for (const v of uniqueVars) {
      const valExpr = m.eval(symMap.get(v), true);
      if (ctx.isIntVal(valExpr)) modelVals[v] = Number.parseInt(valExpr.asString(), 10);
      else { const txt = String(valExpr.toString()); const asInt = Number.parseInt(txt, 10); modelVals[v] = Number.isNaN(asInt) ? txt : asInt; }
      equalities.push(symMap.get(v).eq(valExpr));
    }
    solutions.push(modelVals);
    const notAll = ctx.Not(ctx.And(...equalities)); s.add(notAll);
  }
  const hasMore = (await s.check()) === 'sat';
  return { solutions, hasMore };
}

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
  switch (op) { case '<': s.add(lhs.lt(rhs)); break; case '<=': s.add(lhs.le(rhs)); break; case '>': s.add(lhs.gt(rhs)); break; case '>=': s.add(lhs.ge(rhs)); break; case '!=': s.add(lhs.neq(rhs)); break; default: throw new Error(`Unsupported inequality operator: ${op}`); }
  const solutions = [];
  for (let k = 0; k < maxModels; k++) {
    const res = await s.check(); if (String(res) !== 'sat') break;
    const m = s.model(); const modelVals = {}; const equalities = [];
    for (const v of uniqueVars) {
      const valExpr = m.eval(symMap.get(v), true);
      if (ctx.isIntVal(valExpr)) modelVals[v] = Number.parseInt(valExpr.asString(), 10);
      else { const txt = String(valExpr.toString()); const num = Number.parseInt(txt, 10); modelVals[v] = Number.isFinite(num) ? num : 0; }
      equalities.push(symMap.get(v).eq(valExpr));
    }
    solutions.push(modelVals);
    const notAll = ctx.Not(ctx.And(...equalities)); s.add(notAll);
  }
  const hasMore = (await s.check()) === 'sat';
  return { solutions, hasMore };
}


