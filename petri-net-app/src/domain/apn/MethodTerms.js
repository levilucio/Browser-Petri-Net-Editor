import { parseSymbolicSource, parseTerms } from '../algebra/Source.js';
import { termSort } from '../algebra/SymbolicTerms.js';
import { validBuiltinValue } from '../../utils/builtin-values.js';
import { equalValues } from '../../utils/value-equality.js';
const algebra = parseSymbolicSource('');
const checked = (value, sort) => {
  if (!validBuiltinValue(value, sort)) throw new Error(`Method value must be ${sort}${['Nat', 'Int'].includes(sort) ? ' in the supported 32-bit range' : ''}`);
  return value;
};
export function compileMethodTerm(text, variables = {}, expected) {
  let terms;
  try {
    terms = parseTerms(text, algebra, variables);
  } catch (e) {
    throw new Error(e.message.replace('Undeclared variable', 'Unbound method variable'));
  }
  if (terms.length !== 1) throw new Error('Expected one method expression');
  const term = terms[0],
    sort = termSort(term, variables, algebra);
  if (expected && sort !== expected && sort !== 'Any' && !(expected === 'Int' && sort === 'Nat') && !(expected === 'Nat' && sort === 'Int')) throw new Error(`Method expression has sort ${sort}; expected ${expected}`);
  const literals = t => {
    if (typeof t === 'number') checked(t, 'Int');
    if (t && typeof t === 'object') Object.values(t).forEach(literals);
  };
  literals(term);
  return term;
}
/** Evaluate fully bound public-call terms. No solver, hidden variable assignment or JS eval. */
export function evaluateMethodTerm(t, env = {}) {
  const run = a => evaluateMethodTerm(a, env);
  if (t?.var) {
    if (!Object.hasOwn(env, t.var)) throw new Error(`Unbound method variable: ${t.var}`);
    return env[t.var];
  }
  if (t?.ctor) {
    const args = t.args.map(run);
    if (t.ctor === '_ListNil') return [];
    if (t.ctor === '_ListCons') return [args[0], ...checked(args[1], 'List')];
    if (t.ctor === '_Pair') return {
      __pair__: true,
      fst: args[0],
      snd: args[1]
    };
    throw new Error(`Unsupported method constructor: ${t.ctor}`);
  }
  if (t?.op) {
    const a = run(t.left),
      bool = () => checked(a, 'Bool');
    if (t.op === 'not') return !bool();
    if (t.op === 'and') return bool() && checked(run(t.right), 'Bool');
    if (t.op === 'or') return bool() || checked(run(t.right), 'Bool');
    if (t.op === 'implies') return !bool() || checked(run(t.right), 'Bool');
    const b = run(t.right);
    if (t.op === 'xor' || t.op === 'iff') return t.op === 'xor' ? bool() !== checked(b, 'Bool') : bool() === checked(b, 'Bool');
    if (t.op === '==') return equalValues(a, b);
    if (t.op === '!=') return !equalValues(a, b);
    checked(a, 'Int');
    checked(b, 'Int');
    if (['+', '-', '*'].includes(t.op)) {
      const x = BigInt(a),
        y = BigInt(b);
      return checked(Number(t.op === '+' ? x + y : t.op === '-' ? x - y : x * y), 'Int');
    }
    return {
      '<': () => a < b,
      '<=': () => a <= b,
      '>': () => a > b,
      '>=': () => a >= b
    }[t.op]();
  }
  if (t?.call) {
    const args = t.args.map(run),
      [a, b, n] = args;
    const signature = algebra.operations[t.call];
    args.forEach((arg, i) => checked(arg, signature.parameters[i]));
    let result;
    switch (t.call) {
      case '_listLength':
      case '_string_length':
        result = a.length;
        break;
      case '_listConcat':
      case '_string_concat':
        result = a.concat(b);
        break;
      case '_listHead':
        if (!a.length) throw new Error('head requires a non-empty list');
        result = a[0];
        break;
      case '_listTail':
        result = a.slice(1);
        break;
      case '_listAppend':
        result = [...a, b];
        break;
      case '_listSublist':
        result = a.slice(b, b + n);
        break;
      case '_listContains':
        result = a.length === 0 || b.some((_, i) => i + a.length <= b.length && a.every((v, j) => equalValues(v, b[i + j])));
        break;
      case '_pair_fst':
        result = a.fst;
        break;
      case '_pair_snd':
        result = a.snd;
        break;
      case '_string_substring':
        result = a.substr(b, n);
        break;
      case '_string_isSubstringOf':
        result = b.includes(a);
        break;
      case '_asInt':
      case '_asBool':
      case '_asString':
      case '_asList':
      case '_asPair':
        result = a;
        break;
      default:
        throw new Error(`Unsupported method operation: ${t.call}`);
    }
    return checked(result, signature.result);
  }
  return t;
}
export function parseMethodValue(text, sort) {
  return checked(evaluateMethodTerm(compileMethodTerm(text, {}, sort)), sort);
}
