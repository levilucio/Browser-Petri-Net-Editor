import { getContext } from '../../utils/z3/context.js';
import { evaluateGround, substitute, variablesIn, termSort } from './SymbolicTerms.js';

let serial = 0;
/** Reuses the simulator's Z3 initialization; never uses its synthesized-model fallback. */
export async function createSymbolicSolver(algebra, options = {}) {
  const { ctx } = await getContext();
  const prefix = `satel${++serial}_`;
  const names = [...new Set(Object.values(algebra.constructors).map(c => c.result))];
  const declarations = Object.fromEntries(names.map(n => [n, ctx.Datatype(prefix + n)]));
  const sorts = { Nat: ctx.Int.sort(), Int: ctx.Int.sort(), Bool: ctx.Bool.sort() };
  const constructors = {}, constructorNames = new Map();
  for (const [name, c] of Object.entries(algebra.constructors)) {
    declarations[c.result].declare(prefix + name, ...c.parameters.map((s, i) => [prefix + name + '_' + i, sorts[s] || declarations[s]]));
  }
  if (names.length) ctx.Datatype.createDatatypes(...names.map(n => declarations[n])).forEach((s, i) => { sorts[names[i]] = s; });
  const bySort = Object.fromEntries(names.map(n => [n, Object.entries(algebra.constructors).filter(([, c]) => c.result === n)]));
  for (const n of names) bySort[n].forEach(([name], i) => {
    constructors[name] = sorts[n].constructorDecl(i); constructorNames.set(String(constructors[name].name()), name);
  });
  // Nat is represented by Int with a nonnegative invariant, including Nat fields
  // inside arbitrary recursive constructor values. No finite term-depth bound.
  const wellFormed = Object.fromEntries(names.map(n => [n, ctx.RecFunc.declare(prefix + 'valid_' + n, sorts[n], ctx.Bool.sort())]));
  const valid = (s, value) => s === 'Nat' ? value.ge(0) : wellFormed[s] ? wellFormed[s].call(value) : ctx.Bool.val(true);
  for (const n of names) {
    const x = ctx.Const(prefix + 'value_' + n, sorts[n]);
    const alternatives = bySort[n].map(([, c], i) => ctx.And(sorts[n].recognizer(i).call(x),
      ...c.parameters.map((s, j) => valid(s, sorts[n].accessor(i, j).call(x)))));
    ctx.RecFunc.addDefinition(wellFormed[n], [x], ctx.Or(...alternatives));
  }
  let checkId = 0;
  return async function solve({ terms, conditions, variables, witness = true }) {
    const solver = new ctx.Solver();
    solver.set('timeout', options.timeoutMs ?? 3000);
    try {
      const symbols = new Map([...variablesIn([terms, conditions])].map(n => {
        if (!sorts[variables[n]]) throw new Error(`Unsupported residual sort: ${variables[n]}`);
        return [n, ctx.Const(`${prefix}${++checkId}_${n}`, sorts[variables[n]])];
      }));
      const encode = t => {
        if (typeof t === 'number') return ctx.Int.val(t);
        if (typeof t === 'boolean') return ctx.Bool.val(t);
        if (t?.var) return symbols.get(t.var);
        if (t?.ctor) return constructors[t.ctor].call(...t.args.map(encode));
        if (t?.op) {
          const a = encode(t.left), b = encode(t.right);
          switch (t.op) {
            case '+': return a.add(b); case '-': return a.sub(b);
            case '==': return a.eq(b); case '!=': return a.neq(b);
            case '<': return a.lt(b); case '<=': return a.le(b);
            case '>': return a.gt(b); case '>=': return a.ge(b);
          }
        }
        throw new Error('Residual operation must be unfolded before SMT solving');
      };
      for (const [n, x] of symbols) solver.add(valid(variables[n], x));
      conditions.forEach(c => solver.add(encode(c)));
      let status = String(await solver.check());
      if (status !== 'sat') return { status: status === 'unsat' ? 'unsat' : 'unknown', reason: status === 'unsat' ? 'Contradictory constructor/arithmetic constraints' : 'Z3 returned unknown (possibly timeout)' };
      if (!witness) return { status: 'sat' };
      // Stable small representatives where possible; this never defines a class.
      const preferred = [...symbols].filter(([n]) => ['Nat', 'Int'].includes(variables[n])).map(([, x]) => x.eq(1));
      if (preferred.length) {
        solver.push(); solver.add(...preferred);
        if (String(await solver.check()) !== 'sat') {
          solver.pop(); status = String(await solver.check());
          if (status !== 'sat') return { status: 'unknown', reason: 'Z3 could not restore a witness after preference checking' };
        }
      }
      const model = solver.model(); let remaining = 2000;
      const decode = value => {
        if (--remaining < 0) throw new Error('Witness is too large to display safely');
        if (ctx.isIntVal(value)) {
          const n = Number(value.asString());
          if (!Number.isSafeInteger(n)) throw new Error('Witness exceeds exact JavaScript integer range');
          return n;
        }
        if (ctx.isTrue(value)) return true;
        if (ctx.isFalse(value)) return false;
        const name = constructorNames.get(String(value.decl().name()));
        if (!name) throw new Error('Z3 returned a non-constructor witness');
        return { ctor: name, args: Array.from({ length: value.numArgs() }, (_, i) => decode(value.arg(i))) };
      };
      const bindings = new Map([...symbols].map(([n, x]) => {
        const value = decode(model.eval(x, true));
        if (termSort(value, {}, algebra, variables[n]) !== variables[n]) throw new Error('Independent witness sort check failed');
        return [n, value];
      }));
      if (!conditions.every(c => evaluateGround(substitute(c, bindings)) === true)) throw new Error('Independent witness constraint check failed');
      return { status: 'sat', bindings };
    } catch (error) {
      return { status: 'unknown', reason: error.message };
    } finally { solver.release(); }
  };
}
