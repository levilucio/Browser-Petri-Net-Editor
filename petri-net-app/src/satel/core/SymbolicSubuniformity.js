/**
 * Constructor-pattern unfolding of positive conditional operation equations.
 * No simulator or state-space explorer is used here. The first supported
 * constraint fragment is conjunctions of unary Nat intervals and equalities.
 */
const MAX_NAT = 2147483647; // The existing APN simulator's numeric range.
const isVar = term => term && typeof term === 'object' && typeof term.var === 'string';
const fail = message => { throw new Error(message); };
const comparison = (op, a, b) => {
  switch (op) {
    case '<': return a < b;
    case '<=': return a <= b;
    case '>': return a > b;
    case '>=': return a >= b;
    case '==': return a === b;
    case '!=': return a !== b;
    default: return fail(`Unsupported condition: ${op}`);
  }
};

function substitute(term, bindings) {
  if (isVar(term)) return bindings.has(term.var) ? substitute(bindings.get(term.var), bindings) : term;
  if (Array.isArray(term)) return term.map(t => substitute(t, bindings));
  if (term && typeof term === 'object') return Object.fromEntries(Object.entries(term).map(([k, v]) => [k, substitute(v, bindings)]));
  return term;
}

function variablesIn(term, names = new Set()) {
  if (isVar(term)) names.add(term.var);
  else if (term && typeof term === 'object') Object.values(term).forEach(t => variablesIn(t, names));
  return names;
}

function unify(left, right, bindings) {
  left = substitute(left, bindings);
  right = substitute(right, bindings);
  if (isVar(left) || isVar(right)) {
    const variable = isVar(left) ? left : right;
    const value = isVar(left) ? right : left;
    if (isVar(value) && variable.var === value.var) return true;
    if (variablesIn(value).has(variable.var)) return false;
    bindings.set(variable.var, value);
    return true;
  }
  if (left?.ctor && right?.ctor && left.ctor === right.ctor && left.args.length === right.args.length) {
    return left.args.every((arg, i) => unify(arg, right.args[i], bindings));
  }
  return left === right;
}

function typeOf(term, variables, algebra) {
  if (typeof term === 'boolean') return 'Bool';
  if (Number.isInteger(term) && term >= 0 && term <= MAX_NAT) return 'Nat';
  if (isVar(term)) return variables[term.var] || fail(`Undeclared variable: ${term.var}`);
  if (term?.op && ['+', '-'].includes(term.op)) {
    if (typeOf(term.left, variables, algebra) !== 'Nat' || typeOf(term.right, variables, algebra) !== 'Nat') fail('Arithmetic requires Nat operands');
    return 'Nat';
  }
  const signature = term?.ctor ? algebra.constructors[term.ctor] : term?.call ? algebra.operations[term.call] : null;
  if (!signature || !Array.isArray(term.args) || term.args.length !== signature.parameters.length) fail('Unknown constructor/operation or wrong arity');
  term.args.forEach((arg, i) => {
    if (typeOf(arg, variables, algebra) !== signature.parameters[i]) fail('Ill-sorted constructor/operation argument');
  });
  return signature.result;
}

