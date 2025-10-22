import { parseBooleanExpr } from '../../../utils/z3/eval-bool';

describe('eval-bool invalid inputs', () => {
  test('unexpected end throws', () => {
    expect(() => parseBooleanExpr('(')).toThrow();
  });

  test('unknown token after parse throws', () => {
    expect(() => parseBooleanExpr('true X')).toThrow();
  });
});


