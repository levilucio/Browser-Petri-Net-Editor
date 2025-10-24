import { autoAnnotateTypes } from '../../../utils/parse/types-impl';

describe('types-impl annotations errors', () => {
  test('invalid explicit type annotation is preserved but defaults applied to others', () => {
    const env = new Map();
    const out = autoAnnotateTypes('x:Int y:Foo z', env, 'Int');
    expect(out).toContain('x:Int');
    // Unknown type word stays as-is per current logic; ensure default applied to z
    expect(out).toContain('y:Foo');
    expect(out).toContain('z:Int');
  });
});


