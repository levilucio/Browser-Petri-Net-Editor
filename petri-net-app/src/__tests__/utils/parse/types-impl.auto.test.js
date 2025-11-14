import { autoAnnotateTypes } from '../../../utils/parse/types-impl';

describe('autoAnnotateTypes basics', () => {
  test('adds default type for unknown lowercase vars and preserves typed vars', () => {
    const map = new Map([['x', 'Int']]);
    const out = autoAnnotateTypes('x + y and true', map, 'Int');
    expect(out).toContain('x:Int');
    expect(out).toContain('y:Int');
    expect(out).toContain('true');
  });

  test('overwrites existing annotations when requested', () => {
    const map = new Map([['x', 'Int']]);
    const out = autoAnnotateTypes('x:Int + x', map, null, { overwrite: true });
    expect(out).toBe('x:Int + x:Int');
  });
});


