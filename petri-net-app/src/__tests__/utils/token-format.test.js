import { formatToken, formatTokensList } from '../../utils/token-format';

describe('token-format', () => {
  test('formats booleans as T/F', () => {
    expect(formatToken(true)).toBe('T');
    expect(formatToken(false)).toBe('F');
  });

  test('formats strings with single quotes', () => {
    expect(formatToken('abc')).toBe("'abc'");
    expect(formatToken('')).toBe("''");
  });

  test('formats numbers via String', () => {
    expect(formatToken(0)).toBe('0');
    expect(formatToken(42)).toBe('42');
  });

  test('formats pairs using (__pair__, fst, snd)', () => {
    const pairObj = { __pair__: true, fst: 1, snd: 3 };
    expect(formatToken(pairObj)).toBe('(1, 3)');
  });

  test('formats pairs using fst/snd without __pair__', () => {
    const pairObj = { fst: 'x', snd: true };
    expect(formatToken(pairObj)).toBe("('x', T)");
  });

  test('formats nested pairs and lists', () => {
    const nested = { __pair__: true, fst: [1, 2, 3], snd: { __pair__: true, fst: 'a', snd: false } };
    expect(formatToken(nested)).toBe("([1, 2, 3], ('a', F))");
  });

  test('formats lists recursively', () => {
    const list = [1, 'a', true, { __pair__: true, fst: 2, snd: 5 }];
    expect(formatToken(list)).toBe("[1, 'a', T, (2, 5)]");
  });

  test('formatTokensList joins by comma and space', () => {
    const tokens = [1, 'a', false];
    expect(formatTokensList(tokens)).toBe("[1, 'a', F]".slice(1, -1)); // remove []
  });

  test('formatTokensList returns empty string for empty/invalid', () => {
    expect(formatTokensList([])).toBe('');
    expect(formatTokensList(null)).toBe('');
  });
});


