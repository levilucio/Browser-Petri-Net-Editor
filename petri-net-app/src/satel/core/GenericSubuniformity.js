import { checkCancelled, diagnostic } from '../../domain/diagnostics.js';
import { freeze } from '../../domain/snapshots.js';
import { addBuiltins } from './BuiltinAlgebra.js';
import { splitGuard } from './GuardLogic.js';
import { createSymbolicSolver } from './SymbolicZ3.js';
import { evaluateGround, substitute, unify, variablesIn, validateSymbolicGoal, termSort, elaborateTerm } from './SymbolicTerms.js';

// Locate an innermost call anywhere: arguments, conditions, or equation result.
function findCall(t, algebra, path = []) {
  if (!t || typeof t !== 'object') return null;
  for (const [k, v] of Object.entries(t)) {
    const found = findCall(v, algebra, [...path, k]);
    if (found) return found;
  }
  return t.call && !algebra.operations[t.call]?.primitive ? {
    term: t,
    path
  } : null;
}
function undefinedReason(t) {
  if (!t || typeof t !== 'object') return null;
  return t.undefined || Object.values(t).map(undefinedReason).find(Boolean);
}
function replace(t, path, value) {
  if (!path.length) return value;
  const out = Array.isArray(t) ? [...t] : {
    ...t
  };
  out[path[0]] = replace(t[path[0]], path.slice(1), value);
  return out;
}
const preparedAlgebras = new Map();
export function prepareAlgebra(source) {
  const key = JSON.stringify(source);
  if (preparedAlgebras.has(key)) return preparedAlgebras.get(key);
  const algebra = addBuiltins(JSON.parse(key));
  for (const def of Object.values(algebra.operations)) for (const r of def.rules || []) {
    r.patterns = r.patterns.map((p, i) => elaborateTerm(p, r.variables || {}, algebra, def.parameters[i]));
    r.result = elaborateTerm(r.result, r.variables || {}, algebra, def.result);
    r.conditions = (r.conditions || []).map(c => elaborateTerm(c, r.variables || {}, algebra, 'Bool'));
  }
  freeze(algebra);
  if (preparedAlgebras.size >= 8) preparedAlgebras.delete(preparedAlgebras.keys().next().value);
  preparedAlgebras.set(key, algebra);
  return algebra;
}

