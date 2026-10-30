import { literalRegionFields, literalFieldsDisjoint } from './LiteralDisjointness.js';
import { createBranchDisjointness } from './BranchDisjointness.js';
import { projectFeasibilityQuery } from './FeasibilityQuery.js';
import { constructorPatternsDisjoint } from './ConstructorDisjointness.js';
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
  if (!Number.isInteger(maxBranches) || maxBranches < 1 || maxBranches > 65536) throw new Error('Branch budget must be between 1 and 65536');
  const solve = options.solve || (await createSymbolicSolver(algebra, { ...options, simpleScalarChecks: options.simpleScalarChecks ?? true }));
  // Opt-in measurements only; no branch ordering, budgets or solver queries change.
  // Adapter time includes encoding/extraction/cache validation, not only SMT solving.
  const profile = options.profileUnfolding ? {
    visited: 0, peakPending: 0, equationAttempts: 0, equationMatches: 0,
    booleanBranches: 0, feasibilityQueries: 0, overlapQueries: 0,
    feasibilityMs: 0, overlapSolverMs: 0, equationExpansionMs: 0,
    feasibilityWitnessQueries: 0, feasibilityCheckQueries: 0,
    feasibilityWitnessMs: 0, feasibilityCheckMs: 0,
    maxFeasibilityVariables: 0, feasibilityVariableEntries: 0,
    overlapPairs: 0, constructorDisjointPairs: 0, constructorCheckMs: 0,
    literalDisjointPairs: 0, literalIndexMs: 0, literalCheckMs: 0, deadlineOverlapPairs: 0,
    maxOverlapVariables: 0, overlapVariableEntries: 0,
    branchProofQueries: 0, branchProofMs: 0, branchProofCacheHits: 0, branchDisjointPairs: 0, branchProofStatuses: {},
    retainedDomainVariableEntries: 0, peakDomainVariables: 0,
    maxRulePath: 0, maxUnfoldingDepth: 0, infeasibleBranches: 0, operations: {}
  } : null;
  const searchStarted = profile ? performance.now() : 0;
  const measuredSolve = async (query, phase) => {
    profile[`${phase}Queries`]++;
    const kind = query.witness === false ? 'Check' : 'Witness';
    if (phase === 'feasibility') profile[`feasibility${kind}Queries`]++;
    const started = performance.now();
    try { return await solve(query); }
    finally {
      const elapsed = performance.now() - started;
      profile[phase === 'overlap' ? 'overlapSolverMs' : 'feasibilityMs'] += elapsed;
      if (phase === 'feasibility') profile[`feasibility${kind}Ms`] += elapsed;
    }
  };
  const deadline = Date.now() + (options.maxTimeMs ?? 20000);
  const branchProofs = !witnessOnly && options.branchDisjointness !== false ? createBranchDisjointness({
    solve, deadline, signal: options.signal, profile, maxProofs: options.maxBranchProofs ?? 256
  }) : null;
  const sorts = {
    ...variables
  };
  let feasibilityDeclarationCount = profile ? Object.keys(sorts).length : 0;
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
    if (profile) { profile.visited++; profile.peakPending = Math.max(profile.peakPending, pending.length); }
    const branch = pending.pop();
    if (profile) {
      profile.maxRulePath = Math.max(profile.maxRulePath, branch.rules.length);
      profile.maxUnfoldingDepth = Math.max(profile.maxUnfoldingDepth, maxDepth - branch.remaining);
    }
    const body = substitute({
      conditions: branch.conditions,
      result: branch.result
    }, branch.bindings);
    const patterns = substitute(args, branch.bindings);
    const found = findCall(body, algebra);
    // Only fully unfolded conditions can be asserted; the others stay in the frontier.
    const constraints = body.conditions.filter(c => !findCall(c, algebra) && !undefinedReason(c));
    let feasibilityQuery = {
      terms: [patterns, body.result],
      conditions: constraints,
      variables: sorts,
      witness: !found && !undefinedReason(body) && (preserveBooleanStructure || !body.conditions.some(c => splitGuard(c)))
    };
    if (options.feasibilityQueryProjection !== false) feasibilityQuery = projectFeasibilityQuery(feasibilityQuery);
    if (profile) {
      const count = options.feasibilityQueryProjection === false ? feasibilityDeclarationCount : Object.keys(feasibilityQuery.variables).length;
      profile.maxFeasibilityVariables = Math.max(profile.maxFeasibilityVariables, count);
      profile.feasibilityVariableEntries += count;
    }
    const feasibility = Date.now() >= deadline ? {
      status: 'unknown',
      reason: 'Total derivation time budget exhausted'
    } : await (profile ? query => measuredSolve(query, 'feasibility') : solve)(feasibilityQuery);
    const record = {
      id: branch.rules.join('/') || 'root',
      rules: branch.rules,
      patterns,
      conditions: body.conditions,
      resultPattern: body.result
    };
    if (feasibility.status === 'unsat') {
      if (profile) profile.infeasibleBranches++;
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
      if (profile) profile.booleanBranches += alternatives.length;
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
      if (profile) profile.booleanBranches += 2;
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
        const goalBindings = Object.fromEntries(Object.keys(variables).map(n => [n, substitute({ var: n }, branch.bindings)]));
        // Retain sorts needed by this region and its root substitutions, rather
        // than every fresh variable ever allocated to an unrelated search branch.
        const domainVariables = options.compactDomainVariables === false ? { ...sorts } :
          Object.fromEntries([...variablesIn([patterns, body.conditions, body.result, goalBindings])].map(n => [n, sorts[n]]));
        if (profile) { const size = Object.keys(domainVariables).length; profile.retainedDomainVariableEntries += size; profile.peakDomainVariables = Math.max(profile.peakDomainVariables, size); }
        domains.push({
          ...record,
          status: 'feasible',
          witnessArgs,
          witnessResult,
          variables: domainVariables,
          goalBindings,
          witnessBindings: Object.fromEntries(Object.keys(variables).map(n => [n, evaluateGround(substitute(substitute({
            var: n
          }, branch.bindings), feasibility.bindings))]))
        });
        branchProofs?.record(domains[domains.length - 1], branch);
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
    const expansionStarted = profile ? performance.now() : 0;
    if (profile) profile.operations[found.term.call] = (profile.operations[found.term.call] || 0) + 1;
    const children = [];
    let matched = false;
    for (const source of algebra.operations[found.term.call].rules) {
      expanded++;
      if (profile) profile.equationAttempts++;
      const rename = new Map(Object.keys(source.variables || {}).map(n => [n, {
        var: `@${++serial}.${n}`
      }]));
      for (const [n, v] of rename) {
        if (profile && !Object.hasOwn(sorts, v.var)) feasibilityDeclarationCount++;
        sorts[v.var] = source.variables[n];
      }
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
      if (profile) profile.equationMatches++;
      const replaced = replace(body, found.path, rule.result);
      children.push({
        lineage: branch.lineage,
        bindings,
        result: replaced.result,
        conditions: [...replaced.conditions, ...(rule.conditions || []), ...extra],
        rules: [...branch.rules, source.id],
        remaining: branch.remaining - 1
      });
    }
    branchProofs?.split(branch, children, child => {
      const patterns = substitute(args, child.bindings);
      if (findCall(patterns, algebra) || undefinedReason(patterns)) return null;
      const conditions = substitute(child.conditions, child.bindings)
        .filter(c => !findCall(c, algebra) && !undefinedReason(c));
      return { patterns, conditions, variables: Object.fromEntries([...variablesIn([patterns, conditions])].map(n => [n, sorts[n]])) };
    });
    pending.push(...children);
    if (profile) profile.equationExpansionMs += performance.now() - expansionStarted;
    if (!matched) unresolved.push({
      ...record,
      status: 'residual',
      reason: 'No defining equation matches this call'
    });
  }
  const overlapStarted = profile ? performance.now() : 0;
  let overlapVariableCount = profile ? Object.keys(sorts).length : 0;
  const literalFields = new WeakMap();
  const fields = region => {
    if (!literalFields.has(region)) {
      const start = profile ? performance.now() : 0;
      literalFields.set(region, literalRegionFields(region, algebra));
      if (profile) profile.literalIndexMs += performance.now() - start;
    }
    return literalFields.get(region);
  };
  // Domain intersections are checked independently of output values and of APN execution.
  for (let i = 0; !witnessOnly && i < domains.length; i++) for (let j = i + 1; j < domains.length; j++) {
    const a = domains[i],
      original = domains[j];
    checkCancelled(options.signal);
    if (profile) profile.overlapPairs++;
    // Retain every unfinished obligation, but do not build/rename its large
    // solver query after the shared budget has already expired.
    if (Date.now() >= deadline && options.deferExpiredOverlapQueries !== false) {
      overlaps.push({ left: a.id, right: original.id, status: 'unknown', reason: 'Total derivation time budget exhausted' });
      if (profile) profile.deadlineOverlapPairs++;
      continue;
    }
    if (options.literalDisjointness !== false && Date.now() < deadline) {
      const leftFields = fields(a), rightFields = fields(original);
      const start = profile ? performance.now() : 0;
      const disjoint = literalFieldsDisjoint(leftFields, rightFields);
      if (profile) profile.literalCheckMs += performance.now() - start;
      if (disjoint) { if (profile) profile.literalDisjointPairs++; continue; }
    }
    if (options.constructorDisjointness !== false && Date.now() < deadline) {
      const started = profile ? performance.now() : 0;
      const disjoint = constructorPatternsDisjoint(a.patterns, original.patterns, algebra);
      if (profile) profile.constructorCheckMs += performance.now() - started;
      if (disjoint) {
        if (profile) profile.constructorDisjointPairs++;
        continue;
      }
    }
    if (branchProofs && await branchProofs.disjoint(a, original)) {
      if (profile) profile.branchDisjointPairs++;
      continue;
    }
    const rename = new Map([...variablesIn([original.patterns, original.conditions])].map(n => [n, {
      var: `@${++serial}.overlap`
    }]));
    // Overlap-local names must not accumulate in unrelated pair queries.
    const localSorts = new Map([...rename].map(([n, v]) => [v.var, sorts[n]]));
    if (options.overlapQueryVariables === false) {
      for (const [n, sort] of localSorts) {
        if (profile && !Object.hasOwn(sorts, n)) overlapVariableCount++;
        sorts[n] = sort;
      }
    }
    const b = substitute(original, rename);
    const conditions = [...a.conditions, ...b.conditions, ...a.patterns.map((p, k) => ({
      op: '==',
      left: p,
      right: b.patterns[k]
    }))];
    const queryVariables = options.overlapQueryVariables === false ? sorts :
      Object.fromEntries([...variablesIn([a.patterns, b.patterns, conditions])]
        .map(n => [n, localSorts.has(n) ? localSorts.get(n) : sorts[n]]));
    if (profile) {
      const count = options.overlapQueryVariables === false ? overlapVariableCount : Object.keys(queryVariables).length;
      profile.maxOverlapVariables = Math.max(profile.maxOverlapVariables, count);
      profile.overlapVariableEntries += count;
    }
    const check = Date.now() >= deadline ? {
      status: 'unknown',
      reason: 'Total derivation time budget exhausted'
    } : await (profile ? query => measuredSolve(query, 'overlap') : solve)({
      terms: [a.patterns, b.patterns],
      conditions,
      variables: queryVariables,
      witness: false
    });
    if (check.status !== 'unsat') overlaps.push({
      left: a.id,
      right: original.id,
      status: check.status === 'sat' ? 'overlap' : 'unknown',
      reason: check.reason
    });
  }
  if (profile) {
    profile.overlapPhaseMs = performance.now() - overlapStarted;
    profile.searchMs = performance.now() - searchStarted;
    profile.nonSolverMs = Math.max(0, profile.searchMs - profile.feasibilityMs - profile.overlapSolverMs - profile.branchProofMs);
    profile.expandedBranches = expanded;
    if (solve.scalarCheckStats) profile.scalarChecks = solve.scalarCheckStats;
  }
  domains.reverse(); // Preserve equation declaration order for review.
  return {
    operation,
    maxDepth,
    ...(profile ? { unfoldingProfile: profile } : {}),
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
      const query = {
        terms: [],
        conditions: usable,
        variables,
        witness: false
      };
      return solve(options.feasibilityQueryProjection === false ? query : projectFeasibilityQuery(query));
    }
  };
}
