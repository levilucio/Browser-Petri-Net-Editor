import { compilePublicNet, isMethodRule } from '../../domain/apn/PublicMethods.js';
import { integerBounds, validBuiltinValue } from '../../utils/builtin-values.js';
import { checkCancelled, DomainError } from '../../domain/diagnostics.js';
import { validateFormula, mapFormula } from './HmlFormula.js';
import { termSort } from './SymbolicTerms.js';

const scalar = sort => ['Nat', 'Int', 'Bool'].includes(sort);
const unsupported = message => { throw new DomainError('unsupported-model', `Joint HML selection: ${message}`); };
const invalid = message => { throw new DomainError('invalid-test', message); };
const not = a => typeof a === 'boolean' ? !a : a?.op === 'not' ? a.left : { op: 'not', left: a };
const combine = (op, values) => {
  const identity = op === 'and', decisive = !identity;
  if (values.includes(decisive)) return decisive;
  return values.filter(v => v !== identity).reduce((a, b) => a === identity ? b : { op, left: a, right: b }, identity);
};
const and = (...values) => combine('and', values), or = (...values) => combine('or', values);
const implies = (a, b) => or(not(a), b);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b) ? true : typeof a !== 'object' && typeof b !== 'object' ? a === b : { op: '==', left: a, right: b };
const range = (term, sort) => {
  if (sort === 'Bool') return true;
  const { min, max } = integerBounds(sort);
  if (typeof term === 'number') return term >= min && term <= max;
  return and({ op: '>=', left: term, right: min }, { op: '<=', left: term, right: max });
};

/** Finite HML constraint construction over symbolic scalar markings.
 * A diamond is a disjunction over eligible edges; a box is a conjunction of
 * implications, never a conjunction of enabledness conditions. All branches
 * share the caller's root terms. Incomplete construction throws, never returns
 * a truncated universal obligation. Concrete replay remains mandatory.
 */
