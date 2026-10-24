import { cacheDiagnostics, hmlCacheEnabled } from './HmlCacheDiagnostics.js';
import { prepareAlgebra } from './GenericSubuniformity.js';
import { evaluateGroundTerm } from './GroundTerms.js';
import { elaborateTerm, variablesIn } from './SymbolicTerms.js';
import { integerBounds } from '../../utils/builtin-values.js';
import { DomainError } from '../../domain/diagnostics.js';

export const not = a => typeof a === 'boolean' ? !a : a?.op === 'not' ? a.left : { op: 'not', left: a };
export const combine = (op, values) => {
  const identity = op === 'and';
  if (values.includes(!identity)) return !identity;
  return values.filter(v => v !== identity).reduce((a, b) => a === identity ? b : { op, left: a, right: b }, identity);
};
export const and = (...values) => combine('and', values), or = (...values) => combine('or', values);
export const implies = (a, b) => or(not(a), b);
export const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b) ? true : typeof a !== 'object' && typeof b !== 'object' ? a === b : { op: '==', left: a, right: b };
const choose = (condition, yes, no) => condition === true ? yes : condition === false ? no : JSON.stringify(yes) === JSON.stringify(no) ? yes : { if: condition, then: yes, else: no };
const is = (ctor, value) => value?.ctor ? value.ctor === ctor : { test: ctor, value };
const field = (ctor, index, value) => value?.ctor === ctor ? value.args[index] : { field: ctor, index, value };
export const valueValid = (value, sort, depth = 64) => {
  if (depth < 0) return false;
  if (value?.if !== undefined) return choose(value.if, valueValid(value.then, sort, depth), valueValid(value.else, sort, depth));
  if (sort === 'List' && value?.ctor === '_ListNil') return true;
  if (sort === 'List' && value?.ctor === '_ListCons') return and(valueValid(value.args[0], 'Any', depth - 1), valueValid(value.args[1], 'List', depth));
  if (sort === 'Pair' && value?.ctor === '_Pair') return and(...value.args.map(v => valueValid(v, 'Any', depth - 1)));
  if (sort === 'Any' && value?.ctor?.startsWith('_Any')) {
    const tagSort = value.ctor.slice(4);
    return ['Int', 'Bool', 'String', 'List', 'Pair'].includes(tagSort) && valueValid(value.args[0], tagSort, depth - 1);
  }
  if (['Nat', 'Int'].includes(sort)) {
    const { min, max } = integerBounds(sort);
    return typeof value === 'number' ? value >= min && value <= max : and({ op: '>=', left: value, right: min }, { op: '<=', left: value, right: max });
  }
  return ['Bool', 'String'].includes(sort) ? true : { valid: sort, value, depth };
};
const fallback = sort => sort === 'Bool' ? false : sort === 'String' ? '' : sort === 'List' ? { ctor: '_ListNil', args: [] } : sort === 'Any' ? { ctor: '_AnyInt', args: [0] } : sort === 'Pair' ? { ctor: '_Pair', args: [fallback('Any'), fallback('Any')] } : 0;

/** Bounded equation expansion with a separate definedness condition. Constructor
 * tests/fields and conditionals preserve branch scope without independently
 * choosing values for a method parameter in different HML outcomes. Undefined
 * branches have a total placeholder value but can never be used safely.
 */
