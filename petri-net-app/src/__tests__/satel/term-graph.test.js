/** @jest-environment node */
import { packTermGraph, termSize } from '../../domain/algebra/TermGraph.js';
import { evaluateGround, substitute, variablesIn, termSort, elaborateTerm } from '../../satel/core/SymbolicTerms.js';
import { foldGroundTerms } from '../../satel/core/GroundTerms.js';
import { parseSymbolicSource } from '../../satel/core/SymbolicSource.js';
import { createSymbolicSolver } from '../../satel/core/SymbolicZ3.js';
import { getContext } from '../../utils/z3/context.js';

jest.setTimeout(60000);
const algebra = parseSymbolicSource(''), v = name => ({ var: name });
const op = (name, left, right) => ({ op: name, left, right });
const repeated = depth => {
  let term = op('>', v('n'), 4);
  for (let i = 0; i < depth; i++) term = op('and', term, term);
  return term;
};

test('an exponentially expanded expression stays small through JSON, substitution and elaboration', () => {
  const source = repeated(24), packed = JSON.parse(JSON.stringify(packTermGraph(source)));
  expect(termSize(source)).toBeGreaterThan(1000000);
  expect(termSize(packed)).toBeLessThan(400);
  expect(variablesIn(packed)).toEqual(new Set(['n']));
  expect(termSort(packed, { n: 'Int' }, algebra)).toBe('Bool');
  expect(elaborateTerm(packed, { n: 'Int' }, algebra, 'Bool')).toBe(packed);
  const yes = substitute(packed, new Map([['n', 5]])), no = substitute(packed, new Map([['n', 0]]));
  expect(termSize(yes)).toBeLessThan(400);
  expect(variablesIn(yes).size).toBe(0);
  expect(evaluateGround(foldGroundTerms(yes, algebra))).toBe(true);
  expect(evaluateGround(no)).toBe(false);
  expect(variablesIn(packed)).toEqual(new Set(['n']));
});

test('SMT serialization stays compact and the original data variable is shared across graph scopes', async () => {
  const { ctx } = await getContext(), solve = await createSymbolicSolver(algebra);
  const original = ctx.Solver.prototype.fromString, inputs = [];
  const spy = jest.spyOn(ctx.Solver.prototype, 'fromString').mockImplementation(function (text) {
    inputs.push(text); return original.call(this, text);
  });
  try {
    const result = await solve({ terms: [v('n')], conditions: [packTermGraph(repeated(24))], variables: { n: 'Int' } });
    expect(result.status).toBe('sat'); expect(result.bindings.get('n')).toBeGreaterThan(4);
    expect([...result.bindings.keys()]).toEqual(['n']);
    expect(inputs[0].length).toBeLessThan(20000);
    const contrary = [1, 2].map(n => packTermGraph(op('==', v('n'), n)));
    expect((await solve({ terms: [v('n')], conditions: contrary, variables: { n: 'Int' } })).status).toBe('unsat');
  } finally { spy.mockRestore(); }
});

test('shared partial selectors are evaluated only in reached branches', async () => {
  const bad = { field: '_AnyInt', index: 0, value: { ctor: '_AnyBool', args: [true] } };
  const term = packTermGraph(op('or', v('skip'), op('and', op('==', bad, 1), op('==', bad, 2))));
  expect(termSort(term, { skip: 'Bool' }, algebra)).toBe('Bool');
  expect(evaluateGround(substitute(term, new Map([['skip', true]])))).toBe(true);
  expect(() => evaluateGround(substitute(term, new Map([['skip', false]])))).toThrow(/outside its matching branch/);
  const solve = await createSymbolicSolver(algebra);
  expect((await solve({ terms: [v('skip')], conditions: [term, v('skip')], variables: { skip: 'Bool' } })).status).toBe('sat');
});

test('graph references cannot escape their scope or form cycles', async () => {
  expect(() => evaluateGround({ graphRef: 0 })).toThrow(/scope/);
  const cyclic = { termGraph: [op('==', { graphRef: 0 }, 1)] };
  expect(() => termSort(cyclic, {}, algebra)).toThrow(/reference/);
  expect(() => evaluateGround(cyclic)).toThrow(/reference/);
  const solve = await createSymbolicSolver(algebra);
  expect((await solve({ terms: [], conditions: [cyclic], variables: {} })).status).toBe('unknown');
  const source = op('and', true, null); source.right = source;
  expect(() => packTermGraph(source)).toThrow(/Cyclic/);
});
