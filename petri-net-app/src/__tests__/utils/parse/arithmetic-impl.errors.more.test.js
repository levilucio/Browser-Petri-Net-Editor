import { parseArithmetic } from '../../../utils/parse/arithmetic-impl';

describe('parseArithmetic more errors', () => {
  test('unterminated string literal', () => {
    expect(() => parseArithmetic("'abc")).toThrow(/Unterminated string literal/);
  });

  test('bad list separators and terminators', () => {
    expect(() => parseArithmetic('[1 2]')).toThrow(/Expected ',' or '\]'/);
    expect(() => parseArithmetic('[1,2')).toThrow(/Expected ',' or '\]'/);
  });

  test('function call missing closing paren', () => {
    expect(() => parseArithmetic('f(1, 2')).toThrow(/Expected '\)' after function arguments/);
  });

  test('unexpected character', () => {
    expect(() => parseArithmetic('@1')).toThrow(/Unexpected character/);
  });
});


