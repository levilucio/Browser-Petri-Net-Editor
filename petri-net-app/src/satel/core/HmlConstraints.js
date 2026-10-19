import { compilePublicNet, isMethodRule } from '../../domain/apn/PublicMethods.js';
import { methodSorts, valueToSymbolic, validBuiltinValue } from '../../utils/builtin-values.js';
import { checkCancelled, DomainError } from '../../domain/diagnostics.js';
import { validateFormula, mapFormula } from './HmlFormula.js';
import { termSort } from './SymbolicTerms.js';
import { packTermGraph, termSize } from '../../domain/algebra/TermGraph.js';

import { createHmlTerms, not, combine, and, or, implies, eq, valueValid as range } from './HmlTerms.js';
const unsupported = message => { throw new DomainError('unsupported-model', `Joint HML selection: ${message}`); };
const invalid = message => { throw new DomainError('invalid-test', message); };
/** Finite HML constraint construction over symbolic built-in markings.
 * A diamond is a disjunction over eligible edges; a box is a conjunction of
 * implications, never a conjunction of enabledness conditions. All branches
 * share the caller's root terms. Incomplete construction throws, never returns
 * a truncated universal obligation. Concrete replay remains mandatory.
 */
export async function buildHmlConstraints(formula, net, io, roots, sorts, algebra, options = {}) {
  validateFormula(formula);
  if (!['algebraic', 'algebraic-int'].includes(net.mode) || !net.transitions.length || net.transitions.some(t => !isMethodRule(t))) unsupported('requires public-method algebraic APNs');
  if (net.places.some(p => !methodSorts.includes(p.sort))) unsupported('method places must use supported built-in sorts');
  const compiled = compilePublicNet(net), places = new Map(net.places.map(p => [p.id, p]));
  for (const p of net.places) if (!Array.isArray(p.valueTokens) || p.tokens !== p.valueTokens.length || !p.valueTokens.every(v => validBuiltinValue(v, p.sort))) invalid(`Invalid initial marking at ${p.id}`);
  const maxWork = options.maxHmlSelectionWork ?? 10000, maxNodes = options.maxHmlSelectionNodes ?? 2000;
  const deadline = Math.min(options.deadline ?? Infinity, Date.now() + (options.maxHmlSelectionTimeMs ?? 10000));
  if (![maxWork, maxNodes, options.maxHmlSelectionTimeMs ?? 10000, options.maxHmlConstraintSize ?? 100000].every(n => Number.isInteger(n) && n > 0)) invalid('HML selection budgets must be positive integers');
  const stats = { work: 0, nodes: 0, cacheHits: 0, outcomes: 0 };
  const tick = () => {
    checkCancelled(options.signal);
    if (++stats.work > maxWork || Date.now() >= deadline) throw new DomainError('resource-limit', 'Joint HML constraint construction budget exhausted');
  };
  const expression = createHmlTerms(algebra, tick, stats, options);
  const preconditions = [];
  const value = (raw, expected, depth = 0) => {
    if (depth > 64) invalid('HML value exceeds supported nesting depth');
    let term;
    if (typeof raw === 'string' && raw.startsWith('$')) {
      if (!Object.hasOwn(roots, raw.slice(1))) invalid(`Undeclared goal variable: ${raw}`);
      term = roots[raw.slice(1)];
    } else if (raw && typeof raw === 'object' && Object.keys(raw).length === 1 && typeof raw.literal === 'string') term = raw.literal;
    else if (Array.isArray(raw)) term = raw.reduceRight((tail, v) => ({ ctor: '_ListCons', args: [value(v, 'Any', depth + 1), tail] }), { ctor: '_ListNil', args: [] });
    else if (raw?.__pair__ === true && Object.keys(raw).length === 3) term = { ctor: '_Pair', args: [value(raw.fst, 'Any', depth + 1), value(raw.snd, 'Any', depth + 1)] };
    else if (validBuiltinValue(raw, expected)) term = valueToSymbolic(raw);
    else invalid(`Expected a valid ${expected} value or declared goal variable`);
    let actual = termSort(term, sorts, algebra);
    if (expected === 'Any' && actual !== 'Any') {
      term = { ctor: `_Any${actual === 'Nat' ? 'Int' : actual}`, args: [term] };
      actual = 'Any';
    }
    if (actual !== expected && !(['Nat', 'Int'].includes(actual) && ['Nat', 'Int'].includes(expected))) invalid(`HML value has sort ${actual}; expected ${expected}`);
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
          const guard = plan.guard === null || plan.guard === undefined ? { term: true, safe: true } : expression(plan.guard, env, plan.variables, 'Bool');
          safety.push(implies(matching, guard.safe));
          const enabled = and(matching, guard.term);
          if (enabled === false) return;
          stats.outcomes++;
          const next = Object.fromEntries(Object.entries(marking).map(([id, ts]) => [id, ts.filter((_, j) => !picks.some(p => p.place === id && p.index === j))]));
          const produced = {}, outputSafety = [];
          for (const output of plan.outs) {
            const v = expression(output.ast, env, plan.variables, places.get(output.place).sort);
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
  const result = await visit(symbolic, Object.fromEntries(net.places.map(p => [p.id, p.valueTokens.map(valueToSymbolic)])));
  const obligations = [...preconditions, result.safe, options.expectedTruth === false ? not(result.truth) : result.truth];
  // Keep conjunction order for lazy definedness checking. Packing preserves
  // shared terms through ordinary JSON traversal/substitution without expanding
  // them back into a tree. The size budget now bounds the stored representation.
  const expandedConstraintSize = termSize(obligations);
  const graph = packTermGraph(obligations.reduce((left, right) => ({ op: 'and', left, right }), true));
  const conditions = [graph], size = termSize(conditions);
  if (size > (options.maxHmlConstraintSize ?? 100000)) throw new DomainError('resource-limit', 'Joint HML constraint size budget exhausted');
  tick();
  return { conditions, stats: { ...stats, constraintSize: size, expandedConstraintSize, sharedTermNodes: graph.termGraph?.length || 0 }, policy: 'joint-sequence-and-hml', expectedTruth: options.expectedTruth ?? true };
}
