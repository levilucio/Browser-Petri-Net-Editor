/** Checked, synchronous public methods for the numeric APN fragment. */
import { parseArithmetic } from '../../utils/arith-parser.js';
import { parseBooleanExpr } from '../../utils/z3-arith.js';

const copy = x => JSON.parse(JSON.stringify(x));
const requireThat = (ok, message) => { if (!ok) throw new Error(message); };
const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const isMethodRule = t => t.method !== undefined && t.method !== null;
export const validMethodValue = (value, sort) => Number.isInteger(value) && value <= 2147483647 && value >= (sort === 'Nat' ? 0 : -2147483648);
export const methodSignature = m => `${m.name}(${m.parameters.map(p => `${p.name}: ${p.sort}`).join(', ')})`;

export function getPublicMethods(net) {
  const methods = new Map();
  for (const t of net.transitions || []) {
    if (!isMethodRule(t)) continue;
    const m = t.method;
    requireThat(m && typeof m.name === 'string' && identifier.test(m.name) && Array.isArray(m.parameters), `Invalid public method declaration: ${t.id}`);
    requireThat(m.parameters.every(p => p && typeof p.name === 'string' && identifier.test(p.name) && ['Nat', 'Int'].includes(p.sort)), `Method ${m.name}: parameters must have names and Nat or Int sorts`);
    requireThat(new Set(m.parameters.map(p => p.name)).size === m.parameters.length, `Duplicate parameter in ${m.name}`);
    if (methods.has(m.name)) {
      requireThat(JSON.stringify(methods.get(m.name).parameters) === JSON.stringify(m.parameters), `Inconsistent signatures for method ${m.name}`);
      methods.get(m.name).rules.push(t.id);
    } else methods.set(m.name, { name: m.name, parameters: copy(m.parameters), rules: [t.id] });
  }
  return [...methods.values()];
}

function expression(text, variables) {
  const ast = parseArithmetic(text);
  const visit = node => {
    requireThat(node, 'Invalid method expression');
    if (node.type === 'int') { requireThat(validMethodValue(node.value, 'Int'), 'Method literal must be a 32-bit Int'); return; }
    if (node.type === 'var') {
      requireThat(!node.varType && variables.has(node.name), `Unbound method variable: ${node.name}`); return;
    }
    requireThat(node.type === 'binop' && ['+', '-', '*'].includes(node.op), 'Public methods currently support integer literals, variables, addition, subtraction and multiplication');
    visit(node.left); visit(node.right);
  };
  visit(ast); return ast;
}
function evaluate(ast, env) {
  if (ast.type === 'int') return ast.value;
  if (ast.type === 'var') return env[ast.name];
  const a = BigInt(evaluate(ast.left, env)), b = BigInt(evaluate(ast.right, env));
  const value = Number(ast.op === '+' ? a + b : ast.op === '-' ? a - b : a * b);
  requireThat(validMethodValue(value, 'Int'), 'Method arithmetic leaves the supported 32-bit range');
  return value;
}
function holds(guard, env) {
  if (!guard) return true;
  if (guard.type === 'boolLit') return !!guard.value;
  if (guard.type === 'not') return !holds(guard.expr, env);
  if (guard.type === 'and') return holds(guard.left, env) && holds(guard.right, env);
  if (guard.type === 'or') return holds(guard.left, env) || holds(guard.right, env);
  if (guard.type === 'implies') return !holds(guard.left, env) || holds(guard.right, env);
  if (guard.type === 'xor') return holds(guard.left, env) !== holds(guard.right, env);
  if (guard.type === 'iff') return holds(guard.left, env) === holds(guard.right, env);
  const a = evaluate(guard.left, env), b = evaluate(guard.right, env);
  return ({ '<': () => a < b, '<=': () => a <= b, '>': () => a > b, '>=': () => a >= b,
    '==': () => a === b, '!=': () => a !== b })[guard.op]();
}
const source = a => a.sourceId || a.source;
const target = a => a.targetId || a.target;
function binding(a) {
  const bindings = a.bindings ?? (a.binding === undefined ? [] : [a.binding]);
  requireThat(Array.isArray(bindings) && bindings.length === 1 && typeof bindings[0] === 'string' && (a.weight === undefined || a.weight === 1), `Method arc ${a.id} requires one binding and unit multiplicity`);
  return bindings[0].trim();
}

