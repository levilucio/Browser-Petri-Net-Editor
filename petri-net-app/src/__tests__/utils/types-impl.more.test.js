import { capitalizeTypeNames, inferTokenType, autoAnnotateTypes } from '../../utils/parse/types-impl';

describe('types-impl light coverage', () => {
  test('capitalizeTypeNames upgrades primitive suffixes', () => {
    expect(capitalizeTypeNames('x:int y:bool z:pair s:string l:list')).toBe('x:Int y:Bool z:Pair s:String l:List');
  });

  test('inferTokenType returns correct types', () => {
    expect(inferTokenType(1)).toBe('Int');
    expect(inferTokenType(true)).toBe('Bool');
    expect(inferTokenType('a')).toBe('String');
    expect(inferTokenType([1])).toBe('List');
    expect(inferTokenType({ __pair__: true, fst: 1, snd: 2 })).toBe('Pair');
  });

  test('autoAnnotateTypes annotates untyped vars', () => {
    const typeMap = new Map([['x', 'Int'], ['s', 'String']]);
    expect(autoAnnotateTypes('x + y and true', typeMap, 'Int')).toContain('x:Int');
    expect(autoAnnotateTypes('concat(s, s2)', typeMap, 'String')).toContain('s:String');
  });
});


