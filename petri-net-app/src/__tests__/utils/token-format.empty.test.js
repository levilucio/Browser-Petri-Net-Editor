import { formatToken, formatTokensList } from '../../utils/token-format';

describe('token-format empty/misc', () => {
  test('formatTokensList empty yields empty string', () => {
    expect(formatTokensList([])).toBe('');
  });

  test("formatToken('') prints quoted empty string", () => {
    expect(formatToken('')).toBe("''");
  });
});


