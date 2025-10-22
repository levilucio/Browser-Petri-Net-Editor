import { parseBooleanExpr, evaluateBooleanWithBindings } from '../../../utils/z3/eval-bool';

describe('eval-bool more operators', () => {
  test('xor and implies', () => {
    const ast = parseBooleanExpr('T xor F and (F -> T)');
    const result = evaluateBooleanWithBindings(ast, {});
    expect(result).toBe(true);
  });

  test('iff equivalence true', () => {
    const ast = parseBooleanExpr('(x == 3) <-> (3 == x)');
    const result = evaluateBooleanWithBindings(ast, { x: 3 });
    expect(result).toBe(true);
  });

  test('mixed words/symbols precedence', () => {
    const ast = parseBooleanExpr('x<y and (y<3 || z==30)');
    const result = evaluateBooleanWithBindings(ast, { x: 3, y: 4, z: 30 });
    expect(result).toBe(true);
  });
});