/** Shared narrowing machinery; enumeration and existential solving have separate contracts. */
async function narrow(goal, options = {}, witnessOnly = false) {
  // Existence queries do not need Boolean alternatives as separate classes.
  // Apply the same default to ordinary sequences, refusals and joint HML goals;
  // explicit false remains available for diagnostic comparisons.
  const preserveBooleanStructure = witnessOnly && options.preserveBooleanStructure !== false;
  goal = {
    ...goal,
    algebra: options.preparedAlgebra || prepareAlgebra(goal.algebra)
  };
  if (!witnessOnly) validateSymbolicGoal(goal);
  const signature = witnessOnly ? {
    parameters: Object.values(goal.variables),
    result: 'Bool'
  } : goal.algebra.operations[goal.operation];
  goal.args = goal.args.map((a, i) => elaborateTerm(a, goal.variables || {}, goal.algebra, signature.parameters[i]));
  goal.conditions = (goal.conditions || []).map(c => elaborateTerm(c, goal.variables || {}, goal.algebra, 'Bool'));
  const {
    algebra,
    operation,
    args,
    variables = {},
    maxDepth = 2
  } = goal;
  const maxBranches = options.maxBranches ?? 256;
  if (!Number.isInteger(maxBranches) || maxBranches < 1 || maxBranches > 2048) throw new Error('Branch budget must be between 1 and 2048');
  const solve = options.solve || (await createSymbolicSolver(algebra, options));
  const deadline = Date.now() + (options.maxTimeMs ?? 20000);
  const sorts = {
    ...variables
  };
  let serial = 0,
    expanded = 0;
  const domains = [],
    infeasible = [],
    unresolved = [],
    overlaps = [];
  const pending = [{
    bindings: new Map(),
    conditions: goal.conditions || [],
    result: witnessOnly ? true : {
      call: operation,
      args
    },
    rules: [],
    remaining: maxDepth
  }];
  while (pending.length) {
    checkCancelled(options.signal);
    const branch = pending.pop();
    const body = substitute({
      conditions: branch.conditions,
      result: branch.result
    }, branch.bindings);
    const patterns = substitute(args, branch.bindings);
    const found = findCall(body, algebra);
    // Only fully unfolded conditions can be asserted; the others stay in the frontier.
    const constraints = body.conditions.filter(c => !findCall(c, algebra) && !undefinedReason(c));
    const feasibility = Date.now() >= deadline ? {
      status: 'unknown',
      reason: 'Total derivation time budget exhausted'
    } : await solve({
      terms: [patterns, body.result],
      conditions: constraints,
      variables: sorts,
      witness: !found && !undefinedReason(body) && (preserveBooleanStructure || !body.conditions.some(c => splitGuard(c)))
    });
    const record = {
      id: branch.rules.join('/') || 'root',
      rules: branch.rules,
      patterns,
      conditions: body.conditions,
      resultPattern: body.result
    };
    if (feasibility.status === 'unsat') {
      infeasible.push({
        ...record,
        status: 'infeasible'
      });
      continue;
    }
    if (feasibility.status !== 'sat') {
      unresolved.push({
        ...record,
        status: 'unknown',
        reason: feasibility.reason || 'Solver unknown'
      });
      continue;
    }
    // Normalize compound guards before unfolding calls so Boolean short-circuit
    // branches never force undefined terms from an irrelevant alternative.
    // A witness query can send a completed Boolean formula directly to SMT.
    // Class enumeration still splits alternatives to preserve its coverage
    // contract; residual algebraic calls still require narrowing first.
    // An unrelated residual call must not expand an already solver-ready HML
    // formula into paths. Undefined alternatives still need short-circuit splitting.
    const logicalIndex = body.conditions.findIndex(c => splitGuard(c) &&
      !(preserveBooleanStructure && !findCall(c, algebra) && !undefinedReason(c)));
    if (logicalIndex >= 0) {
      const alternatives = splitGuard(body.conditions[logicalIndex]);
      if (expanded + alternatives.length > maxBranches) {
        unresolved.push({
          ...record,
          status: 'residual',
          reason: 'Boolean branch budget exhausted'
        });
        continue;
      }
      expanded += alternatives.length;
      alternatives.forEach((conditions, i) => pending.push({
        ...branch,
        ...body,
        conditions: [...body.conditions.slice(0, logicalIndex), ...conditions, ...body.conditions.slice(logicalIndex + 1)],
        rules: alternatives.length > 1 ? [...branch.rules, `guard.alternative${i + 1}`] : branch.rules
      }));
      continue;
    }
    if (undefinedReason(body)) {
      unresolved.push({
        ...record,
        status: 'undefined',
        reason: undefinedReason(body)
      });
      continue;
    }
    const resultIsBool = body.result && typeof body.result === 'object' && (!body.result.call || algebra.operations[body.result.call]?.primitive) && termSort(body.result, sorts, algebra) === 'Bool';
    if (resultIsBool) {
      if (expanded + 2 > maxBranches) {
        unresolved.push({
          ...record,
          status: 'residual',
          reason: 'Boolean result branch budget exhausted'
        });
        continue;
      }
      expanded += 2;
      for (const value of [true, false]) pending.push({
        ...branch,
        ...body,
        result: value,
        conditions: [...body.conditions, value ? body.result : {
          op: 'not',
          left: body.result
        }],
        rules: [...branch.rules, `result.${value}`]
      });
      continue;
    }
    if (!found) {
      try {
        const witnessArgs = patterns.map(p => evaluateGround(substitute(p, feasibility.bindings)));
        const witnessResult = evaluateGround(substitute(body.result, feasibility.bindings));
        witnessArgs.forEach((value, i) => {
          const expected = signature.parameters[i];
          if (termSort(value, {}, algebra, expected) !== expected) throw new Error('Ill-sorted witness argument');
        });
        // Model extraction and arithmetic must preserve the declared result sort.
        if (termSort(witnessResult, {}, algebra, signature.result) !== signature.result) throw new Error('Ill-sorted witness result');
        domains.push({
          ...record,
          status: 'feasible',
          witnessArgs,
          witnessResult,
          variables: {
            ...sorts
          },
          goalBindings: Object.fromEntries(Object.keys(variables).map(n => [n, substitute({
            var: n
          }, branch.bindings)])),
          witnessBindings: Object.fromEntries(Object.keys(variables).map(n => [n, evaluateGround(substitute(substitute({
            var: n
          }, branch.bindings), feasibility.bindings))]))
        });
      } catch (e) {
        unresolved.push({
          ...record,
          status: 'unknown',
          reason: e.message,
          diagnostic: diagnostic(e, 'witness-extraction')
        });
      }
      if (witnessOnly && domains.length) break;
      continue;
    }
    if (branch.remaining <= 0 || expanded + algebra.operations[found.term.call].rules.length > maxBranches) {
      unresolved.push({
        ...record,
        status: 'residual',
        reason: branch.remaining <= 0 ? 'Unfolding budget exhausted' : 'Branch budget exhausted'
      });
      continue;
    }
    let matched = false;
    for (const source of algebra.operations[found.term.call].rules) {
      expanded++;
      const rename = new Map(Object.keys(source.variables || {}).map(n => [n, {
        var: `@${++serial}.${n}`
      }]));
      for (const [n, v] of rename) sorts[v.var] = source.variables[n];
      const rule = substitute(source, rename),
        bindings = new Map(branch.bindings);
      // Constructor patterns narrow arguments; arithmetic equalities are residual constraints.
      const extra = [];
      const match = (a, b) => {
        a = substitute(a, bindings);
        b = substitute(b, bindings);
        if (a?.op || b?.op || a?.call || b?.call) {
          extra.push({
            op: '==',
            left: a,
            right: b
          });
          return true;
        }
        if (a?.ctor && b?.ctor) return a.ctor === b.ctor && a.args.every((x, i) => match(x, b.args[i]));
        return unify(a, b, bindings);
      };
      if (!rule.patterns.every((p, i) => match(p, found.term.args[i]))) continue;
      matched = true;
      const replaced = replace(body, found.path, rule.result);
      pending.push({
        bindings,
        result: replaced.result,
        conditions: [...replaced.conditions, ...(rule.conditions || []), ...extra],
        rules: [...branch.rules, source.id],
        remaining: branch.remaining - 1
      });
    }
    if (!matched) unresolved.push({
      ...record,
      status: 'residual',
      reason: 'No defining equation matches this call'
    });
  }
  // Domain intersections are checked independently of output values and of APN execution.
  for (let i = 0; !witnessOnly && i < domains.length; i++) for (let j = i + 1; j < domains.length; j++) {
    const a = domains[i],
      original = domains[j];
    const rename = new Map([...variablesIn([original.patterns, original.conditions])].map(n => [n, {
      var: `@${++serial}.overlap`
    }]));
    for (const [n, v] of rename) sorts[v.var] = sorts[n];
    const b = substitute(original, rename);
    const conditions = [...a.conditions, ...b.conditions, ...a.patterns.map((p, k) => ({
      op: '==',
      left: p,
      right: b.patterns[k]
    }))];
    const check = Date.now() >= deadline ? {
      status: 'unknown',
      reason: 'Total derivation time budget exhausted'
    } : await solve({
      terms: [a.patterns, b.patterns],
      conditions,
      variables: sorts,
      witness: false
    });
    if (check.status !== 'unsat') overlaps.push({
      left: a.id,
      right: original.id,
      status: check.status === 'sat' ? 'overlap' : 'unknown',
      reason: check.reason
    });
  }
  domains.reverse(); // Preserve equation declaration order for review.
  return {
    operation,
    maxDepth,
    domains,
    infeasible,
    unresolved,
    overlaps,
    coverage: 'not-proved',
    disjoint: overlaps.length === 0,
    frontierResolved: unresolved.length === 0,
    representativePolicy: 'Z3 model; prefer numeric 1 jointly when feasible; independently check constraints',
    constraintFragment: 'free constructors; built-in Int/Bool/Pair/List/String; shared-variable compound guards; bounded equation unfolding with strict Z3 feasibility'
  };
}

