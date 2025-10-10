import { parseArithmetic as parseArithmeticFacade, stringifyArithmetic as stringifyArithmeticFacade } from '../../utils/parse/arithmetic.js';
import { parsePattern as parsePatternFacade, stringifyPattern as stringifyPatternFacade } from '../../utils/parse/pattern.js';
import { inferTokenType as inferTokenTypeFacade, inferVariableTypes as inferVariableTypesFacade, autoAnnotateTypes as autoAnnotateTypesFacade, capitalizeTypeNames as capitalizeTypeNamesFacade } from '../../utils/parse/types.js';

import { parseArithmetic as parseArithmeticCore, stringifyArithmetic as stringifyArithmeticCore, parsePattern as parsePatternCore, stringifyPattern as stringifyPatternCore, inferTokenType as inferTokenTypeCore, inferVariableTypes as inferVariableTypesCore, autoAnnotateTypes as autoAnnotateTypesCore, capitalizeTypeNames as capitalizeTypeNamesCore } from '../../utils/arith-parser.js';

describe('Parse facade modules', () => {
  test('arithmetic facade exports match core and parse simple int', () => {
    expect(typeof parseArithmeticFacade).toBe('function');
    expect(typeof stringifyArithmeticFacade).toBe('function');
    // Facades are re-exports; keep identity stable
    expect(parseArithmeticFacade).toBe(parseArithmeticCore);
    expect(stringifyArithmeticFacade).toBe(stringifyArithmeticCore);
    const ast = parseArithmeticFacade('42');
    expect(ast && typeof ast).toBe('object');
    expect(ast.type).toBe('int');
    expect(ast.value).toBe(42);
  });

  test('pattern facade exports match core and parse simple var', () => {
    expect(typeof parsePatternFacade).toBe('function');
    expect(typeof stringifyPatternFacade).toBe('function');
    expect(parsePatternFacade).toBe(parsePatternCore);
    expect(stringifyPatternFacade).toBe(stringifyPatternCore);
    const ast = parsePatternFacade('x:Int');
    expect(ast && typeof ast).toBe('object');
    expect(ast.type).toBeDefined();
  });

  test('types facade exports match core and infer types', () => {
    expect(inferTokenTypeFacade).toBe(inferTokenTypeCore);
    expect(inferVariableTypesFacade).toBe(inferVariableTypesCore);
    expect(autoAnnotateTypesFacade).toBe(autoAnnotateTypesCore);
    expect(capitalizeTypeNamesFacade).toBe(capitalizeTypeNamesCore);
    const inferred = inferTokenTypeFacade(123);
    expect(inferred).toBe('Int');
  });
});