/** Resolve a call without mutating the marking. Multiple distinct enabled choices are unsupported. */
export function prepareMethodCall(net, name, args = {}) {
  const methods = getPublicMethods(net), method = methods.find(m => m.name === name);
  requireThat(method, `Unknown public method: ${name}`);
  requireThat(args && typeof args === 'object' && !Array.isArray(args), 'Method arguments must be a named map');
  requireThat(JSON.stringify(Object.keys(args).sort()) === JSON.stringify(method.parameters.map(p => p.name).sort()), `Arguments for ${methodSignature(method)} must match its declared parameters exactly`);
  for (const p of method.parameters) requireThat(validMethodValue(args[p.name], p.sort), `Argument ${p.name} must be a 32-bit ${p.sort}`);
  const ids = [...net.places, ...net.transitions, ...net.arcs].map(x => x.id);
  requireThat(ids.every(id => typeof id === 'string' && id) && new Set(ids).size === ids.length, 'Net IDs must be nonempty and unique');
  const places = new Map(net.places.map(p => [p.id, p]));
  const candidates = [], seen = new Set();
  let visited = 0;
  for (const ruleId of method.rules) {
    const t = net.transitions.find(t => t.id === ruleId);
    requireThat(!t.action?.trim(), 'Transition action scripts are outside the public-method fragment');
    const incoming = net.arcs.filter(a => target(a) === ruleId);
    const outgoing = net.arcs.filter(a => source(a) === ruleId);
    for (const a of [...incoming, ...outgoing]) {
      requireThat((a.sourceId === undefined || a.source === undefined || a.sourceId === a.source) && (a.targetId === undefined || a.target === undefined || a.targetId === a.target), `Conflicting arc endpoints: ${a.id}`);
      const id = incoming.includes(a) ? source(a) : target(a), p = places.get(id);
      requireThat(p && ['Nat', 'Int'].includes(p.sort), `Method place ${id} must have sort Nat or Int`);
      requireThat(Array.isArray(p.valueTokens) && p.valueTokens.every(v => validMethodValue(v, p.sort)) && p.tokens === p.valueTokens.length, `Invalid marking at ${id}`);
    }
    const ins = incoming.map(a => ({ a, variable: binding(a), place: source(a) }));
    requireThat(ins.every(i => identifier.test(i.variable)), 'Method input arc bindings must be variables');
    const variables = new Set([...method.parameters.map(p => p.name), ...ins.map(i => i.variable)]);
    let guard = null;
    if (t.guard?.trim()) {
      guard = parseBooleanExpr(t.guard, parseArithmetic);
      // Validate every operand while preserving the shared call/input binding.
      const validate = ast => {
        if (ast.type === 'int') { requireThat(validMethodValue(ast.value, 'Int'), 'Method literal must be a 32-bit Int'); return; }
        if (ast.type === 'var') { requireThat(!ast.varType && variables.has(ast.name), `Unbound method variable: ${ast.name}`); return; }
        requireThat(ast.type === 'binop' && ['+', '-', '*'].includes(ast.op), 'Unsupported method guard expression');
        validate(ast.left); validate(ast.right);
      };
      const validateGuard = g => {
        requireThat(g, 'Invalid method guard');
        if (g.type === 'boolLit') return;
        if (g.type === 'not') { validateGuard(g.expr); return; }
        if (['and', 'or', 'xor', 'implies', 'iff'].includes(g.type)) { validateGuard(g.left); validateGuard(g.right); return; }
        requireThat(g.type === 'cmp' && ['<', '<=', '>', '>=', '==', '!='].includes(g.op), `Unsupported method guard in ${ruleId}`);
        validate(g.left); validate(g.right);
      };
      validateGuard(guard);
    }
    const outs = outgoing.map(a => ({ place: target(a), ast: expression(binding(a), variables) }));
    const choose = (i, env, picks) => {
      requireThat(++visited <= 10000, 'Method binding search limit reached; result is unresolved');
      if (i < ins.length) {
        const input = ins[i];
        places.get(input.place).valueTokens.forEach((value, tokenIndex) => {
          if (picks.some(p => p.srcId === input.place && p.tokenIndex === tokenIndex)) return;
          if (Object.hasOwn(env, input.variable) && env[input.variable] !== value) return;
          choose(i + 1, { ...env, [input.variable]: value }, [...picks, { arcId: input.a.id, srcId: input.place, tokenIndex, value, countFallback: false }]);
        }); return;
      }
      if (!holds(guard, env)) return;
      const next = copy(net), nextPlaces = new Map(next.places.map(p => [p.id, p]));
      const produced = {};
      [...picks].sort((a, b) => b.tokenIndex - a.tokenIndex).forEach(p => nextPlaces.get(p.srcId).valueTokens.splice(p.tokenIndex, 1));
      for (const out of outs) {
        const value = evaluate(out.ast, env), p = nextPlaces.get(out.place);
        requireThat(validMethodValue(value, p.sort), `Method output leaves ${p.sort} range at ${p.id}`);
        p.valueTokens.push(value); (produced[p.id] ||= []).push(value);
      }
      next.places.forEach(p => { p.tokens = p.valueTokens.length; });
      const key = JSON.stringify([ruleId, env, next.places.map(p => [p.id, p.valueTokens])]);
      if (!seen.has(key)) { seen.add(key); candidates.push({ transitionId: ruleId, env, picks, produced, next }); }
    };
    choose(0, { ...args }, []);
  }
  requireThat(candidates.length <= 1, `Nondeterministic public call ${name}: multiple enabled rules or bindings are unsupported`);
  return candidates[0] || null;
}