export async function buildHmlConstraints(formula, net, io, roots, sorts, algebra, options = {}) {
  validateFormula(formula);
  if (!['algebraic', 'algebraic-int'].includes(net.mode) || !net.transitions.length || net.transitions.some(t => !isMethodRule(t))) unsupported('requires public-method algebraic APNs');
  if (net.places.some(p => !scalar(p.sort)) || Object.values(sorts).some(s => !scalar(s))) unsupported('this increment supports Nat, Int and Bool only; ADT/String joint selection is not implemented');
  const compiled = compilePublicNet(net), places = new Map(net.places.map(p => [p.id, p]));
  if (compiled.methods.some(m => m.parameters.some(p => !scalar(p.sort)))) unsupported('method parameters must have sort Nat, Int or Bool');
  for (const p of net.places) if (!Array.isArray(p.valueTokens) || p.tokens !== p.valueTokens.length || !p.valueTokens.every(v => validBuiltinValue(v, p.sort))) invalid(`Invalid initial marking at ${p.id}`);
  const maxWork = options.maxHmlSelectionWork ?? 10000, maxNodes = options.maxHmlSelectionNodes ?? 2000;
  const deadline = Math.min(options.deadline ?? Infinity, Date.now() + (options.maxHmlSelectionTimeMs ?? 10000));
  if (![maxWork, maxNodes, options.maxHmlSelectionTimeMs ?? 10000, options.maxHmlConstraintSize ?? 100000].every(n => Number.isInteger(n) && n > 0)) invalid('HML selection budgets must be positive integers');
  const stats = { work: 0, nodes: 0, cacheHits: 0, outcomes: 0 };
  const tick = () => {
    checkCancelled(options.signal);
    if (++stats.work > maxWork || Date.now() >= deadline) throw new DomainError('resource-limit', 'Joint HML constraint construction budget exhausted');
  };
  // Restrict operations explicitly. Arithmetic intermediates are checked below
  // with the concrete simulator's signed 32-bit semantics, not unbounded Int.
  const inspectTerm = term => {
    tick();
    if (typeof term === 'number' || typeof term === 'boolean' || term?.var) return;
    if (!term?.op || !['+', '-', '*', '==', '!=', '<', '<=', '>', '>=', 'and', 'or', 'not', 'implies', 'iff', 'xor'].includes(term.op)) unsupported('method expressions must use scalar arithmetic and Boolean operators');
    inspectTerm(term.left); if (term.op !== 'not') inspectTerm(term.right);
  };
  for (const plans of Object.values(compiled.plans)) for (const plan of plans) {
    if (plan.guard !== null && plan.guard !== undefined) inspectTerm(plan.guard);
    plan.outs.forEach(out => inspectTerm(out.ast));
  }
  const preconditions = [];
  const value = (raw, expected) => {
    let term;
    if (typeof raw === 'string' && raw.startsWith('$') && Object.hasOwn(roots, raw.slice(1))) term = roots[raw.slice(1)];
    else if (typeof raw === 'number' && Number.isSafeInteger(raw) || typeof raw === 'boolean') term = raw;
    else invalid(`Expected a scalar value or declared goal variable for ${expected}`);
    if ((typeof raw === 'number' || typeof raw === 'boolean') && !validBuiltinValue(raw, expected)) invalid(`Invalid ${expected} literal in HML requirement`);
    const actual = termSort(term, sorts, algebra);
    if (actual !== expected && !(['Nat', 'Int'].includes(actual) && ['Nat', 'Int'].includes(expected))) invalid(`HML value has sort ${actual}; expected ${expected}`);
    inspectTerm(term);
    preconditions.push(range(term, expected));
    return term;
  };
  const markings = constraints => Object.fromEntries(Object.entries(constraints || {}).map(([id, c]) => {
    if (!places.has(id)) invalid(`Unknown marking place: ${id}`);
    if (!c || Object.keys(c).length !== 1) invalid('Use one marking predicate per place');
    const [kind] = Object.keys(c);
    if (['equals', 'contains'].includes(kind)) {
      if (!Array.isArray(c[kind])) invalid('Expected marking token list');
      return [id, { [kind]: c[kind].map(t => value(t, places.get(id).sort)) }];
    }
    if (kind === 'length') return [id, { length: value(c.length, 'Nat') }];
    if (kind === 'empty') return [id, { empty: value(c.empty, 'Bool') }];
    invalid(`Unknown marking predicate: ${kind}`);
  }));
  // Preflight every node, even syntactically unreachable ones, like replay.
  const symbolic = mapFormula(formula, node => {
    if (node.op === 'marking') return { ...node, markings: markings(node.markings) };
    const method = compiled.methods.find(m => m.name === node.stimulation.method);
    if (!method || JSON.stringify(Object.keys(node.stimulation.arguments).sort()) !== JSON.stringify(method.parameters.map(p => p.name).sort())) invalid('Invalid method signature in HML requirement');
    const arguments_ = Object.fromEntries(method.parameters.map(p => [p.name, value(node.stimulation.arguments[p.name], p.sort)]));
    let observation;
    if (node.observation) {
      const outputs = Object.fromEntries(Object.entries(node.observation.outputs).map(([id, ts]) => {
        if (!places.has(id)) invalid(`Unknown observation place: ${id}`);
        return [id, ts.map(t => value(t, places.get(id).sort))];
      }));
      if (node.observation.scope === 'public' && JSON.stringify(Object.keys(outputs).sort()) !== JSON.stringify([...io.outputs].sort())) invalid('Public observations must list every public output');
      observation = { outputs, markings: markings(node.observation.markings) };
    }
    return { ...node, stimulation: { method: method.name, arguments: arguments_ }, ...(observation ? { observation } : {}) };
  });
  const expression = (t, env) => {
    tick();
    if (t?.var) return { term: env[t.var], safe: true };
    if (!t?.op) return { term: t, safe: true };
    const a = expression(t.left, env);
    if (t.op === 'not') return { term: not(a.term), safe: a.safe };
    const b = expression(t.right, env);
    const term = t.op === 'and' ? and(a.term, b.term) : t.op === 'or' ? or(a.term, b.term) : t.op === 'implies' ? implies(a.term, b.term) : t.op === '==' ? eq(a.term, b.term) : t.op === '!=' ? not(eq(a.term, b.term)) : { op: t.op, left: a.term, right: b.term };
    const safe = and(a.safe, ['and', 'implies'].includes(t.op) ? implies(a.term, b.safe) : t.op === 'or' ? implies(not(a.term), b.safe) : b.safe, ['+', '-', '*'].includes(t.op) ? range(term, 'Int') : true);
    return { term, safe };
  };
  const bagMatch = (actual, expected, exact = true, i = 0, used = []) => {
    tick();
    if (exact && actual.length !== expected.length || actual.length < expected.length) return false;
    if (i === expected.length) return true;
    const seen = new Set(), alternatives = [];
    actual.forEach((token, j) => {
      const key = JSON.stringify(token);
      if (used.includes(j) || seen.has(key)) return;
      seen.add(key);
      const matches = eq(token, expected[i]);
      if (matches !== false) alternatives.push(and(matches, bagMatch(actual, expected, exact, i + 1, [...used, j])));
    });
    return or(...alternatives);
  };
  const markingMatches = (marking, constraints) => and(...Object.entries(constraints || {}).map(([id, c]) => {
    if (c.equals !== undefined) return bagMatch(marking[id], c.equals);
    if (c.contains !== undefined) return bagMatch(marking[id], c.contains, false);
    if (c.length !== undefined) return eq(marking[id].length, c.length);
    return eq(marking[id].length === 0, c.empty);
  }));
  const memo = new WeakMap();
  const visit = async (node, marking) => {
    tick();
    const key = JSON.stringify(Object.entries(marking).map(([id, ts]) => [id, ts.map(t => JSON.stringify(t)).sort()]));
    if (memo.get(node)?.has(key)) { stats.cacheHits++; return memo.get(node).get(key); }
    if (++stats.nodes > maxNodes) throw new DomainError('resource-limit', 'Joint HML formula/state budget exhausted');
    if (stats.nodes % 32 === 0) { await new Promise(resolve => setTimeout(resolve, 0)); tick(); }
    let result;
    if (node.op === 'true' || node.op === 'false') result = { truth: node.op === 'true', safe: true };
    else if (node.op === 'marking') result = { truth: markingMatches(marking, node.markings), safe: true };
    else if (node.op === 'not') {
      const child = await visit(node.child, marking);
      result = { truth: not(child.truth), safe: child.safe };
    } else if (node.children) {
      const children = [], safety = [];
      let reached = true;
      for (const child of node.children) {
        const checked = await visit(child, marking);
        children.push(checked);
        safety.push(implies(reached, checked.safe));
        reached = and(reached, node.op === 'and' ? checked.truth : not(checked.truth));
      }
      result = { truth: combine(node.op, children.map(c => c.truth)), safe: and(...safety) };
    } else {
      const terms = [], safety = [];
      let reached = true;
      for (const plan of compiled.plans[node.stimulation.method]) {
        const bind = async (i, env, picks, matching) => {
          tick();
          if (matching === false) return;
          if (i < plan.ins.length) {
            const input = plan.ins[i], seen = new Set();
            for (const [j, token] of marking[input.place].entries()) {
              const tokenKey = JSON.stringify(token);
              if (picks.some(p => p.place === input.place && p.index === j) || seen.has(tokenKey)) continue;
              seen.add(tokenKey);
              await bind(i + 1, { ...env, [input.variable]: token }, [...picks, { place: input.place, index: j }], and(matching, Object.hasOwn(env, input.variable) ? eq(env[input.variable], token) : true));
            }
            return;
          }
          const guard = plan.guard === null || plan.guard === undefined ? { term: true, safe: true } : expression(plan.guard, env);
          safety.push(implies(matching, guard.safe));
          const enabled = and(matching, guard.term);
          if (enabled === false) return;
          stats.outcomes++;
          const next = Object.fromEntries(Object.entries(marking).map(([id, ts]) => [id, ts.filter((_, j) => !picks.some(p => p.place === id && p.index === j))]));
          const produced = {}, outputSafety = [];
          for (const output of plan.outs) {
            const v = expression(output.ast, env);
            outputSafety.push(v.safe, range(v.term, places.get(output.place).sort));
            next[output.place].push(v.term);
            (produced[output.place] ||= []).push(v.term);
          }
          safety.push(implies(enabled, and(...outputSafety)));
          let matches = node.observation ? and(...Object.entries(node.observation.outputs).map(([id, ts]) => bagMatch(produced[id] || [], ts)), markingMatches(next, node.observation.markings)) : true;
          if (node.excludeObservation) matches = not(matches);
          const eligible = and(enabled, matches);
          if (eligible === false) return;
          const child = await visit(node.child, next);
          terms.push(node.op === 'diamond' ? and(eligible, child.truth) : implies(eligible, child.truth));
          safety.push(implies(and(reached, eligible), child.safe));
          reached = and(reached, not(and(eligible, node.op === 'diamond' ? child.truth : not(child.truth))));
        };
        await bind(0, node.stimulation.arguments, [], true);
      }
      result = { truth: combine(node.op === 'diamond' ? 'or' : 'and', terms), safe: and(...safety) };
    }
    if (!memo.has(node)) memo.set(node, new Map());
    memo.get(node).set(key, result);
    return result;
  };
  const result = await visit(symbolic, Object.fromEntries(net.places.map(p => [p.id, [...p.valueTokens]])));
  const conditions = [...preconditions, result.safe, options.expectedTruth === false ? not(result.truth) : result.truth];
  // Bound expanded serialization too: memoization alone does not bound the size
  // of a formula DAG when later substitution/SMT encoding traverses its edges.
  let size = 0;
  const measure = t => { if (++size > (options.maxHmlConstraintSize ?? 100000)) throw new DomainError('resource-limit', 'Joint HML constraint size budget exhausted'); if (t && typeof t === 'object') Object.values(t).forEach(measure); };
  measure(conditions);
  return { conditions, stats: { ...stats, constraintSize: size }, policy: 'joint-sequence-and-hml', expectedTruth: options.expectedTruth ?? true };
}
