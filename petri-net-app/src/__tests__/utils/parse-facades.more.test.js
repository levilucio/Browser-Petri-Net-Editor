import { parseArithmetic } from '../../utils/arith-parser';

describe('parseArithmetic simple literals', () => {
  test('parses int and string literal', () => {
    expect(parseArithmetic('42')).toEqual({ type: 'int', value: 42 });
    expect(parseArithmetic("'x'")).toEqual({ type: 'string', value: 'x' });
  });
});


