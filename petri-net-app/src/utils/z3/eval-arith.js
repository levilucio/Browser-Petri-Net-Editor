import { getContext } from './context';
import { buildZ3Expr, collectVariables } from './builders';

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
      return Math.trunc(a / b) | 0;
    }
    default: throw new Error(`Unknown operator '${node.op}'`);
  }
}

export async function evaluateArithmetic(ast) {
  const pure = evalPure(ast);
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
  const resultSym = Int.const('result');
  const s = new Solver();
  s.add(resultSym.eq(term));
  const status = await s.check();
  if (String(status) !== 'sat') throw new Error('Expression is not satisfiable');
  const m = s.model();
  const z3Res = m.eval(resultSym);
  const txt = z3Res.toString();
  const asInt = Number.parseInt(txt, 10);
  if (!Number.isNaN(asInt)) return asInt;
  return pure;
}

export function evaluateArithmeticWithBindings(ast, bindings) {
  function evalNode(node) {
    if (node.type === 'int') return node.value | 0;
    if (node.type === 'string') return node.value;
    if (node.type === 'list') return (node.elements || []).map(evalNode);
    if (node.type === 'var') {
      const v = bindings?.[node.name];
      if (v === undefined) throw new Error(`Unbound variable '${node.name}'`);
      return v;
    }
    if (node.type === 'funcall') {
      if (node.name === 'concat' && node.args && node.args.length === 2) {
        const a1 = evalNode(node.args[0]); const a2 = evalNode(node.args[1]);
        if (typeof a1 === 'string' && typeof a2 === 'string') return a1 + a2;
        if (Array.isArray(a1) && Array.isArray(a2)) return [...a1, ...a2];
        throw new Error('concat requires two strings or two lists');
      }
      if (node.name === 'substring' && node.args && node.args.length === 3) {
        const s = evalNode(node.args[0]); const st = evalNode(node.args[1]); const ln = evalNode(node.args[2]);
        if (typeof s !== 'string' || typeof st !== 'number' || typeof ln !== 'number') throw new Error('substring requires string, int, int');
        return s.substr(st, ln);
      }
      if (node.name === 'length' && node.args && node.args.length === 1) {
        const arg = evalNode(node.args[0]);
        if (typeof arg === 'string' || Array.isArray(arg)) return arg.length;
        throw new Error('length requires string or list');
      }
      if (node.name === 'isSubstringOf' && node.args && node.args.length === 2) {
        const sub = evalNode(node.args[0]); const str = evalNode(node.args[1]);
        if (typeof sub !== 'string' || typeof str !== 'string') throw new Error('isSubstringOf requires two strings');
        return str.includes(sub);
      }
      if (node.name === 'head' && node.args && node.args.length === 1) {
        const list = evalNode(node.args[0]); if (!Array.isArray(list) || list.length === 0) throw new Error('head requires non-empty list');
        return list[0];
      }
      if (node.name === 'tail' && node.args && node.args.length === 1) {
        const list = evalNode(node.args[0]); if (!Array.isArray(list)) throw new Error('tail requires list');
        return list.length === 0 ? [] : list.slice(1);
      }
      if (node.name === 'append' && node.args && node.args.length === 2) {
        const list = evalNode(node.args[0]); const element = evalNode(node.args[1]); if (!Array.isArray(list)) throw new Error('append requires list');
        return [...list, element];
      }
      if (node.name === 'sublist' && node.args && node.args.length === 3) {
        const list = evalNode(node.args[0]); const st = evalNode(node.args[1]); const ln = evalNode(node.args[2]);
        if (!Array.isArray(list) || typeof st !== 'number' || typeof ln !== 'number') throw new Error('sublist requires list, int, int');
        return list.slice(st, st + ln);
      }
      if (node.name === 'isSublistOf' && node.args && node.args.length === 2) {
        const sub = evalNode(node.args[0]); const list = evalNode(node.args[1]);
        if (!Array.isArray(sub) || !Array.isArray(list)) throw new Error('isSublistOf requires two lists');
        const n = sub.length; if (n === 0) return true;
        for (let i = 0; i <= list.length - n; i++) {
          let ok = true; for (let j = 0; j < n; j++) { if (list[i + j] !== sub[j]) { ok = false; break; } }
          if (ok) return true;
        }
        return false;
      }
      if (node.name === 'fst' && node.args && node.args.length === 1) {
        const arg = evalNode(node.args[0]);
        if (!arg || typeof arg !== 'object' || arg.__pair__ !== true) throw new Error('fst requires pair');
        return arg.fst;
      }
      if (node.name === 'snd' && node.args && node.args.length === 1) {
        const arg = evalNode(node.args[0]);
        if (!arg || typeof arg !== 'object' || arg.__pair__ !== true) throw new Error('snd requires pair');
        return arg.snd;
      }
      throw new Error(`Unknown function '${node.name}'`);
    }
    if (node.type === 'binop') {
      const a = evalNode(node.left); const b = evalNode(node.right);
      if (typeof a !== 'number' || typeof b !== 'number') throw new Error('Arithmetic operands must be numbers');
      switch (node.op) {
        case '+': return (a + b) | 0;
        case '-': return (a - b) | 0;
        case '*': return (a * b) | 0;
        case '/': if (b === 0) throw new Error('Division by zero'); return Math.trunc(a / b) | 0;
        default: throw new Error(`Unknown operator '${node.op}'`);
      }
    }
    throw new Error(`Unknown node type '${node.type}'`);
  }
  return evalNode(ast);
}

export async function evaluateTermWithBindings(ast, bindings) {
  const { ctx } = await getContext();
  const { Int, Solver, And } = ctx;
  const vars = Array.from(collectVariables(ast));
  const uniqueVars = Array.from(new Set(vars));
  const symMap = new Map(uniqueVars.map((v) => [v, Int.const(v)]));
  const sym = (name) => symMap.get(name);
  const expr = buildZ3Expr(ctx, ast, sym);
  const res = Int.const('result');
  const s = new Solver();
  try { s.set('timeout', 10000); } catch (_) {}
  s.add(res.eq(expr));
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


