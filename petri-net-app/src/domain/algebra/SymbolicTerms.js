import { quoteTermString } from '../../utils/term-string.js';
import { validBuiltinValue, symbolicToValue } from '../../utils/builtin-values.js';
import { builtinDisplay } from './BuiltinAlgebra.js';
/** Typed, first-order terms shared by the equation editor, unfolding and SMT adapter. */
export const isVariable = t => !!t && typeof t === 'object' && typeof t.var === 'string';
export const variablesIn = (t, names = new Set()) => {
  if (isVariable(t)) names.add(t.var);else if (t && typeof t === 'object') Object.values(t).forEach(x => variablesIn(x, names));
  return names;
};
export function substitute(t, bindings) {
  if (isVariable(t)) return bindings.has(t.var) ? substitute(bindings.get(t.var), bindings) : t;
  if (Array.isArray(t)) return t.map(x => substitute(x, bindings));
  if (t && typeof t === 'object') return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, substitute(v, bindings)]));
  return t;
}
export function unify(a, b, bindings) {
  a = substitute(a, bindings);
  b = substitute(b, bindings);
  if (isVariable(a) || isVariable(b)) {
    const v = isVariable(a) ? a : b,
      t = isVariable(a) ? b : a;
    if (isVariable(t) && t.var === v.var) return true;
    if (variablesIn(t).has(v.var)) return false;
    bindings.set(v.var, t);
    return true;
  }
  if (a?.ctor && b?.ctor && a.ctor === b.ctor && a.args.length === b.args.length) return a.args.every((x, i) => unify(x, b.args[i], bindings));
  return JSON.stringify(a) === JSON.stringify(b);
}
export const logicalOps = ['and', 'or', 'not', 'xor', 'implies', 'iff'];
const numeric = s => ['Nat', 'Int'].includes(s);
export function termSort(t, vars, algebra, expected) {
  const accept = sort => expected === 'Any' || expected === 'Int' && sort === 'Nat' ? expected : sort;
  if (t?.undefined) return expected || 'Any';
  // Internal, typed terms produced by guarded equation compilation. They are
  // not additions to the user-facing term syntax.
  if (t?.test) {
    if (termSort(t.value, vars, algebra) !== algebra.constructors[t.test]?.result) throw new Error('Ill-sorted constructor test');
    return accept('Bool');
  }
  if (t?.field) {
    const signature = algebra.constructors[t.field];
    if (!signature || !Number.isInteger(t.index) || !signature.parameters[t.index] || termSort(t.value, vars, algebra) !== signature.result) throw new Error('Ill-sorted constructor field');
    return accept(signature.parameters[t.index]);
  }
  if (t?.valid) {
    const actual = termSort(t.value, vars, algebra);
    if (actual !== t.valid && !(numeric(actual) && numeric(t.valid))) throw new Error('Ill-sorted runtime validity check');
    return accept('Bool');
  }
  if (t?.if !== undefined) {
    if (termSort(t.if, vars, algebra) !== 'Bool') throw new Error('Conditional requires Bool');
    const a = termSort(t.then, vars, algebra), b = termSort(t.else, vars, algebra);
    if (a !== b && !(numeric(a) && numeric(b))) throw new Error('Conditional branches have different sorts');
    return accept(a === b ? a : 'Int');
  }
  if (typeof t === 'boolean') return accept('Bool');
  if (typeof t === 'string') return accept('String');
  if (Number.isSafeInteger(t)) {
    if (expected === 'Nat' && t < 0) throw new Error('Negative Nat literal');
    return accept(t < 0 ? 'Int' : 'Nat');
  }
  if (isVariable(t)) {
    if (!vars[t.var]) throw new Error(`Undeclared variable: ${t.var}`);
    return accept(vars[t.var]);
  }
  if (t?.op) {
    if (logicalOps.includes(t.op)) {
      if (termSort(t.left, vars, algebra) !== 'Bool' || t.op !== 'not' && termSort(t.right, vars, algebra) !== 'Bool') throw new Error('Logical operators require Bool operands');
      return accept('Bool');
    }
    const left = termSort(t.left, vars, algebra),
      right = termSort(t.right, vars, algebra);
    if (['+', '-', '*'].includes(t.op)) {
      if (![left, right].every(s => numeric(s) || s === 'Any')) throw new Error('Arithmetic operands must be numeric');
      return accept(left === 'Nat' && right === 'Nat' ? 'Nat' : 'Int');
    }
    if (!['==', '!=', '<', '<=', '>', '>='].includes(t.op)) throw new Error('Unsupported operator');
    if (['==', '!='].includes(t.op)) {
      if (left !== right && left !== 'Any' && right !== 'Any' && !(numeric(left) && numeric(right))) throw new Error('Ill-sorted equality');
    } else if (![left, right].every(s => numeric(s) || s === 'Any')) throw new Error('Ordering requires numeric operands');
    return accept('Bool');
  }
  const sig = t?.ctor ? algebra.constructors[t.ctor] : t?.call ? algebra.operations[t.call] : null;
  if (!sig || !Array.isArray(t.args) || t.args.length !== sig.parameters.length) throw new Error('Unknown term or wrong constructor/operation arity');
  t.args.forEach((a, i) => {
    if (termSort(a, vars, algebra, sig.parameters[i]) !== sig.parameters[i]) throw new Error(`Ill-sorted argument of ${t.ctor || t.call}`);
  });
  return accept(sig.result);
}
/** Insert explicit Any tags/projections; one source variable remains one symbol. */
export function elaborateTerm(t, vars, algebra, expected) {
  if (t?.undefined) return t;
  const sort = termSort(t, vars, algebra);
  if (expected === 'Any' && sort !== 'Any') {
    const tag = algebra.anyTags?.[sort === 'Nat' ? 'Int' : sort];
    if (!tag) throw new Error(`No Any representation for ${sort}`);
    return {
      ctor: tag,
      args: [elaborateTerm(t, vars, algebra, sort)]
    };
  }
  if (sort === 'Any' && expected && expected !== 'Any') {
    if (!['Int', 'Bool', 'String', 'List', 'Pair', 'Nat'].includes(expected)) throw new Error(`Cannot project Any to ${expected}`);
    return {
      call: `_as${expected === 'Nat' ? 'Int' : expected}`,
      args: [elaborateTerm(t, vars, algebra)]
    };
  }
  if (t?.test || t?.field || t?.valid || t?.if !== undefined) return t;
  if (t?.op) {
    let operandSort;
    if (logicalOps.includes(t.op)) operandSort = 'Bool';else {
      const a = termSort(t.left, vars, algebra),
        b = termSort(t.right, vars, algebra);
      operandSort = ['==', '!='].includes(t.op) && (a === 'Any' || b === 'Any') ? 'Any' : numeric(a) && numeric(b) && a === 'Nat' && b === 'Nat' ? 'Nat' : ['+', '-', '*', '<', '<=', '>', '>='].includes(t.op) ? 'Int' : a;
    }
    return {
      ...t,
      left: elaborateTerm(t.left, vars, algebra, operandSort),
      ...(t.op === 'not' ? {} : {
        right: elaborateTerm(t.right, vars, algebra, operandSort)
      })
    };
  }
  if (t?.ctor || t?.call) {
    const sig = t.ctor ? algebra.constructors[t.ctor] : algebra.operations[t.call];
    return {
      ...t,
      args: t.args.map((a, i) => elaborateTerm(a, vars, algebra, sig.parameters[i]))
    };
  }
  return t;
}
export function validateSymbolicGoal({
  algebra,
  operation,
  args,
  variables = {},
  maxDepth = 2,
  conditions = []
}) {
  if (!algebra?.constructors || !algebra?.operations) throw new Error('Typed constructors and operation equations are required');
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 32) throw new Error('Unfolding budget must be an integer from 1 to 32');
  const known = new Set(['Nat', 'Int', 'Bool', 'String', 'List', 'Pair', 'Any', ...Object.values(algebra.constructors).map(s => s.result)]);
  for (const [name, s] of Object.entries({
    ...algebra.constructors,
    ...algebra.operations
  })) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || !Array.isArray(s.parameters) || !known.has(s.result) || s.parameters.some(x => !known.has(x))) throw new Error(`Invalid signature: ${name}`);
  }
  if (Object.keys(algebra.constructors).some(n => algebra.operations[n])) throw new Error('Constructor and operation names must be distinct');
  if (Object.values(algebra.constructors).some(s => ['Nat', 'Int', 'Bool', 'String', 'List', 'Pair', 'Any'].includes(s.result) && !s.builtin)) throw new Error('Built-in sorts cannot be redefined by constructors');
  const checkVars = vars => {
    for (const [n, s] of Object.entries(vars)) if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n) || !known.has(s)) throw new Error(`Invalid variable declaration: ${n}: ${s}`);
  };
  const ids = new Set();
  for (const [name, op] of Object.entries(algebra.operations)) {
    if (op.primitive) continue;
    if (!op.rules?.length) throw new Error(`Operation has no defining equations: ${name}`);
    for (const r of op.rules) {
      if (!r.id || ids.has(r.id)) throw new Error('Equation IDs must be unique and nonempty');
      ids.add(r.id);
      checkVars(r.variables || {});
      const pattern = t => isVariable(t) || typeof t === 'boolean' || typeof t === 'string' || Number.isSafeInteger(t) || t?.ctor && t.args.every(pattern);
      if (!Array.isArray(r.patterns) || r.patterns.length !== op.parameters.length) throw new Error(`Wrong equation arity: ${r.id}`);
      r.patterns.forEach((t, i) => {
        if (!pattern(t) || termSort(t, r.variables, algebra, op.parameters[i]) !== op.parameters[i]) throw new Error(`Ill-sorted constructor pattern: ${r.id}`);
      });
      const bound = variablesIn(r.patterns);
      if ([...variablesIn([r.conditions, r.result])].some(n => !bound.has(n))) throw new Error(`Unbound equation variable: ${r.id}`);
      if (termSort(r.result, r.variables, algebra, op.result) !== op.result) throw new Error(`Ill-sorted result: ${r.id}`);
      for (const c of r.conditions || []) validateCondition(c, r.variables, algebra);
    }
  }
  checkVars(variables);
  const used = variablesIn([args, conditions]);
  if (Object.keys(variables).some(n => !used.has(n))) throw new Error('Every goal variable must occur in arguments or constraints');
  termSort({
    call: operation,
    args
  }, variables, algebra);
  for (const c of conditions) validateCondition(c, variables, algebra);
  return true;
}
export function validateCondition(c, vars, algebra) {
  if (termSort(c, vars, algebra) !== 'Bool') throw new Error('Guard conditions must be Boolean');
}
export function evaluateGround(t) {
  if (t?.if !== undefined) return evaluateGround(evaluateGround(t.if) ? t.then : t.else);
  if (t?.test) return evaluateGround(t.value)?.ctor === t.test;
  if (t?.field) {
    const value = evaluateGround(t.value);
    if (value?.ctor !== t.field) throw new Error('Constructor field used outside its matching branch');
    return value.args[t.index];
  }
  if (t?.valid) return validBuiltinValue(symbolicToValue(evaluateGround(t.value)), t.valid, 64 - (t.depth ?? 64));
  if (t?.undefined) throw new Error(t.undefined);
  if (isVariable(t)) throw new Error('Term is not ground');
  if (t?.call) {
    const args = t.args.map(evaluateGround),
      [a, b, n] = args;
    if (t.call === '_string_length_value') return a.length;
    if (t.call === '_string_concat_value') return a + b;
    if (t.call === '_string_substring_value') return a.substr(b, n);
    if (t.call === '_string_isSubstringOf_value') return b.includes(a);
    if (t.call === '_sliceIndex') return a < 0 ? Math.max(b + a, 0) : Math.min(a, b);
    throw new Error('Term is not fully unfolded');
  }
  if (t?.ctor) return {
    ctor: t.ctor,
    args: t.args.map(evaluateGround)
  };
  if (t?.op) {
    const a = evaluateGround(t.left);
    if (t.op === 'not') return !a;
    if (t.op === 'and') return a && evaluateGround(t.right);
    if (t.op === 'or') return a || evaluateGround(t.right);
    if (t.op === 'implies') return !a || evaluateGround(t.right);
    const b = evaluateGround(t.right);
    if (['+', '-', '*'].includes(t.op)) {
      const x = BigInt(a),
        y = BigInt(b);
      const exact = t.op === '+' ? x + y : t.op === '-' ? x - y : x * y;
      const n = Number(exact);
      if (!Number.isSafeInteger(n)) throw new Error('Witness exceeds exact JavaScript integer range');
      return n;
    }
    const same = JSON.stringify(a) === JSON.stringify(b);
    return {
      '==': () => same,
      '!=': () => !same,
      '<': () => a < b,
      '<=': () => a <= b,
      '>': () => a > b,
      '>=': () => a >= b,
      xor: () => a !== b,
      iff: () => a === b
    }[t.op]();
  }
  return t;
}
export function formatSymbolicTerm(t) {
  if (t?.if !== undefined) return `if ${formatSymbolicTerm(t.if)} then ${formatSymbolicTerm(t.then)} else ${formatSymbolicTerm(t.else)}`;
  if (t?.test) return `is ${builtinDisplay(t.test)}(${formatSymbolicTerm(t.value)})`;
  if (t?.field) return `${builtinDisplay(t.field)}.field${t.index}(${formatSymbolicTerm(t.value)})`;
  if (t?.valid) return `valid ${t.valid}(${formatSymbolicTerm(t.value)})`;
  if (isVariable(t)) return t.var.replace(/@(\d+)\.(\w+)/g, (_, id, name) => name + [...id].map(n => '₀₁₂₃₄₅₆₇₈₉'[n]).join(''));
  if (t?.undefined) return `undefined (${t.undefined})`;
  if (typeof t === 'string') return quoteTermString(t);
  if (t?.ctor?.startsWith('_Any')) return formatSymbolicTerm(t.args[0]);
  if (t?.ctor === '_Pair') return `(${t.args.map(formatSymbolicTerm).join(', ')})`;
  if (t?.ctor === '_ListNil') return '[]';
  if (t?.ctor === '_ListCons') {
    const values = [];
    let tail = t;
    while (tail?.ctor === '_ListCons') {
      values.push(formatSymbolicTerm(tail.args[0]));
      tail = tail.args[1];
    }
    return `[${values.join(', ')}${tail?.ctor === '_ListNil' ? '' : ` | ${formatSymbolicTerm(tail)}`}]`;
  }
  if (t?.ctor || t?.call) return `${builtinDisplay(t.ctor || t.call)}(${t.args.map(formatSymbolicTerm).join(', ')})`;
  if (t?.op === 'not') return `not (${formatSymbolicTerm(t.left)})`;
  if (t?.op) return `(${formatSymbolicTerm(t.left)} ${t.op} ${formatSymbolicTerm(t.right)})`;
  return String(t);
}
