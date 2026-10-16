import { createSymbolicSolver } from './SymbolicZ3.js';
import { evaluateGround, substitute, unify, variablesIn, validateSymbolicGoal, termSort } from './SymbolicTerms.js';

// Locate an innermost call anywhere: arguments, conditions, or equation result.
function findCall(t, path = []) {
  if (!t || typeof t !== 'object') return null;
  for (const [k, v] of Object.entries(t)) {
    const found = findCall(v, [...path, k]); if (found) return found;
  }
  return t.call ? { term: t, path } : null;
}
function replace(t, path, value) {
  if (!path.length) return value;
  const out = Array.isArray(t) ? [...t] : { ...t };
  out[path[0]] = replace(t[path[0]], path.slice(1), value); return out;
}

/** Symbolic equation narrowing, with a visible frontier and strict SMT feasibility. */
export async function deriveGenericSubdomains(goal, options = {}) {
  goal = JSON.parse(JSON.stringify(goal)); validateSymbolicGoal(goal);
  const { algebra, operation, args, variables = {}, maxDepth = 2 } = goal;
  const maxBranches = options.maxBranches ?? 256;
  if (!Number.isInteger(maxBranches) || maxBranches < 1 || maxBranches > 2048) throw new Error('Branch budget must be between 1 and 2048');
  const solve = options.solve || await createSymbolicSolver(algebra, options);
  const deadline = Date.now() + (options.maxTimeMs ?? 20000);
  const sorts = { ...variables }; let serial = 0, expanded = 0;
  const domains = [], infeasible = [], unresolved = [], overlaps = [];
  const pending = [{ bindings: new Map(), conditions: goal.conditions || [], result: { call: operation, args }, rules: [], remaining: maxDepth }];
  while (pending.length) {
    const branch = pending.pop();
    const body = substitute({ conditions: branch.conditions, result: branch.result }, branch.bindings);
    const patterns = substitute(args, branch.bindings);
    const found = findCall(body);
    // Only fully unfolded conditions can be asserted; the others stay in the frontier.
    const constraints = body.conditions.filter(c => !findCall(c));
    const feasibility = Date.now() >= deadline ? { status: 'unknown', reason: 'Total derivation time budget exhausted' } : await solve({ terms: [patterns, body.result], conditions: constraints, variables: sorts, witness: !found });
    const record = { id: branch.rules.join('/') || 'root', rules: branch.rules, patterns, conditions: body.conditions, resultPattern: body.result };
    if (feasibility.status === 'unsat') { infeasible.push({ ...record, status: 'infeasible' }); continue; }
    if (feasibility.status !== 'sat') { unresolved.push({ ...record, status: 'unknown', reason: feasibility.reason || 'Solver unknown' }); continue; }
    if (!found) {
      try {
        const witnessArgs = patterns.map(p => evaluateGround(substitute(p, feasibility.bindings)));
        const witnessResult = evaluateGround(substitute(body.result, feasibility.bindings));
        witnessArgs.forEach((value, i) => {
          const expected = algebra.operations[operation].parameters[i];
          if (termSort(value, {}, algebra, expected) !== expected) throw new Error('Ill-sorted witness argument');
        });
        // Model extraction and arithmetic must preserve the declared result sort.
        if (termSort(witnessResult, {}, algebra, algebra.operations[operation].result) !== algebra.operations[operation].result) throw new Error('Ill-sorted witness result');
        domains.push({ ...record, status: 'feasible', witnessArgs, witnessResult,
          witnessBindings: Object.fromEntries(Object.keys(variables).map(n => [n, evaluateGround(substitute(substitute({ var: n }, branch.bindings), feasibility.bindings))])) });
      } catch (e) { unresolved.push({ ...record, status: 'unknown', reason: e.message }); }
      continue;
    }
    if (branch.remaining <= 0 || expanded + algebra.operations[found.term.call].rules.length > maxBranches) {
      unresolved.push({ ...record, status: 'residual', reason: branch.remaining <= 0 ? 'Unfolding budget exhausted' : 'Branch budget exhausted' }); continue;
    }
    let matched = false;
    for (const source of algebra.operations[found.term.call].rules) {
      expanded++;
      const rename = new Map(Object.keys(source.variables || {}).map(n => [n, { var: `@${++serial}.${n}` }]));
      for (const [n, v] of rename) sorts[v.var] = source.variables[n];
      const rule = substitute(source, rename), bindings = new Map(branch.bindings);
      // Constructor patterns narrow arguments; arithmetic equalities are residual constraints.
      const extra = [];
      const match = (a, b) => {
        a = substitute(a, bindings); b = substitute(b, bindings);
        if (a?.op || b?.op) { extra.push({ op: '==', left: a, right: b }); return true; }
        if (a?.ctor && b?.ctor) return a.ctor === b.ctor && a.args.every((x, i) => match(x, b.args[i]));
        return unify(a, b, bindings);
      };
      if (!rule.patterns.every((p, i) => match(p, found.term.args[i]))) continue;
      matched = true;
      const replaced = replace(body, found.path, rule.result);
      pending.push({ bindings, result: replaced.result, conditions: [...replaced.conditions, ...(rule.conditions || []), ...extra],
        rules: [...branch.rules, source.id], remaining: branch.remaining - 1 });
    }
    if (!matched) unresolved.push({ ...record, status: 'residual', reason: 'No defining equation matches this call' });
  }
  // Domain intersections are checked independently of output values and of APN execution.
  for (let i = 0; i < domains.length; i++) for (let j = i + 1; j < domains.length; j++) {
    const a = domains[i], original = domains[j];
    const rename = new Map([...variablesIn([original.patterns, original.conditions])].map(n => [n, { var: `@${++serial}.overlap` }]));
    for (const [n, v] of rename) sorts[v.var] = sorts[n];
    const b = substitute(original, rename);
    const conditions = [...a.conditions, ...b.conditions, ...a.patterns.map((p, k) => ({ op: '==', left: p, right: b.patterns[k] }))];
    const check = Date.now() >= deadline ? { status: 'unknown', reason: 'Total derivation time budget exhausted' } : await solve({ terms: [a.patterns, b.patterns], conditions, variables: sorts, witness: false });
    if (check.status !== 'unsat') overlaps.push({ left: a.id, right: original.id, status: check.status === 'sat' ? 'overlap' : 'unknown', reason: check.reason });
  }
  domains.reverse(); // Preserve equation declaration order for review.
  return { operation, maxDepth, domains, infeasible, unresolved, overlaps,
    coverage: 'not-proved', disjoint: overlaps.length === 0, frontierResolved: unresolved.length === 0,
    representativePolicy: 'Z3 model; prefer numeric 1 jointly when feasible; independently check constraints',
    constraintFragment: 'free constructors, Bool, Nat/Int and linear +/− comparisons; recursive equation unfolding is bounded' };
}
