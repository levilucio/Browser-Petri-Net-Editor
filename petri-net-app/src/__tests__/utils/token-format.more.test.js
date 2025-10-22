import { formatToken, formatTokensList } from '../../utils/token-format';

describe('token-format more cases', () => {
  test('nested pair formatting', () => {
    const nestedLeft = { fst: 1, snd: 2 };
    const pair = { __pair__: true, fst: nestedLeft, snd: { __pair__: true, fst: 'a', snd: true } };
    expect(formatToken(pair)).toBe("((1, 2), ('a', T))");
  });

  test('list of mixed tokens', () => {
    const list = [1, 's', false, { __pair__: true, fst: 2, snd: 3 }];
    expect(formatTokensList(list)).toBe("1, 's', F, (2, 3)");
  });
});