function validateAlgebra(algebra) {
  if (!algebra?.constructors || !algebra?.operations) fail('Constructor signatures and operation definitions are required');
  const ids = new Set();
  for (const [name, operation] of Object.entries(algebra.operations)) {
    if (!operation.rules?.length) fail(`Operation has no equations: ${name}`);
    for (const rule of operation.rules) {
      if (!rule.id || ids.has(rule.id)) fail('Equation IDs must be nonempty and globally unique');
      ids.add(rule.id);
      if (!Array.isArray(rule.patterns) || rule.patterns.length !== operation.parameters.length) fail(`Wrong equation arity: ${rule.id}`);
      const vars = rule.variables || {};
      const patternVars = variablesIn(rule.patterns);
      const isPattern = t => isVar(t) || typeof t === 'boolean' || Number.isInteger(t) ||
        (t?.ctor && Array.isArray(t.args) && t.args.every(isPattern));
      rule.patterns.forEach((p, i) => {
        if (!isPattern(p) || typeOf(p, vars, algebra) !== operation.parameters[i]) fail(`Ill-sorted constructor pattern: ${rule.id}`);
      });
      for (const variable of variablesIn([rule.conditions, rule.result])) {
        if (!patternVars.has(variable)) fail(`Equation introduces unbound variable ${variable}`);
      }
      if (typeOf(rule.result, vars, algebra) !== operation.result) fail(`Ill-sorted equation result: ${rule.id}`);
      for (const c of rule.conditions || []) {
        if (!['<', '<=', '>', '>=', '==', '!='].includes(c.op)) fail('Unsupported condition operator');
        const left = typeOf(c.left, vars, algebra), right = typeOf(c.right, vars, algebra);
        if (left !== right || !['Nat', 'Bool'].includes(left) || (left === 'Bool' && !['==', '!='].includes(c.op))) fail('Unsupported/ill-sorted equation condition');
      }
    }
  }
}

function containsCall(term) {
  return !!(term && typeof term === 'object' && (term.call || Object.values(term).some(containsCall)));
}

function groundResult(term) {
  if (isVar(term)) fail(`Uninstantiated result variable: ${term.var}`);
  if (term?.op) {
    const left = groundResult(term.left), right = groundResult(term.right);
    const value = term.op === '+' ? left + right : left - right;
    if (!Number.isInteger(value) || value < 0 || value > MAX_NAT) fail('Equation result leaves the supported Nat range');
    return value;
  }
  if (term?.ctor) return { ctor: term.ctor, args: term.args.map(groundResult) };
  return term;
}

function solveIntervals(patterns, constraints, sorts) {
  const names = variablesIn([patterns, constraints]);
  const intervals = new Map();
  for (const name of names) {
    if (sorts[name] !== 'Nat') fail(`Residual ${sorts[name]} variable ${name}: further constructor unfolding is required`);
    intervals.set(name, { min: 0, max: MAX_NAT, excluded: new Set() });
  }
  for (const c of constraints) {
    let { left, right, op } = c;
    if (JSON.stringify(left) === JSON.stringify(right)) {
      if (!comparison(op, 0, 0)) return null;
      continue;
    }
    if (typeof left !== 'object' && typeof right !== 'object') {
      if (!comparison(op, left, right)) return null;
      continue;
    }
    if (!isVar(left) && isVar(right)) {
      [left, right] = [right, left];
      op = ({ '<': '>', '<=': '>=', '>': '<', '>=': '<=', '==': '==', '!=': '!=' })[op];
    }
    if (!isVar(left) || !Number.isInteger(right)) fail('Constraint needs a stronger solver: only unary Nat intervals are supported');
    const interval = intervals.get(left.var);
    switch (op) {
      case '<': interval.max = Math.min(interval.max, right - 1); break;
      case '<=': interval.max = Math.min(interval.max, right); break;
      case '>': interval.min = Math.max(interval.min, right + 1); break;
      case '>=': interval.min = Math.max(interval.min, right); break;
      case '==': interval.min = Math.max(interval.min, right); interval.max = Math.min(interval.max, right); break;
      case '!=': interval.excluded.add(right); break;
      default: fail('Unsupported interval constraint');
    }
  }
  const witness = new Map();
  for (const [name, interval] of intervals) {
    // Prefer 1 when allowed; otherwise use the least nonexcluded lower bound.
    // This is an explicit representative policy, not a partitioning criterion.
    let value = interval.min <= 1 && 1 <= interval.max && !interval.excluded.has(1) ? 1 : interval.min;
    while (interval.excluded.has(value)) value++;
    if (value > interval.max) return null;
    witness.set(name, value);
  }
  return witness;
}

/**
 * Unify a symbolic operation call with its constructor equations and recursively
 * unfold operation calls in their conditions. Depth exhaustion is an error;
 * it is never reported as complete partition coverage.
 */
