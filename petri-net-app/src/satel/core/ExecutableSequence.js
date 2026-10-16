import { foldGroundTerms } from './GroundTerms.js';
import { compilePublicNet, isMethodRule } from '../../domain/apn/PublicMethods.js';
import { validBuiltinValue, valueToSymbolic as valueTerm, integerBounds } from '../../utils/builtin-values.js';
import { createConstraintSearch } from './GenericSubuniformity.js';
import { substitute, variablesIn, evaluateGround, termSort, unify } from './SymbolicTerms.js';
import { checkCancelled, diagnostic, DomainError } from '../../domain/diagnostics.js';
const eq = (left, right) => ({
  op: '==',
  left,
  right
});
const copy = x => JSON.parse(JSON.stringify(x));
const fail = message => {
  throw new Error(message);
};
function range(term, sort) {
  return ['Nat', 'Int'].includes(sort) ? [{
    op: '>=',
    left: term,
    right: integerBounds(sort).min
  }, {
    op: '<=',
    left: term,
    right: integerBounds(sort).max
  }] : [];
}

/** Positive path constraint builder. Assertions are explicit so a future forbidden
 * final pair can use a different planner, rather than invert a failed replay. */
async function* paths(compiled, net, io, pairs, algebra, sorts, budget, search, initialConditions) {
  if (!pairs.length || pairs.length > 32) fail('Executable sequences require 1–32 pairs');
  const {
    methods,
    plans
  } = compiled;
  const places = new Map(net.places.map(p => [p.id, p]));
  const initial = Object.fromEntries(net.places.map(p => [p.id, p.valueTokens.map(valueTerm)]));
  const tick = () => {
    checkCancelled(budget.signal);
    if (++budget.visited > budget.max || Date.now() >= budget.deadline) throw new DomainError('resource-limit', 'Sequence search budget exhausted');
  };
  async function* matchBag(actual, expected, conditions, i = 0, used = []) {
    tick();
    if (actual.length !== expected.length) return;
    if (i === expected.length) {
      yield conditions;
      return;
    }
    const equivalent = new Set();
    for (let k = 0; k < actual.length; k++) if (!used.includes(k)) {
      const key = JSON.stringify(actual[k]);
      if (equivalent.has(key)) continue;
      equivalent.add(key);
      const equality = foldGroundTerms(eq(actual[k], expected[i]), algebra);
      if (equality === false) {
        budget.pruned++;
        continue;
      }
      yield* matchBag(actual, expected, equality === true ? conditions : [...conditions, equality], i + 1, [...used, k]);
    }
  }
  async function* walk(index, marking, conditions, trace, branched = false) {
    tick();
    if (conditions.includes(false)) {
      budget.pruned++;
      return;
    }
    conditions = conditions.filter(c => c !== true);
    // Pay for a prefix SMT check only after a genuine rule/token choice.
    // Deterministic paths are checked once by the complete-path witness solver.
    if (conditions.length && branched && index < pairs.length) {
      budget.prefixChecks++;
      if ((await search.prefix(conditions, sorts)).status === 'unsat') {
        budget.pruned++;
        return;
      }
    }
    if (index === pairs.length) {
      yield {
        conditions,
        trace
      };
      return;
    }
    const pair = pairs[index];
    if ((pair.assertion || 'required') !== 'required') fail('Only required pairs are supported by positive generation');
    const {
      method: name,
      arguments: args
    } = pair.stimulation;
    const method = methods.find(m => m.name === name);
    if (!method) fail(`Unknown public method: ${name}`);
    if (JSON.stringify(Object.keys(args).sort()) !== JSON.stringify(method.parameters.map(p => p.name).sort())) fail(`Arguments for ${name} must match its declared parameters exactly`);
    const parameterConditions = [];
    for (const p of method.parameters) {
      const sort = termSort(args[p.name], sorts, algebra);
      if (sort !== p.sort && !(['Nat', 'Int'].includes(sort) && ['Nat', 'Int'].includes(p.sort))) fail(`Argument ${p.name} must have sort ${p.sort}`);
      parameterConditions.push(...range(args[p.name], p.sort));
    }
    for (const id of Object.keys(pair.observation.outputs)) if (!io.outputs.includes(id)) fail(`Unknown public output in protocol: ${id}`);
    for (const plan of plans[name]) {
      async function* bind(i, env, picks, constraints) {
        tick();
        if (i < plan.ins.length) {
          const input = plan.ins[i];
          const equivalent = new Set();
          for (const [tokenIndex, value] of marking[input.place].entries()) {
            if (picks.some(p => p.place === input.place && p.tokenIndex === tokenIndex)) continue;
            const key = JSON.stringify(value);
            if (equivalent.has(key)) continue;
            equivalent.add(key);
            const extra = Object.hasOwn(env, input.variable) ? [foldGroundTerms(eq(env[input.variable], value), algebra)] : [];
            if (extra.includes(false)) {
              budget.pruned++;
              continue;
            }
            yield* bind(i + 1, {
              ...env,
              [input.variable]: value
            }, [...picks, {
              place: input.place,
              tokenIndex
            }], [...constraints, ...extra]);
          }
          return;
        }
        // Method-local variable names may equal intention names. This is a
        // simultaneous substitution: inserted terms already belong to the
        // intention scope and must not be substituted again as method locals.
        const instantiate = t => t?.var ? env[t.var] : Array.isArray(t) ? t.map(instantiate) : t && typeof t === 'object' ? Object.fromEntries(Object.entries(t).map(([k, v]) => [k, instantiate(v)])) : t;
        const next = Object.fromEntries(Object.entries(marking).map(([id, tokens]) => [id, tokens.filter((_, k) => !picks.some(p => p.place === id && p.tokenIndex === k))]));
        const produced = Object.fromEntries(io.outputs.map(id => [id, []]));
        const cs = [];
        if (plan.guard) cs.push(instantiate(plan.guard));
        for (const out of plan.outs) {
          const value = instantiate(out.ast);
          next[out.place].push(value);
          if (produced[out.place]) produced[out.place].push(value);
          cs.push(...range(value, places.get(out.place).sort));
        }
        const branched = plans[name].length > 1 || plan.ins.some(input => new Set(marking[input.place].map(t => JSON.stringify(t))).size > 1) ||
          Object.values(produced).some(tokens => new Set(tokens.map(t => JSON.stringify(t))).size > 1);
        async function* observe(i, conditions) {
          if (i === io.outputs.length) {
            yield* walk(index + 1, next, conditions, [...trace, {
              assertion: 'required',
              transitionId: plan.id,
              picks,
              marking: next
            }], branched);
            return;
          }
          const id = io.outputs[i];
          for await (const matched of matchBag(produced[id], pair.observation.outputs[id] || [], conditions)) yield* observe(i + 1, matched);
        }
        yield* observe(0, [...constraints, ...foldGroundTerms(cs, algebra)]);
      }
      yield* bind(0, args, [], [...conditions, ...foldGroundTerms(parameterConditions, algebra)]);
    }
  }
  yield* walk(0, initial, foldGroundTerms(initialConditions, algebra), []);
}

