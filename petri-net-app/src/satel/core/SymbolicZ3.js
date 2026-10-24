import { createOwnedSolver, runOwnedQuery } from '../../utils/z3/owned-solver.js';
import { createSymbolicPreamble } from './SymbolicPreamble.js';
import { refutesNumericPreference } from './NumericPreference.js';
import { createSolverProfile } from './SolverProfile.js';
import { withSolverQueryCache } from './SolverQueryCache.js';
import { copy, freeze } from '../../domain/snapshots.js';
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
/** SMT-LIB adapter. Projected queries own a context to isolate solver history. */
export async function createSymbolicSolver(algebra, options = {}) {
  // One adapter owns one fixed semantic context. Caller mutation must not change
  // either the generated datatype preamble or a previously solved query's meaning.
  algebra = freeze(copy(algebra));
  options = { ...options, ...(typeof options.solverQueryCache === 'object' && options.solverQueryCache ? { solverQueryCache: { ...options.solverQueryCache } } : {}) };
  const contextMode = options.solverContext ?? (options.smtPreambleProjection === true ? 'query' : 'shared');
  if (!['shared', 'query'].includes(contextMode)) throw new Error('Unknown SATEL solver context mode');
  checkCancelled(options.signal);
  const shared = await getContext();
  const { Z3 } = shared.z3;
  const prefix = contextMode === 'query' ? 'satel_' : `satel${++serial}_`;
  const preambles = createSymbolicPreamble(algebra, prefix);
  const { sort, nameOf, valid, runtimeValid } = preambles;
  const validateWitness = ({ terms, conditions, variables }, bindings) => {
    const required = variablesIn([terms, conditions]);
    if (!(bindings instanceof Map) || bindings.size !== required.size) throw new Error('Independent witness variable check failed');
    for (const n of required) {
      if (!bindings.has(n) || termSort(bindings.get(n), {}, algebra, variables[n]) !== variables[n]) throw new Error('Independent witness sort check failed');
    }
    if (!conditions.every(condition => evaluateGround(substitute(condition, bindings)) === true)) throw new Error('Independent witness constraint check failed');
  };
  const profiler = options.profileSolver ? createSolverProfile() : null;
  let sharedCheckId = 0;
  const execute = async function solve({
    terms,
    conditions,
    variables,
    witness = true
  }) {
    checkCancelled(options.signal);
    const trace = profiler?.start(witness);
    let c;
    let checkId = contextMode === 'query' ? 0 : sharedCheckId;
    let solver;
    try {
      solver = contextMode === 'query' ? createOwnedSolver(Z3) : new shared.ctx.Solver();
      c = contextMode === 'query' ? solver.context : shared.ctx.ptr;
      solver.set('timeout', options.timeoutMs ?? 3000);
    } catch (error) {
      try { solver?.release(); }
      finally { trace?.finish('error'); }
      throw error;
    }
    let vector = null, outcome = 'error';
    try {
      trace?.phase('encode');
      const symbolNames = new Map([...variablesIn(witness ? [terms, conditions] : conditions)].map(n => [n, `${prefix}v${++checkId}`]));
      const requiredSorts = new Set([...symbolNames.keys()].map(n => variables[n]));
      let runtimeRequired = false;
      const requireConstructor = name => {
        const signature = algebra.constructors[name];
        if (signature) requiredSorts.add(signature.result);
      };
      const graphDeclarations = [], graphAssertions = [];
      const encode = (t, resolveRef) => {
        const enc = child => encode(child, resolveRef);
        if (t?.termGraph) {
          const nodes = t.termGraph;
          if (!Array.isArray(nodes) || !nodes.length) throw new Error('Empty or invalid term graph');
          const name = `${prefix}g${++checkId}_`;
          const nodeSorts = [];
          nodes.forEach((node, i) => {
            const checkedIndex = ref => {
              if (!Number.isInteger(ref) || ref < 0 || ref >= i) throw new Error('Invalid or forward term graph reference');
              return ref;
            };
            nodeSorts.push(termSort(node, variables, algebra, undefined, ref => nodeSorts[checkedIndex(ref)]));
            requiredSorts.add(nodeSorts[i]);
            const value = encode(node, ref => name + checkedIndex(ref));
            graphDeclarations.push(`(declare-const ${name}${i} ${sort(nodeSorts[i])})`);
            graphAssertions.push(`(assert (= ${name}${i} ${value}))`);
          });
          // Definitional equalities avoid the SMT parser expanding nested lets.
          // These internal symbols are not witness parameters. Independent
          // checking evaluates the original graph lazily, not these definitions.
          return name + (nodes.length - 1);
        }
        if (t?.graphRef !== undefined) {
          if (typeof resolveRef !== 'function') throw new Error('Term graph reference outside its scope');
          return resolveRef(t.graphRef);
        }
        if (typeof t === 'number') return t < 0 ? `(- ${-t})` : String(t);
        if (typeof t === 'string') return stringLiteral(t);
        if (typeof t === 'boolean') return String(t);
        if (t?.var) {
          if (!symbolNames.has(t.var)) throw new Error('Missing symbolic variable');
          return symbolNames.get(t.var);
        }
        if (t?.if !== undefined) return `(ite ${enc(t.if)} ${enc(t.then)} ${enc(t.else)})`;
        if (t?.test) requireConstructor(t.test);
        if (t?.field) requireConstructor(t.field);
        if (t?.ctor) requireConstructor(t.ctor);
        if (t?.valid && ['List', 'Pair', 'Any'].includes(t.valid)) runtimeRequired = true;
        if (t?.test) return `((_ is ${nameOf(t.test)}) ${enc(t.value)})`;
        if (t?.field) return `(${nameOf(t.field)}_${t.index} ${enc(t.value)})`;
        if (t?.valid) return runtimeValid(t.valid, enc(t.value), String(t.depth ?? 64));
        if (t?.ctor) return t.args.length ? `(${nameOf(t.ctor)} ${t.args.map(enc).join(' ')})` : nameOf(t.ctor);
        if (t?.op) {
          const a = enc(t.left);
          if (t.op === 'not') return `(not ${a})`;
          const b = enc(t.right);
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
          const [a, b, n] = t.args.map(enc);
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
      const assertions = [...symbolNames].map(([n, v]) => valid(variables[n], v)).concat(conditions.map(c => encode(c)));
      if (contextMode !== 'query') sharedCheckId = checkId;
      const preamble = preambles.select(requiredSorts, runtimeRequired, options.smtPreambleProjection === true);
      trace?.preamble(preamble, preambles.full);
      const script = preamble.text + declarations + '\n' + graphDeclarations.join('\n') + '\n' + handles + '\n' + graphAssertions.join('\n') + '\n' + assertions.map(s => `(assert ${s})`).join('\n');
      trace?.phase('parse');
      solver.fromString(script);
      trace?.phase('handles');
      // Own these handles explicitly. The wrapper's AstVector/Model finalizers
      // can otherwise release them during a later asynchronous check().
      vector = Z3.solver_get_assertions(c, solver.ptr);
      Z3.ast_vector_inc_ref(c, vector);
      const symbols = new Map([...symbolNames.keys()].map((n, i) => [n, Z3.get_app_arg(c, Z3.to_app(c, Z3.ast_vector_get(c, vector, i)), 0)]));
      trace?.phase('check');
      const status = String(await solver.check());
      trace?.phase('other');
      trace?.checked(status);
      outcome = status === 'sat' || status === 'unsat' ? status : 'unknown';
      checkCancelled(options.signal);
      if (status !== 'sat') return {
        status: status === 'unsat' ? 'unsat' : 'unknown',
        reason: status === 'unsat' ? 'Contradictory constructor/arithmetic/Boolean/string constraints' : 'Z3 returned unknown (possibly timeout)'
      };
      if (!witness) return {
        status: 'sat'
      };
      const readWitness = () => {
        trace?.phase('decode');
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
            return [n, value];
          }));
          trace?.phase('validate');
          validateWitness({ terms, conditions, variables, witness }, bindings);
          trace?.phase('other');
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
      if (options.numericPreferenceRefutation !== false) {
        trace?.phase('preferenceRefute');
        const refuted = refutesNumericPreference(conditions, preferred.map(([name]) => name));
        trace?.refutation(refuted);
        trace?.phase('other');
        checkCancelled(options.signal);
        if (refuted) return original;
      }
      trace?.phase('preferenceSetup');
      solver.push();
      try {
        const one = Z3.mk_numeral(c, '1', Z3.mk_int_sort(c));
        Z3.inc_ref(c, one);
        try {
          preferred.forEach(([, x]) => Z3.solver_assert(c, solver.ptr, Z3.mk_eq(c, x, one)));
        } finally {
          Z3.dec_ref(c, one);
        }
        trace?.phase('preferenceCheck');
        const preferredStatus = String(await solver.check());
        trace?.phase('other');
        trace?.checked(preferredStatus, true);
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
      outcome = error.code === 'cancelled' ? 'cancelled' : 'unknown';
      if (error.code === 'cancelled') throw error;
      return {
        status: 'unknown',
        reason: error.message,
        diagnostic: diagnostic(error, 'solver')
      };
    } finally {
      trace?.phase('cleanup');
      try {
        try { if (vector !== null) Z3.ast_vector_dec_ref(c, vector); }
        finally { solver.release(); }
      } catch (error) {
        outcome = 'error';
        throw error;
      } finally { trace?.finish(outcome); }
    }
  };
  const backend = contextMode === 'query' ? query => runOwnedQuery(Z3, () => execute(query)) : execute;
  const validateCached = profiler ? (query, bindings) => profiler.validateCached(validateWitness, query, bindings) : validateWitness;
  const solve = withSolverQueryCache(backend, validateCached, options);
  Object.defineProperty(solve, 'solverProfile', { get: () => profiler?.snapshot() });
  return solve;
}