/** Enumerate classes and check their pairwise disjointness. */
export const deriveGenericSubdomains = (goal, options = {}) => narrow(goal, options);

/** Existence only: stop at one witness, without class/result partitioning or overlap checks. */
export async function findConstraintWitness({
  algebra,
  variables,
  conditions,
  maxDepth = 32
}, options = {}) {
  const result = await narrow({
    algebra,
    variables,
    args: Object.keys(variables).map(varName => ({
      var: varName
    })),
    conditions,
    maxDepth
  }, options, true);
  return {
    status: result.domains.length ? 'sat' : result.unresolved.length ? 'unknown' : 'unsat',
    witness: result.domains[0],
    unresolved: result.unresolved
  };
}

/** A partial conjunction is sufficient to disprove a prefix, never to prove a full path.
 * Residual equation calls/undefined terms remain for narrowing and concrete replay. */
export async function createConstraintSearch(algebra, options = {}) {
  const preparedAlgebra = prepareAlgebra(algebra);
  const solve = options.solve || (await createSymbolicSolver(preparedAlgebra, options));
  return {
    witness: (request, limits = {}) => findConstraintWitness(request, {
      ...options,
      ...limits,
      preparedAlgebra,
      solve
    }),
    prefix: async (conditions, variables) => {
      checkCancelled(options.signal);
      const usable = conditions.map(c => elaborateTerm(c, variables, preparedAlgebra, 'Bool'))
        .filter(c => !findCall(c, preparedAlgebra) && !undefinedReason(c));
      if (!usable.length) return {
        status: 'unknown',
        reason: 'No solver-ready prefix constraints'
      };
      return solve({
        terms: [],
        conditions: usable,
        variables,
        witness: false
      });
    }
  };
}
