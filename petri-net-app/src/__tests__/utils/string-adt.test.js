import { parseArithmetic, stringifyArithmetic } from '../../utils/arith-parser';

describe('String ADT Support', () => {
  describe('String Literal Parsing', () => {
    test('parses simple string literal', () => {
      const ast = parseArithmetic("'hello'");
      expect(ast.type).toBe('string');
      expect(ast.value).toBe('hello');
    });

    test('parses string literal with spaces', () => {
      const ast = parseArithmetic("'hello world'");
      expect(ast.type).toBe('string');
      expect(ast.value).toBe('hello world');
    });

    test('parses empty string', () => {
      const ast = parseArithmetic("''");
      expect(ast.type).toBe('string');
      expect(ast.value).toBe('');
    });

    test('handles escaped single quotes', () => {
      const ast = parseArithmetic("'it\\'s working'");
      expect(ast.type).toBe('string');
      expect(ast.value).toBe("it's working");
    });

    test('handles escape sequences', () => {
      const ast = parseArithmetic("'line1\\nline2'");
      expect(ast.type).toBe('string');
      expect(ast.value).toBe('line1\nline2');
    });
  });

  describe('String Function Parsing', () => {
    test('parses concat function with two string literals', () => {
      const ast = parseArithmetic("concat('hello', ' world')");
      expect(ast.type).toBe('funcall');
      expect(ast.name).toBe('concat');
      expect(ast.args).toHaveLength(2);
      expect(ast.args[0].type).toBe('string');
      expect(ast.args[0].value).toBe('hello');
      expect(ast.args[1].type).toBe('string');
      expect(ast.args[1].value).toBe(' world');
    });

    test('parses concat function with variables', () => {
      const ast = parseArithmetic("concat(x:string, y:string)");
      expect(ast.type).toBe('funcall');
      expect(ast.name).toBe('concat');
      expect(ast.args).toHaveLength(2);
      expect(ast.args[0].type).toBe('var');
      expect(ast.args[0].name).toBe('x');
      expect(ast.args[0].varType).toBe('string');
      expect(ast.args[1].type).toBe('var');
      expect(ast.args[1].name).toBe('y');
      expect(ast.args[1].varType).toBe('string');
    });

    test('parses substring function', () => {
      const ast = parseArithmetic("substring('hello world', 0, 5)");
      expect(ast.type).toBe('funcall');
      expect(ast.name).toBe('substring');
      expect(ast.args).toHaveLength(3);
      expect(ast.args[0].type).toBe('string');
      expect(ast.args[0].value).toBe('hello world');
      expect(ast.args[1].type).toBe('int');
      expect(ast.args[1].value).toBe(0);
      expect(ast.args[2].type).toBe('int');
      expect(ast.args[2].value).toBe(5);
    });

    test('parses length function', () => {
      const ast = parseArithmetic("length('hello')");
      expect(ast.type).toBe('funcall');
      expect(ast.name).toBe('length');
      expect(ast.args).toHaveLength(1);
      expect(ast.args[0].type).toBe('string');
      expect(ast.args[0].value).toBe('hello');
    });

    test('parses nested concat calls', () => {
      const ast = parseArithmetic("concat(concat('a', 'b'), 'c')");
      expect(ast.type).toBe('funcall');
      expect(ast.name).toBe('concat');
      expect(ast.args[0].type).toBe('funcall');
      expect(ast.args[0].name).toBe('concat');
    });
  });

  describe('String Stringify', () => {
    test('stringify string literal', () => {
      const ast = { type: 'string', value: 'hello' };
      expect(stringifyArithmetic(ast)).toBe("'hello'");
    });

    test('stringify string with escaped quote', () => {
      const ast = { type: 'string', value: "it's" };
      expect(stringifyArithmetic(ast)).toBe("'it\\'s'");
    });

    test('stringify concat function', () => {
      const ast = {
        type: 'funcall',
        name: 'concat',
        args: [
          { type: 'string', value: 'hello' },
          { type: 'string', value: ' world' }
        ]
      };
      expect(stringifyArithmetic(ast)).toBe("concat('hello', ' world')");
    });

    test('stringify substring function', () => {
      const ast = {
        type: 'funcall',
        name: 'substring',
        args: [
          { type: 'var', name: 's', varType: 'string' },
          { type: 'int', value: 0 },
          { type: 'int', value: 5 }
        ]
      };
      expect(stringifyArithmetic(ast)).toBe("substring(s:string, 0, 5)");
    });
  });

  describe('String Variables', () => {
    test('parses string variable with type annotation', () => {
      const ast = parseArithmetic("x:string");
      expect(ast.type).toBe('var');
      expect(ast.name).toBe('x');
      expect(ast.varType).toBe('string');
    });

    test('parses concat with mixed literals and variables', () => {
      const ast = parseArithmetic("concat('Hello, ', name:string)");
      expect(ast.type).toBe('funcall');
      expect(ast.name).toBe('concat');
      expect(ast.args[0].type).toBe('string');
      expect(ast.args[0].value).toBe('Hello, ');
      expect(ast.args[1].type).toBe('var');
      expect(ast.args[1].name).toBe('name');
      expect(ast.args[1].varType).toBe('string');
    });
  });
});


