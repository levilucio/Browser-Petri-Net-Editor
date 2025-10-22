import { getTokensForPlace, isPair } from '../../utils/token-utils';

describe('token-utils', () => {
  test('getTokensForPlace returns algebraic tokens when present', () => {
    const place = { valueTokens: [1, 2, 3] };
    expect(getTokensForPlace(place)).toEqual([1, 2, 3]);
  });

  test('getTokensForPlace falls back to numeric tokens', () => {
    const place = { tokens: 3 };
    expect(getTokensForPlace(place)).toEqual([1, 1, 1]);
  });

  test('isPair detects encoded pairs', () => {
    expect(isPair({ __pair__: true, fst: 1, snd: 2 })).toBe(true);
    expect(isPair({ fst: 1 })).toBe(false);
  });
});


