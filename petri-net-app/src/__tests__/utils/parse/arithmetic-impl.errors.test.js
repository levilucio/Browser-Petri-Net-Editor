import { parseArithmetic } from '../../../utils/parse/arithmetic-impl';

describe('parseArithmetic errors', () => {
  test('throws on uppercase variable start', () => {
    expect(() => parseArithmetic('X + 1')).toThrow(/start with lowercase/);
  });

  test('throws on unexpected character', () => {
    expect(() => parseArithmetic('@'))
      .toThrow(/Unexpected character/);
  });
});