export function createHmlTerms(source, tick, stats, options = {}) {
  const algebra = prepareAlgebra(source), depth = options.maxHmlUnfoldingDepth ?? 4;
  if (!Number.isInteger(depth) || depth < 1 || depth > 32) throw new DomainError('invalid-test', 'HML unfolding depth must be between 1 and 32');
  stats.equationExpansions = 0;
  stats.residualCalls = 0;
  stats.preparedExpressions = 0;
  stats.expressionRequests = 0;
  stats.expressionCacheHits = 0;
  const memo = new Map();
  const reuseOperations = hmlCacheEnabled(options, 'operations'), reuseExpressions = hmlCacheEnabled(options, 'expressions');
  const profile = cacheDiagnostics(options, stats, 'expressions');
  const operationProfile = cacheDiagnostics(options, stats, 'operations');
  const run = (t, env, remaining, runtime) => {
    tick();
    if (t?.var) return { term: env[t.var], safe: true };
    if (t?.undefined) return { term: null, safe: false };
    if (t?.op) {
      const a = run(t.left, env, remaining, runtime);
      if (t.op === 'not') return { term: not(a.term), safe: a.safe };
      // Do not unfold an already irrelevant right-hand side.
      const shortCircuit = t.op === 'and' && a.term === false || t.op === 'or' && a.term === true || t.op === 'implies' && a.term === false;
      if (shortCircuit) return { term: t.op !== 'and', safe: a.safe };
      const b = run(t.right, env, remaining, runtime);
      const term = t.op === 'and' ? and(a.term, b.term) : t.op === 'or' ? or(a.term, b.term) : t.op === 'implies' ? implies(a.term, b.term) : t.op === '==' ? eq(a.term, b.term) : t.op === '!=' ? not(eq(a.term, b.term)) : { op: t.op, left: a.term, right: b.term };
      return { term, safe: and(a.safe, ['and', 'implies'].includes(t.op) ? implies(a.term, b.safe) : t.op === 'or' ? implies(not(a.term), b.safe) : b.safe, runtime && ['+', '-', '*'].includes(t.op) ? valueValid(term, 'Int') : true) };
    }
    if (t?.ctor || t?.call) {
      const args = t.args.map(a => run(a, env, remaining, runtime));
      if (t.ctor) return { term: { ...t, args: args.map(a => a.term) }, safe: and(...args.map(a => a.safe)) };
      const signature = algebra.operations[t.call];
      const result = expand(t.call, args.map(a => a.term), remaining);
      return { term: result.term, safe: and(...args.map(a => a.safe), result.safe, ...(runtime ? args.map((a, i) => valueValid(a.term, signature.parameters[i])).concat(valueValid(result.term, signature.result)) : [])) };
    }
    return { term: t, safe: true };
  };
  const expand = (name, args, remaining) => {
    tick();
    const signature = algebra.operations[name];
    if (!signature?.builtin) throw new DomainError('unsupported-model', `Joint HML method operation is unsupported: ${name}`);
    if (signature.primitive) return { term: { call: name, args }, safe: true };
    const key = reuseOperations ? operationProfile.measure('key', () => JSON.stringify([name, args, remaining])) : null;
    if (reuseOperations && operationProfile.measure('lookup', () => memo.has(key))) return memo.get(key);
    if (!variablesIn(args).size) {
      try {
        const result = { term: evaluateGroundTerm({ call: name, args }, algebra, 1000), safe: true };
        if (reuseOperations) { memo.set(key, result); operationProfile.retain('results'); } return result;
      } catch (error) {
        if (error instanceof TypeError || error instanceof ReferenceError) throw error;
        if (error.code === 'resource-limit') stats.residualCalls++;
        return { term: fallback(signature.result), safe: false };
      }
    }
    // Known constructor spines are finite already and consume work, not the
    // unknown-shape depth budget. Ground reduction has its own step cap above.
    const splitsConstructors = signature.rules.some(r => r.patterns.some((p, i) => p?.ctor && !args[i]?.ctor));
    if (splitsConstructors && remaining === 0) {
      stats.residualCalls++;
      return { term: fallback(signature.result), safe: false };
    }
    const nextDepth = splitsConstructors ? remaining - 1 : remaining;
    stats.equationExpansions++;
    const branches = [], applicabilitySafety = [];
    for (const rule of signature.rules) {
      const env = {};
      const match = (pattern, value) => {
        tick();
        if (pattern?.var) {
          if (Object.hasOwn(env, pattern.var)) return eq(env[pattern.var], value);
          env[pattern.var] = value; return true;
        }
        if (!pattern?.ctor) return eq(pattern, value);
        const tag = is(pattern.ctor, value);
        if (tag === false) return false;
        return and(tag, ...pattern.args.map((p, i) => match(p, field(pattern.ctor, i, value))));
      };
      let matches = and(...rule.patterns.map((p, i) => match(p, args[i])));
      if (matches === false) continue;
      for (const c of rule.conditions || []) {
        const checked = run(c, env, nextDepth, false);
        applicabilitySafety.push(implies(matches, checked.safe));
        matches = and(matches, checked.term);
      }
      if (matches === false) continue;
      const result = rule.result?.undefined ? { term: fallback(signature.result), safe: false } : run(rule.result, env, nextDepth, false);
      branches.push({ matches, term: result.term, safe: result.safe });
    }
    // Built-in equations are disjoint. Retain that requirement explicitly so a
    // future overlapping definition cannot be treated as a choice of outputs.
    const unique = [];
    for (let i = 0; i < branches.length; i++) for (let j = i + 1; j < branches.length; j++) unique.push(not(and(branches[i].matches, branches[j].matches)));
    const result = {
      term: branches.reduceRight((rest, b) => choose(b.matches, b.term, rest), fallback(signature.result)),
      safe: and(...applicabilitySafety, ...unique, or(...branches.map(b => and(b.matches, b.safe))))
    };
    if (reuseOperations) { memo.set(key, result); operationProfile.retain('results'); }
    return result;
  };
  // Local to this construction: algebra, unfolding depth and runtime semantics
  // are fixed. Only bindings of free variables in an expression can affect its
  // translation. Keep both its value and definedness; never cache a truth verdict
  // or project places out of a marking. Hits still consume work/check cancellation.
  const expressions = new Map();
  return (term, env, variables, expected) => {
    tick();
    stats.expressionRequests++;
    const key = reuseExpressions ? profile.measure('key', () => JSON.stringify([term, variables, expected])) : null;
    let prepared = reuseExpressions ? profile.measure('lookup', () => expressions.get(key)) : null;
    if (!prepared) {
      const typed = profile.measure('preparation', () => elaborateTerm(term, variables, algebra, expected));
      prepared = { typed, dependencies: [...variablesIn(typed)].sort(), results: new Map() };
      if (reuseExpressions) { expressions.set(key, prepared); profile.retain('prepared'); }
      stats.preparedExpressions++;
    }
    const bindings = reuseExpressions ? profile.measure('key', () => JSON.stringify(prepared.dependencies.map(name => [name, env[name]]))) : null;
    if (reuseExpressions && profile.measure('lookup', () => prepared.results.has(bindings))) {
      stats.expressionCacheHits++;
      return prepared.results.get(bindings);
    }
    const result = profile.measure('computation', () => run(prepared.typed, env, depth, true));
    if (reuseExpressions) { prepared.results.set(bindings, result); profile.retain('results'); }
    return result;
  };
}
