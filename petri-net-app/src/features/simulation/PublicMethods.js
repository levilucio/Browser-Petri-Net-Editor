/** Checked, synchronous public methods for the built-in APN values. */
import { compileMethodTerm, evaluateMethodTerm } from './MethodTerms.js';
import { methodSorts, validBuiltinValue, builtinValueKey } from '../../utils/builtin-values.js';
import { equalValues } from '../../utils/value-equality.js';

const copy = x => JSON.parse(JSON.stringify(x));
const requireThat = (ok, message) => { if (!ok) throw new Error(message); };
const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const isMethodRule = t => t.method !== undefined && t.method !== null;
export const validMethodValue = validBuiltinValue;
export const methodSignature = m => `${m.name}(${m.parameters.map(p => `${p.name}: ${p.sort}`).join(', ')})`;

export function getPublicMethods(net) {
  const methods = new Map();
  for (const t of net.transitions || []) {
    if (!isMethodRule(t)) continue;
    const m = t.method;
    requireThat(m && typeof m.name === 'string' && identifier.test(m.name) && Array.isArray(m.parameters), `Invalid public method declaration: ${t.id}`);
    requireThat(m.parameters.every(p => p && typeof p.name === 'string' && identifier.test(p.name) && methodSorts.includes(p.sort)), `Method ${m.name}: parameters must have names and supported built-in sorts`);
    requireThat(new Set(m.parameters.map(p => p.name)).size === m.parameters.length, `Duplicate parameter in ${m.name}`);
    if (methods.has(m.name)) {
      requireThat(JSON.stringify(methods.get(m.name).parameters) === JSON.stringify(m.parameters), `Inconsistent signatures for method ${m.name}`);
      methods.get(m.name).rules.push(t.id);
    } else methods.set(m.name, { name: m.name, parameters: copy(m.parameters), rules: [t.id] });
  }
  return [...methods.values()];
}

const source = a => a.sourceId || a.source;
const target = a => a.targetId || a.target;
function binding(a) {
  const bindings = a.bindings ?? (a.binding === undefined ? [] : [a.binding]);
  requireThat(Array.isArray(bindings) && bindings.length === 1 && typeof bindings[0] === 'string' && (a.weight === undefined || a.weight === 1), `Method arc ${a.id} requires one binding and unit multiplicity`);
  return bindings[0].trim();
}

/** Shared typed rule plan for concrete execution and symbolic path generation. */
export function compileMethodRule(net, method, ruleId) {
  const places = new Map(net.places.map(p => [p.id, p]));
  const t = net.transitions.find(t => t.id === ruleId);
  requireThat(!t.action?.trim(), 'Transition action scripts are outside the public-method fragment');
  const incoming = net.arcs.filter(a => target(a) === ruleId);
  const outgoing = net.arcs.filter(a => source(a) === ruleId);
  for (const a of [...incoming, ...outgoing]) {
    requireThat((a.sourceId === undefined || a.source === undefined || a.sourceId === a.source) && (a.targetId === undefined || a.target === undefined || a.targetId === a.target), `Conflicting arc endpoints: ${a.id}`);
    const id = incoming.includes(a) ? source(a) : target(a), p = places.get(id);
    requireThat(p && methodSorts.includes(p.sort), `Method place ${id} must have a supported built-in sort`);
    requireThat(Array.isArray(p.valueTokens) && p.valueTokens.every(v => validMethodValue(v, p.sort)) && p.tokens === p.valueTokens.length, `Invalid marking at ${id}`);
  }
  const ins = incoming.map(a => ({ a, variable: binding(a), place: source(a) }));
  requireThat(ins.every(i => identifier.test(i.variable)), 'Method input arc bindings must be variables');
  const variables = Object.fromEntries(method.parameters.map(p => [p.name, p.sort]));
  for (const input of ins) {
    const sort = places.get(input.place).sort;
    requireThat(!variables[input.variable] || variables[input.variable] === sort || ['Nat', 'Int'].every(s => [variables[input.variable], sort].includes(s)), `Conflicting method variable sort: ${input.variable}`);
    variables[input.variable] ||= sort;
  }
  const guard = t.guard?.trim() ? compileMethodTerm(t.guard, variables, 'Bool') : null;
  const outs = outgoing.map(a => ({ place: target(a), ast: compileMethodTerm(binding(a), variables, places.get(target(a)).sort) }));
  return { ins, outs, guard, variables };
}