export function deriveSymbolicSubdomains({ algebra, operation, args, variables = {}, maxDepth = 2 }) {
  validateAlgebra(algebra);
  if (Object.keys(variables).some(name => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))) fail('Unsupported goal variable name');
  if (!Number.isInteger(maxDepth) || maxDepth < 1) fail('Positive unfolding depth is required');
  typeOf({ call: operation, args }, variables, algebra);
  let serial = 0;
  const sorts = { ...variables };
  function unfold(name, arguments_, depth) {
    if (depth < 1) fail(`Unfolding depth exhausted at ${name}`);
    const definition = algebra.operations[name];
    if (!definition) fail(`Undefined operation: ${name}`);
    const branches = [];
    for (const source of definition.rules) {
      const rename = new Map(Object.keys(source.variables || {}).map(v => [v, { var: `$${++serial}.${v}` }]));
      for (const [v, renamed] of rename) sorts[renamed.var] = source.variables[v];
      const rule = substitute(source, rename);
      const bindings = new Map();
      if (!rule.patterns.every((p, i) => unify(p, arguments_[i], bindings))) continue;
      let alternatives = [{ bindings, constraints: [], rules: [source.id] }];
      for (const condition of rule.conditions || []) {
        const expanded = [];
        for (const branch of alternatives) {
          const c = substitute(condition, branch.bindings);
          const callSide = c.left?.call ? 'left' : c.right?.call ? 'right' : null;
          if (!callSide) {
            if (containsCall(c)) fail('Nested operation arguments require further unfolding support');
            expanded.push({ ...branch, constraints: [...branch.constraints, c] });
            continue;
          }
          const call = c[callSide];
          if (containsCall(call.args)) fail('Nested operation arguments are unsupported');
          for (const sub of unfold(call.call, call.args, depth - 1)) {
            const merged = new Map(branch.bindings);
            if (![...sub.bindings].every(([v, value]) => unify({ var: v }, value, merged))) continue;
            const residual = substitute({ ...c, [callSide]: sub.result }, merged);
            if (containsCall(residual)) fail('Multiple operation calls in one condition are unsupported');
            expanded.push({ bindings: merged,
              constraints: [...branch.constraints, ...sub.constraints, residual].map(x => substitute(x, merged)),
              rules: [...branch.rules, ...sub.rules] });
          }
        }
        alternatives = expanded;
      }
      for (const branch of alternatives) {
        const result = substitute(rule.result, branch.bindings);
        if (containsCall(result)) fail('Operation calls in results require further unfolding support');
        branches.push({ ...branch, result });
      }
    }
    return branches;
  }
  const symbolic = unfold(operation, args, maxDepth);
  const domains = [], infeasible = [];
  for (const branch of symbolic) {
    const patterns = substitute(args, branch.bindings);
    const conditions = substitute(branch.constraints, branch.bindings);
    const witness = solveIntervals(patterns, conditions, sorts);
    const id = branch.rules.join('/');
    if (!witness) { infeasible.push({ id, rules: branch.rules, patterns, conditions }); continue; }
    domains.push({ id, rules: branch.rules, patterns, conditions,
      resultPattern: branch.result, witnessArgs: substitute(patterns, witness),
      witnessResult: groundResult(substitute(branch.result, witness)) });
  }
  if (!domains.length) fail('No feasible symbolic subdomains');
  // Equations need not define disjoint cases in general. This first increment
  // refuses overlapping feasible subdomains instead of labelling them classes.
  for (let i = 0; i < domains.length; i++) {
    for (let j = i + 1; j < domains.length; j++) {
      const bindings = new Map();
      if (!domains[i].patterns.every((p, k) => unify(p, domains[j].patterns[k], bindings))) continue;
      const overlap = solveIntervals(substitute(domains[i].patterns, bindings),
        substitute([...domains[i].conditions, ...domains[j].conditions], bindings), sorts);
      if (overlap) fail(`Overlapping symbolic subdomains: ${domains[i].id} and ${domains[j].id}`);
    }
  }
  return { operation, maxDepth, domains, infeasible,
    representativePolicy: 'prefer Nat 1 if feasible, else the least admissible lower bound',
    constraintFragment: 'constructor patterns and unary Nat intervals (0..2147483647)' };
}
