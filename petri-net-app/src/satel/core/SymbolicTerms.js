/** Typed, first-order terms shared by the equation editor, unfolding and SMT adapter. */
export const isVariable = t => !!t && typeof t === 'object' && typeof t.var === 'string';
export const variablesIn = (t, names = new Set()) => {
  if (isVariable(t)) names.add(t.var);
  else if (t && typeof t === 'object') Object.values(t).forEach(x => variablesIn(x, names));
  return names;
};
export function substitute(t, bindings) {
  if (isVariable(t)) return bindings.has(t.var) ? substitute(bindings.get(t.var), bindings) : t;
  if (Array.isArray(t)) return t.map(x => substitute(x, bindings));
  if (t && typeof t === 'object') return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, substitute(v, bindings)]));
  return t;
}
export function unify(a, b, bindings) {
  a = substitute(a, bindings); b = substitute(b, bindings);
  if (isVariable(a) || isVariable(b)) {
    const v = isVariable(a) ? a : b, t = isVariable(a) ? b : a;
    if (isVariable(t) && t.var === v.var) return true;
    if (variablesIn(t).has(v.var)) return false;
    bindings.set(v.var, t); return true;
  }
  if (a?.ctor && b?.ctor && a.ctor === b.ctor && a.args.length === b.args.length)
    return a.args.every((x, i) => unify(x, b.args[i], bindings));
  return JSON.stringify(a) === JSON.stringify(b);
}
export function termSort(t, vars, algebra, expected) {
  if (typeof t === 'boolean') return 'Bool';
  if (Number.isSafeInteger(t)) {
    if (expected === 'Nat' && t < 0) throw new Error('Negative Nat literal');
    return expected === 'Int' || t < 0 ? 'Int' : 'Nat';
  }
  if (isVariable(t)) {
    if (!vars[t.var]) throw new Error(`Undeclared variable: ${t.var}`);
    return vars[t.var];
  }
  if (t?.op && ['+', '-'].includes(t.op)) {
    const sort = termSort(t.left, vars, algebra, expected);
    if (!['Nat', 'Int'].includes(sort) || termSort(t.right, vars, algebra, sort) !== sort) throw new Error('Arithmetic operands must have the same numeric sort');
    return sort;
  }
  const s = t?.ctor ? algebra.constructors[t.ctor] : t?.call ? algebra.operations[t.call] : null;
  if (!s || !Array.isArray(t.args) || t.args.length !== s.parameters.length) throw new Error('Unknown term or wrong constructor/operation arity');
  t.args.forEach((a, i) => { if (termSort(a, vars, algebra, s.parameters[i]) !== s.parameters[i]) throw new Error(`Ill-sorted argument of ${t.ctor || t.call}`); });
  return s.result;
}
export function validateSymbolicGoal({ algebra, operation, args, variables = {}, maxDepth = 2, conditions = [] }) {
  if (!algebra?.constructors || !algebra?.operations) throw new Error('Typed constructors and operation equations are required');
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 32) throw new Error('Unfolding budget must be an integer from 1 to 32');
  const known = new Set(['Nat', 'Int', 'Bool', ...Object.values(algebra.constructors).map(s => s.result)]);
  for (const [name, s] of Object.entries({ ...algebra.constructors, ...algebra.operations })) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || !Array.isArray(s.parameters) || !known.has(s.result) || s.parameters.some(x => !known.has(x))) throw new Error(`Invalid signature: ${name}`);
  }
  if (Object.keys(algebra.constructors).some(n => algebra.operations[n])) throw new Error('Constructor and operation names must be distinct');
  if (Object.values(algebra.constructors).some(s => ['Nat', 'Int', 'Bool'].includes(s.result))) throw new Error('Built-in sorts cannot be redefined by constructors');
  const checkVars = vars => {
    for (const [n, s] of Object.entries(vars)) if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n) || !known.has(s)) throw new Error(`Invalid variable declaration: ${n}: ${s}`);
  };
  const ids = new Set();
  for (const [name, op] of Object.entries(algebra.operations)) {
    if (!op.rules?.length) throw new Error(`Operation has no defining equations: ${name}`);
    for (const r of op.rules) {
      if (!r.id || ids.has(r.id)) throw new Error('Equation IDs must be unique and nonempty'); ids.add(r.id);
      checkVars(r.variables || {});
      const pattern = t => isVariable(t) || typeof t === 'boolean' || Number.isSafeInteger(t) || (t?.ctor && t.args.every(pattern));
      if (!Array.isArray(r.patterns) || r.patterns.length !== op.parameters.length) throw new Error(`Wrong equation arity: ${r.id}`);
      r.patterns.forEach((t, i) => { if (!pattern(t) || termSort(t, r.variables, algebra, op.parameters[i]) !== op.parameters[i]) throw new Error(`Ill-sorted constructor pattern: ${r.id}`); });
      const bound = variablesIn(r.patterns);
      if ([...variablesIn([r.conditions, r.result])].some(n => !bound.has(n))) throw new Error(`Unbound equation variable: ${r.id}`);
      if (termSort(r.result, r.variables, algebra, op.result) !== op.result) throw new Error(`Ill-sorted result: ${r.id}`);
      for (const c of r.conditions || []) validateCondition(c, r.variables, algebra);
    }
  }
  checkVars(variables);
  const used = variablesIn([args, conditions]);
  if (Object.keys(variables).some(n => !used.has(n))) throw new Error('Every goal variable must occur in arguments or constraints');
  termSort({ call: operation, args }, variables, algebra);
  for (const c of conditions) validateCondition(c, variables, algebra);
  return true;
}
export function validateCondition(c, vars, algebra) {
  if (!['==', '!=', '<', '<=', '>', '>='].includes(c?.op)) throw new Error('Unsupported comparison');
  // Infer from a non-literal operand first, to allow e.g. 0 <= an Int variable.
  const sort = termSort(typeof c.left === 'number' ? c.right : c.left, vars, algebra);
  if (termSort(c.left, vars, algebra, sort) !== sort || termSort(c.right, vars, algebra, sort) !== sort || (!['Nat', 'Int'].includes(sort) && !['==', '!='].includes(c.op))) throw new Error('Ill-sorted comparison');
}
export function evaluateGround(t) {
  if (isVariable(t) || t?.call) throw new Error('Term is not ground and unfolded');
  if (t?.ctor) return { ctor: t.ctor, args: t.args.map(evaluateGround) };
  if (t?.op) {
    const a = evaluateGround(t.left), b = evaluateGround(t.right);
    if (['+', '-'].includes(t.op)) {
      const n = t.op === '+' ? a + b : a - b;
      if (!Number.isSafeInteger(n)) throw new Error('Witness exceeds exact JavaScript integer range');
      return n;
    }
    const same = JSON.stringify(a) === JSON.stringify(b);
    return ({ '==': () => same, '!=': () => !same, '<': () => a < b, '<=': () => a <= b, '>': () => a > b, '>=': () => a >= b })[t.op]();
  }
  return t;
}
export function formatSymbolicTerm(t) {
  if (isVariable(t)) return t.var.replace(/@(\d+)\.(\w+)/g, (_, id, name) => name + [...id].map(n => '₀₁₂₃₄₅₆₇₈₉'[n]).join(''));
  if (t?.ctor || t?.call) return `${t.ctor || t.call}(${t.args.map(formatSymbolicTerm).join(', ')})`;
  if (t?.op) return `(${formatSymbolicTerm(t.left)} ${t.op} ${formatSymbolicTerm(t.right)})`;
  return String(t);
}
