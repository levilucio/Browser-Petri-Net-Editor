import { diagnostic, checkCancelled } from '../../domain/diagnostics.js';
import { getContext } from '../../utils/z3/context.js';
import { evaluateGround, substitute, variablesIn, termSort } from './SymbolicTerms.js';
let serial = 0;
// Encode JavaScript UTF-16 code units, including lone surrogates, without changing
// length/substr semantics to Unicode code-point indexing.
const stringLiteral = s => '"' + Array.from({
  length: s.length
}, (_, i) => `\\u{${s.charCodeAt(i).toString(16)}}`).join('') + '"';
function decodeString(text) {
  if (!text.startsWith('"') || !text.endsWith('"')) throw new Error('Nonliteral string model');
  let out = '';
  for (let i = 1; i < text.length - 1; i++) {
    if (text[i] === '"' && text[i + 1] === '"') {
      out += '"';
      i++;
      continue;
    }
    const m = text.slice(i).match(/^\\u\{([0-9a-f]+)\}/i) || text.slice(i).match(/^\\u([0-9a-f]{4})/i);
    if (m) {
      const code = parseInt(m[1], 16);
      if (code > 65535) throw new Error('String witness leaves UTF-16 code-unit alphabet');
      out += String.fromCharCode(code);
      i += m[0].length - 1;
    } else out += text[i];
  }
  return out;
}
/** Shared Z3 context, using SMT-LIB for strings absent from this JS wrapper's high-level API. */
export async function createSymbolicSolver(algebra, options = {}) {
  const {
    ctx,
    z3: {
      Z3
    }
  } = await getContext();
  const c = ctx.ptr;
  const prefix = `satel${++serial}_`;
  const names = [...new Set(Object.values(algebra.constructors).map(c => c.result))];
  const sort = s => s === 'Nat' ? 'Int' : ['Int', 'Bool', 'String'].includes(s) ? s : prefix + s;
  const nameOf = n => prefix + n;
  const bySort = Object.fromEntries(names.map(n => [n, Object.entries(algebra.constructors).filter(([, c]) => c.result === n)]));
  const valid = (s, value) => s === 'Nat' ? `(>= ${value} 0)` : s === 'String' ? `(str.in_re ${value} (re.* (re.range "\\u{0}" "\\u{ffff}")))` : names.includes(s) ? `(${prefix}valid_${s} ${value})` : 'true';
  let preamble = '';
  if (names.length) {
    preamble += `(declare-datatypes (${names.map(n => `(${sort(n)} 0)`).join(' ')}) (${names.map(n => `(${bySort[n].map(([c, sig]) => `(${nameOf(c)} ${sig.parameters.map((s, i) => `(${nameOf(c)}_${i} ${sort(s)})`).join(' ')})`).join(' ')})`).join(' ')}))\n`;
    preamble += `(define-funs-rec (${names.map(n => `(${prefix}valid_${n} ((x ${sort(n)})) Bool)`).join(' ')}) (${names.map(n => `(or ${bySort[n].map(([c, sig]) => `(and ((_ is ${nameOf(c)}) x) ${sig.parameters.map((s, i) => valid(s, `(${nameOf(c)}_${i} x)`)).join(' ')})`).join(' ')})`).join(' ')}))\n`;
  }
  // Mirror validBuiltinValue, including bounded nested machine integers. Flat
  // list tails do not consume nesting depth; Any wrappers do.
  const runtimeSorts = ['List', 'Pair', 'Any'].filter(s => names.includes(s));
  const runtimeValid = (s, x, d) => ['Nat', 'Int'].includes(s) ? `(and (>= ${d} 0) (>= ${x} ${s === 'Nat' ? 0 : '(- 2147483648)'}) (<= ${x} 2147483647))` : ['Bool', 'String'].includes(s) ? `(>= ${d} 0)` : runtimeSorts.includes(s) ? `(${prefix}runtime_${s} ${x} ${d})` : 'false';
  if (runtimeSorts.length) {
    const descend = s => {
      const tag = ctor => `((_ is ${nameOf(ctor)}) x)`;
      const field = (ctor, i) => `(${nameOf(ctor)}_${i} x)`;
      const smaller = '(- d 1)';
      if (s === 'List') return `(or ${tag('_ListNil')} (and ${tag('_ListCons')} ${runtimeValid('Any', field('_ListCons', 0), smaller)} ${runtimeValid('List', field('_ListCons', 1), 'd')}))`;
      if (s === 'Pair') return `(and ${runtimeValid('Any', field('_Pair', 0), smaller)} ${runtimeValid('Any', field('_Pair', 1), smaller)})`;
      return `(or ${['Int', 'Bool', 'String', 'List', 'Pair'].map(sort => `(and ${tag('_Any' + sort)} ${runtimeValid(sort, field('_Any' + sort, 0), smaller)})`).join(' ')})`;
    };
    preamble += `(define-funs-rec (${runtimeSorts.map(s => `(${prefix}runtime_${s} ((x ${sort(s)}) (d Int)) Bool)`).join(' ')}) (${runtimeSorts.map(s => `(and (>= d 0) ${descend(s)})`).join(' ')}))\n`;
  }
  let checkId = 0;
  return async function solve({
    terms,
    conditions,
    variables,
    witness = true
  }) {
    checkCancelled(options.signal);
    const solver = new ctx.Solver();
    solver.set('timeout', options.timeoutMs ?? 3000);
    let vector = null;
    try {
      const symbolNames = new Map([...variablesIn(witness ? [terms, conditions] : conditions)].map(n => [n, `${prefix}v${++checkId}`]));
      const encode = t => {
        if (typeof t === 'number') return t < 0 ? `(- ${-t})` : String(t);
        if (typeof t === 'string') return stringLiteral(t);
        if (typeof t === 'boolean') return String(t);
        if (t?.var) {
          if (!symbolNames.has(t.var)) throw new Error('Missing symbolic variable');
          return symbolNames.get(t.var);
        }
        if (t?.if !== undefined) return `(ite ${encode(t.if)} ${encode(t.then)} ${encode(t.else)})`;
        if (t?.test) return `((_ is ${nameOf(t.test)}) ${encode(t.value)})`;
        if (t?.field) return `(${nameOf(t.field)}_${t.index} ${encode(t.value)})`;
        if (t?.valid) return runtimeValid(t.valid, encode(t.value), String(t.depth ?? 64));
        if (t?.ctor) return t.args.length ? `(${nameOf(t.ctor)} ${t.args.map(encode).join(' ')})` : nameOf(t.ctor);
        if (t?.op) {
          const a = encode(t.left);
          if (t.op === 'not') return `(not ${a})`;
          const b = encode(t.right);
          const op = {
            '+': '+',
            '-': '-',
            '*': '*',
            '==': '=',
            '!=': 'distinct',
            '<': '<',
            '<=': '<=',
            '>': '>',
            '>=': '>=',
            and: 'and',
            or: 'or',
            xor: 'xor',
            implies: '=>',
            iff: '='
          }[t.op];
          if (!op) throw new Error(`Unsupported SMT operator ${t.op}`);
          return `(${op} ${a} ${b})`;
        }
        if (t?.call && algebra.operations[t.call]?.primitive) {
          const [a, b, n] = t.args.map(encode);
          switch (algebra.operations[t.call].primitive) {
            case 'length':
              return `(str.len ${a})`;
            case 'concat':
              return `(str.++ ${a} ${b})`;
            case 'isSubstringOf':
              return `(str.contains ${b} ${a})`;
            case 'substring':
              return `(str.substr ${a} (ite (< ${b} 0) (ite (< (+ (str.len ${a}) ${b}) 0) 0 (+ (str.len ${a}) ${b})) ${b}) ${n})`;
            case 'sliceIndex':
              return `(ite (< ${a} 0) (ite (< (+ ${b} ${a}) 0) 0 (+ ${b} ${a})) (ite (> ${a} ${b}) ${b} ${a}))`;
          }
        }
        throw new Error('Residual operation must be unfolded before SMT solving');
      };
      const declarations = [...symbolNames].map(([n, v]) => `(declare-const ${v} ${sort(variables[n])})`).join('\n');
      // Preserve an AST handle for unconstrained variables as well, for model completion.
      const handles = [...symbolNames.values()].map(v => `(assert (= ${v} ${v}))`).join('\n');
      const assertions = [...symbolNames].map(([n, v]) => valid(variables[n], v)).concat(conditions.map(encode));
      solver.fromString(preamble + declarations + '\n' + handles + '\n' + assertions.map(s => `(assert ${s})`).join('\n'));
      // Own these handles explicitly. The wrapper's AstVector/Model finalizers
      // can otherwise release them during a later asynchronous check().
      vector = Z3.solver_get_assertions(c, solver.ptr);
      Z3.ast_vector_inc_ref(c, vector);
      const symbols = new Map([...symbolNames.keys()].map((n, i) => [n, Z3.get_app_arg(c, Z3.to_app(c, Z3.ast_vector_get(c, vector, i)), 0)]));
      const status = String(await solver.check());
      if (status !== 'sat') return {
        status: status === 'unsat' ? 'unsat' : 'unknown',
        reason: status === 'unsat' ? 'Contradictory constructor/arithmetic/Boolean/string constraints' : 'Z3 returned unknown (possibly timeout)'
      };
      if (!witness) return {
        status: 'sat'
      };
      const readWitness = () => {
        const model = Z3.solver_get_model(c, solver.ptr);
        Z3.model_inc_ref(c, model);
        try {
          let remaining = 2000;
          const decode = (value, expected) => {
            if (--remaining < 0) throw new Error('Witness is too large to display safely');
            if (expected === 'String') return decodeString(Z3.ast_to_string(c, value));
            if (['Nat', 'Int'].includes(expected)) {
              const n = Number(Z3.get_numeral_string(c, value));
              if (!Number.isSafeInteger(n)) throw new Error('Witness exceeds exact JavaScript integer range');
              return n;
            }
            if (expected === 'Bool') {
              const truth = Z3.get_bool_value(c, value);
              if (truth !== 1 && truth !== -1) throw new Error('Nonliteral Boolean model');
              return truth === 1;
            }
            const app = Z3.to_app(c, value);
            const name = Z3.get_symbol_string(c, Z3.get_decl_name(c, Z3.get_app_decl(c, app))).slice(prefix.length),
              sig = algebra.constructors[name];
            if (!sig) throw new Error('Z3 returned a non-constructor witness');
            return {
              ctor: name,
              args: Array.from({
                length: Z3.get_app_num_args(c, app)
              }, (_, i) => decode(Z3.get_app_arg(c, app, i), sig.parameters[i]))
            };
          };
          const bindings = new Map([...symbols].map(([n, x]) => {
            const value = decode(Z3.model_eval(c, model, x, true), variables[n]);
            if (termSort(value, {}, algebra, variables[n]) !== variables[n]) throw new Error('Independent witness sort check failed');
            return [n, value];
          }));
          if (!conditions.every(c => evaluateGround(substitute(c, bindings)) === true)) throw new Error('Independent witness constraint check failed');
          return {
            status: 'sat',
            bindings
          };
        } finally {
          Z3.model_dec_ref(c, model);
        }
      };
      // Decode and independently validate the first model before any optional
      // check can replace it. A preference timeout must not erase a SAT witness.
      const original = readWitness();
      const preferred = [...symbols].filter(([n]) => ['Nat', 'Int'].includes(variables[n]));
      if (!preferred.length) return original;
      checkCancelled(options.signal);
      solver.push();
      try {
        const one = Z3.mk_numeral(c, '1', Z3.mk_int_sort(c));
        Z3.inc_ref(c, one);
        try {
          preferred.forEach(([, x]) => Z3.solver_assert(c, solver.ptr, Z3.mk_eq(c, x, one)));
        } finally {
          Z3.dec_ref(c, one);
        }
        const preferredStatus = String(await solver.check());
        checkCancelled(options.signal);
        if (preferredStatus === 'sat') return readWitness();
      } catch (error) {
        if (error.code === 'cancelled') throw error;
        // Optional preference errors (including a failed model validation) do
        // not invalidate the independently checked original assignment.
      } finally {
        solver.pop();
      }
      return original;
    } catch (error) {
      if (error.code === 'cancelled') throw error;
      return {
        status: 'unknown',
        reason: error.message,
        diagnostic: diagnostic(error, 'solver')
      };
    } finally {
      if (vector !== null) Z3.ast_vector_dec_ref(c, vector);
      solver.release();
    }
  };
}
