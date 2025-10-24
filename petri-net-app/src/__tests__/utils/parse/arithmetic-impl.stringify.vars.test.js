import { stringifyArithmetic } from '../../../utils/parse/arithmetic-impl';

describe('stringifyArithmetic vars and annotations', () => {
  test('variable without and with annotation', () => {
    expect(stringifyArithmetic({ type: 'var', name: 'x' })).toBe('x');
    expect(stringifyArithmetic({ type: 'var', name: 'x', varType: 'int' })).toBe('x:int');
  });
});