/** Select one executable representative per completed algebraic class. No random
 * sampling, no marking reset between pairs, and no silent removal of classes. */
export async function selectExecutableRepresentatives(goal, protocol, decomposition, net, io, options = {}) {
  if (!['algebraic', 'algebraic-int'].includes(net.mode) || !net.transitions.length || net.transitions.some(t => !isMethodRule(t))) fail('Executable selection requires an algebraic net with public methods only');
  const ids = [...net.places, ...net.transitions, ...net.arcs].map(x => x.id);
  if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) fail('Net IDs must be nonempty and unique');
  for (const p of net.places) if (!Array.isArray(p.valueTokens) || p.tokens !== p.valueTokens.length || !p.valueTokens.every(v => validBuiltinValue(v, p.sort))) fail(`Invalid initial marking at ${p.id}`);
  const compiled = compilePublicNet(net);
  const search = await createConstraintSearch(goal.algebra, options);
  const budget = {
    signal: options.signal,
    pruned: 0,
    prefixChecks: 0,
    visited: 0,
    max: options.maxSequenceBranches ?? 10000,
    deadline: Date.now() + (options.maxSequenceTimeMs ?? 20000)
  };
  const selected = [],
    blocked = [],
    unresolved = [];
  for (const domain of decomposition.domains) {
    let found = null,
      attempts = 0;
    try {
      for (const [caseIndex, original] of protocol.entries()) {
        const rename = new Map(Object.keys(original.variables).map(n => [n, {
          var: `@protocol${caseIndex}.${n}`
        }]));
        const c = substitute(original, rename);
        const sorts = {
          ...domain.variables,
          ...Object.fromEntries([...rename].map(([n, t]) => [t.var, original.variables[n]]))
        };
        // Narrow protocol constructor patterns before exploring any APN path.
        // Arithmetic result patterns remain equalities instead of syntactic matches.
        const caseBindings = new Map(),
          extra = [];
        const match = (a, b, bindings, residual) => {
          a = substitute(a, bindings);
          b = substitute(b, bindings);
          if (a?.op || b?.op || a?.call || b?.call) {
            residual.push(eq(a, b));
            return true;
          }
          if (a?.ctor && b?.ctor) return a.ctor === b.ctor && a.args.length === b.args.length && a.args.every((x, i) => match(x, b.args[i], bindings, residual));
          return unify(a, b, bindings);
        };
        if (!c.patterns.every((p, i) => match(p, domain.patterns[i], caseBindings, extra)) || !match(c.result, domain.resultPattern, caseBindings, extra)) continue;
        const projection = substitute({
          patterns: domain.patterns,
          result: domain.resultPattern,
          roots: domain.goalBindings
        }, caseBindings);
        const domainConditions = substitute([...domain.conditions, ...extra], caseBindings);
        for await (const path of paths(compiled, net, io, substitute(c.pairs, caseBindings), goal.algebra, sorts, budget, search, domainConditions)) {
          attempts++;
          const conditions = path.conditions;
          // Preserve the previous representative when it satisfies the COMPLETE
          // path. If it cannot, release it and solve for new values in the class.
          // This also avoids unfolding an arbitrary recursive tail when a known
          // finite witness already proves existence in this class.
          const preferred = new Map(),
            preferredResidual = [];
          const preferenceMatches = projection.patterns.every((p, i) => match(p, domain.witnessArgs[i], preferred, preferredResidual)) && Object.entries(projection.roots).every(([n, t]) => match(t, domain.witnessBindings[n], preferred, preferredResidual));
          const choices = preferenceMatches ? [preferred, new Map()] : [new Map()];
          for (const [choiceIndex, fixed] of choices.entries()) {
            const cs = foldGroundTerms(substitute([...conditions, ...(choiceIndex === 0 && preferenceMatches ? preferredResidual : [])], fixed), goal.algebra);
            const projected = substitute(projection, fixed);
            const used = [...variablesIn([cs, projected])];
            const names = new Map(used.map((n, i) => [n, {
              var: `v${i}`
            }]));
            const variables = Object.fromEntries(used.map(n => [names.get(n).var, sorts[n]]));
            if (Date.now() >= budget.deadline) throw new DomainError('resource-limit', 'Sequence search budget exhausted');
            const result = await search.witness({
              algebra: goal.algebra,
              variables,
              conditions: substitute(cs, names),
              maxDepth: options.sequenceUnfoldingDepth ?? 32
            }, {
              maxTimeMs: budget.deadline - Date.now()
            });
            const witness = result.witness;
            if (!witness) {
              if (choiceIndex === choices.length - 1 && result.unresolved.length) unresolved.push({
                id: domain.id,
                reason: result.unresolved.map(x => x.reason).join('; ')
              });
              continue;
            }
            const bindings = new Map(used.map(n => [n, witness.witnessBindings[names.get(n).var]]));
            const ground = t => evaluateGround(substitute(t, bindings));
            found = {
              ...domain,
              staticWitness: {
                args: domain.witnessArgs,
                result: domain.witnessResult,
                bindings: domain.witnessBindings
              },
              witnessArgs: projected.patterns.map(ground),
              witnessResult: ground(projected.result),
              witnessBindings: Object.fromEntries(Object.entries(projected.roots).map(([n, t]) => [n, ground(t)])),
              execution: {
                status: 'selected',
                policy: 'one executable representative per algebraic class',
                caseId: original.id,
                pathsTried: attempts,
                representative: fixed.size ? 'existing witness satisfies whole sequence' : 'solved jointly from whole sequence',
                assertions: path.trace.map(t => ({
                  kind: t.assertion,
                  transitionId: t.transitionId,
                  inputOccurrences: t.picks
                }))
              }
            };
            break;
          }
          if (found) break;
        }
        if (found) break;
      }
      if (found) {
        selected.push(found);
        // Positive selection needs one witness, not proof of every path.
        for (let i = unresolved.length - 1; i >= 0; i--) if (unresolved[i].id === domain.id) unresolved.splice(i, 1);
      } else if (!unresolved.some(x => x.id === domain.id)) blocked.push({
        id: domain.id,
        reason: 'No complete stimulation/observation sequence is feasible from the model initial marking',
        pathsTried: attempts
      });
    } catch (e) {
      if (e.code === 'cancelled') throw e;
      unresolved.push({
        id: domain.id,
        reason: e.message,
        diagnostic: diagnostic(e, 'sequence-search')
      });
    }
  }
  return {
    selected,
    blocked,
    unresolved,
    visited: budget.visited,
    pruned: budget.pruned,
    prefixChecks: budget.prefixChecks,
    policy: 'one executable representative per algebraic class; whole-sequence constraints; bounded symbolic execution'
  };
}