/** Resolve a call without mutating the marking. Multiple distinct enabled choices are unsupported. */
export function prepareMethodCall(net, name, args = {}) {
  args = copy(args);
  const methods = getPublicMethods(net), method = methods.find(m => m.name === name);
  requireThat(method, `Unknown public method: ${name}`);
  requireThat(args && typeof args === 'object' && !Array.isArray(args), 'Method arguments must be a named map');
  requireThat(JSON.stringify(Object.keys(args).sort()) === JSON.stringify(method.parameters.map(p => p.name).sort()), `Arguments for ${methodSignature(method)} must match its declared parameters exactly`);
  for (const p of method.parameters) requireThat(validMethodValue(args[p.name], p.sort), `Argument ${p.name} must be a valid ${p.sort} (integers use the 32-bit range)`);
  const ids = [...net.places, ...net.transitions, ...net.arcs].map(x => x.id);
  requireThat(ids.every(id => typeof id === 'string' && id) && new Set(ids).size === ids.length, 'Net IDs must be nonempty and unique');
  const places = new Map(net.places.map(p => [p.id, p]));
  const candidates = [], seen = new Set();
  let visited = 0;
  for (const ruleId of method.rules) {
    const { ins, outs, guard } = compileMethodRule(net, method, ruleId);
    const choose = (i, env, picks) => {
      requireThat(++visited <= 10000, 'Method binding search limit reached; result is unresolved');
      if (i < ins.length) {
        const input = ins[i];
        places.get(input.place).valueTokens.forEach((value, tokenIndex) => {
          if (picks.some(p => p.srcId === input.place && p.tokenIndex === tokenIndex)) return;
          if (Object.hasOwn(env, input.variable) && !equalValues(env[input.variable], value)) return;
          choose(i + 1, { ...env, [input.variable]: value }, [...picks, { arcId: input.a.id, srcId: input.place, tokenIndex, value, countFallback: false }]);
        }); return;
      }
      if (guard) {
        const enabled = evaluateMethodTerm(guard, env);
        requireThat(typeof enabled === 'boolean', 'Method guard must evaluate to Bool');
        if (!enabled) return;
      }
      const next = copy(net), nextPlaces = new Map(next.places.map(p => [p.id, p]));
      const produced = {};
      [...picks].sort((a, b) => b.tokenIndex - a.tokenIndex).forEach(p => nextPlaces.get(p.srcId).valueTokens.splice(p.tokenIndex, 1));
      for (const out of outs) {
        const value = evaluateMethodTerm(out.ast, env), p = nextPlaces.get(out.place);
        requireThat(validMethodValue(value, p.sort), `Method output leaves ${p.sort} range at ${p.id}`);
        p.valueTokens.push(copy(value)); (produced[p.id] ||= []).push(copy(value));
      }
      next.places.forEach(p => { p.tokens = p.valueTokens.length; });
      const key = JSON.stringify([ruleId, Object.keys(env).sort().map(n => [n, builtinValueKey(env[n])]), next.places.map(p => [p.id, p.valueTokens.map(builtinValueKey).sort()])]);
      if (!seen.has(key)) { seen.add(key); candidates.push({ transitionId: ruleId, env, picks, produced, next }); }
    };
    choose(0, { ...args }, []);
  }
  requireThat(candidates.length <= 1, `Nondeterministic public call ${name}: multiple enabled rules or bindings are unsupported`);
  return candidates[0] || null;
}
