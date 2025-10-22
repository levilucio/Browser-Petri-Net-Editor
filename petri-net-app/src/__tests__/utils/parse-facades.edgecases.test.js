import { parseArithmetic } from '../../utils/arith-parser';

describe('parseArithmetic edge cases', () => {
  test('whitespace-only and invalid input handling', () => {
    expect(() => parseArithmetic('(')).toThrow();
    expect(() => parseArithmetic(')')).toThrow();
  });
});


