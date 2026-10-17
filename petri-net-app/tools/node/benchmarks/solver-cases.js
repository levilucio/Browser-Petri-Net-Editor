import { parseSymbolicSource } from '../../../src/satel/core/SymbolicSource.js';
import { prepareAlgebra } from '../../../src/satel/core/GenericSubuniformity.js';
const v = name => ({ var: name });
const c = (ctor, ...args) => ({ ctor, args });
const op = (op, left, right) => ({ op, left, right });
export function allocation({ size, kind = 'linear', unsat = false }) {
  const variables = {}, conditions = [], terms = [];
  for (let i = 0; i < size; i++) {
    variables[`q${i}`] = 'Int'; const x = v(`q${i}`); terms.push(x);
    conditions.push(op('>=', x, 1), op('<=', x, kind === 'slots' ? size - Number(unsat) : 100));
    if (kind === 'linear') {
      variables[`t${i}`] = 'Int';
      conditions.push(op('==', v(`t${i}`), i ? op('+', v(`t${i - 1}`), x) : x));
      // Coupled neighboring resource policies; all-10 is a planted witness.
      if (i) conditions.push(op('>=', op('+', x, v(`q${i - 1}`)), 12), op('<=', op('+', op('*', 2, x), v(`q${i - 1}`)), 40));
    }
  }
  if (kind === 'linear') conditions.push(op('==', v(`t${size - 1}`), size * 10));
  else for (let i = 0; i < size; i++) for (let j = 0; j < i; j++) conditions.push(op('!=', v(`q${i}`), v(`q${j}`)));
  return { algebra: parseSymbolicSource(''), variables, conditions, terms };
}
export const invoiceAlgebra = () => prepareAlgebra(parseSymbolicSource(`constructor Line(Int, Int): Line
constructor End(): Lines
constructor More(Line, Lines): Lines
operation total(Lines): Int
rule total.end(): total(End()) = 0
rule total.more(q: Int, price: Int, rest: Lines): total(More(Line(q, price), rest)) = q * price + total(rest)`));
export function invoice({ size, nonlinear = false }) {
  const variables = {}, conditions = [];
  let lines = c('End');
  for (let i = size - 1; i >= 0; i--) {
    variables[`q${i}`] = 'Int'; conditions.push(op('>=', v(`q${i}`), 1), op('<=', v(`q${i}`), 5));
    const price = nonlinear ? v(`p${i}`) : 10;
    if (nonlinear) { variables[`p${i}`] = 'Int'; conditions.push(op('>=', price, 5), op('<=', price, 15)); }
    lines = c('More', c('Line', v(`q${i}`), price), lines);
  }
  conditions.push(op('==', { call: 'total', args: [lines] }, 30 * size));
  return { algebra: invoiceAlgebra(), variables, conditions, maxDepth: 32 };
}
export function decomposition({ kind, depth }) {
  const source = kind === 'list' ? `constructor End(): Lines
constructor More(Int, Lines): Lines
operation total(Lines): Int
rule total.end(): total(End()) = 0
rule total.more(x: Int, xs: Lines): total(More(x, xs)) = x + total(xs)` : `constructor Leaf(Int): Tree
constructor Fork(Tree, Tree): Tree
operation total(Tree): Int
rule total.leaf(x: Int): total(Leaf(x)) = x
rule total.fork(a: Tree, b: Tree): total(Fork(a, b)) = total(a) + total(b)`;
  return { algebra: prepareAlgebra(parseSymbolicSource(source)), variables: { data: kind === 'list' ? 'Lines' : 'Tree' }, operation: 'total', args: [v('data')], conditions: [], maxDepth: depth };
}
