import { parseArithmetic, stringifyArithmetic, inferTokenType } from '../../utils/arith-parser.js';
import { evaluateArithmeticWithBindings } from '../../utils/z3-arith.js';

describe('List ADT Support', () => {
  describe('List Literal Parsing', () => {
    test('parses empty list', () => {
      const ast = parseArithmetic('[]');
      expect(ast).toEqual({ type: 'list', elements: [] });
    });

    test('parses list with single element', () => {
      const ast = parseArithmetic('[1]');
      expect(ast).toEqual({
        type: 'list',
        elements: [{ type: 'int', value: 1 }],
      });
    });

    test('parses list with multiple integers', () => {
      const ast = parseArithmetic('[1, 2, 3]');
      expect(ast).toEqual({
        type: 'list',
        elements: [
          { type: 'int', value: 1 },
          { type: 'int', value: 2 },
          { type: 'int', value: 3 },
        ],
      });
    });

    test('parses list with mixed types', () => {
      const ast = parseArithmetic("[1, 'hello', 2]");
      expect(ast).toEqual({
        type: 'list',
        elements: [
          { type: 'int', value: 1 },
          { type: 'string', value: 'hello' },
          { type: 'int', value: 2 },
        ],
      });
    });

    test('parses nested lists', () => {
      const ast = parseArithmetic('[[1, 2], [3, 4]]');
      expect(ast).toEqual({
        type: 'list',
        elements: [
          {
            type: 'list',
            elements: [
              { type: 'int', value: 1 },
              { type: 'int', value: 2 },
            ],
          },
          {
            type: 'list',
            elements: [
              { type: 'int', value: 3 },
              { type: 'int', value: 4 },
            ],
          },
        ],
      });
    });

    test('parses list with variables', () => {
      const ast = parseArithmetic('[x, y, z]');
      expect(ast).toEqual({
        type: 'list',
        elements: [
          { type: 'var', name: 'x' },
          { type: 'var', name: 'y' },
          { type: 'var', name: 'z' },
        ],
      });
    });
  });

  describe('List Function Parsing', () => {
    test('parses length function with list literal', () => {
      const ast = parseArithmetic('length([1, 2, 3])');
      expect(ast).toEqual({
        type: 'funcall',
        name: 'length',
        args: [
          {
            type: 'list',
            elements: [
              { type: 'int', value: 1 },
              { type: 'int', value: 2 },
              { type: 'int', value: 3 },
            ],
          },
        ],
      });
    });

    test('parses concat function with two list literals', () => {
      const ast = parseArithmetic('concat([1, 2], [3, 4])');
      expect(ast).toEqual({
        type: 'funcall',
        name: 'concat',
        args: [
          {
            type: 'list',
            elements: [
              { type: 'int', value: 1 },
              { type: 'int', value: 2 },
            ],
          },
          {
            type: 'list',
            elements: [
              { type: 'int', value: 3 },
              { type: 'int', value: 4 },
            ],
          },
        ],
      });
    });

    test('parses head function', () => {
      const ast = parseArithmetic('head([1, 2, 3])');
      expect(ast.type).toBe('funcall');
      expect(ast.name).toBe('head');
    });

    test('parses tail function', () => {
      const ast = parseArithmetic('tail([1, 2, 3])');
      expect(ast.type).toBe('funcall');
      expect(ast.name).toBe('tail');
    });

    test('parses append function', () => {
      const ast = parseArithmetic('append([1, 2], 3)');
      expect(ast).toEqual({
        type: 'funcall',
        name: 'append',
        args: [
          {
            type: 'list',
            elements: [
              { type: 'int', value: 1 },
              { type: 'int', value: 2 },
            ],
          },
          { type: 'int', value: 3 },
        ],
      });
    });

    test('parses sublist function', () => {
      const ast = parseArithmetic('sublist([1, 2, 3, 4], 1, 2)');
      expect(ast.type).toBe('funcall');
      expect(ast.name).toBe('sublist');
      expect(ast.args.length).toBe(3);
    });

    test('parses isSublistOf function', () => {
      const ast = parseArithmetic('isSublistOf([2, 3], [1, 2, 3, 4])');
      expect(ast.type).toBe('funcall');
      expect(ast.name).toBe('isSublistOf');
      expect(ast.args.length).toBe(2);
    });
  });

  describe('List Stringification', () => {
    test('stringifies empty list', () => {
      const ast = { type: 'list', elements: [] };
      expect(stringifyArithmetic(ast)).toBe('[]');
    });

    test('stringifies list with integers', () => {
      const ast = {
        type: 'list',
        elements: [
          { type: 'int', value: 1 },
          { type: 'int', value: 2 },
          { type: 'int', value: 3 },
        ],
      };
      expect(stringifyArithmetic(ast)).toBe('[1, 2, 3]');
    });

    test('stringifies nested lists', () => {
      const ast = {
        type: 'list',
        elements: [
          {
            type: 'list',
            elements: [{ type: 'int', value: 1 }],
          },
          {
            type: 'list',
            elements: [{ type: 'int', value: 2 }],
          },
        ],
      };
      expect(stringifyArithmetic(ast)).toBe('[[1], [2]]');
    });
  });

  describe('List Variable Type Annotations', () => {
    test('parses list variable with type annotation', () => {
      const ast = parseArithmetic('xs:list');
      expect(ast).toEqual({
        type: 'var',
        name: 'xs',
        varType: 'list',
      });
    });

    test('stringifies list variable with type annotation', () => {
      const ast = { type: 'var', name: 'xs', varType: 'list' };
      expect(stringifyArithmetic(ast)).toBe('xs:list');
    });
  });

  describe('List Evaluation with Bindings', () => {
    test('evaluates empty list literal', () => {
      const ast = parseArithmetic('[]');
      const result = evaluateArithmeticWithBindings(ast, {});
      expect(result).toEqual([]);
    });

    test('evaluates list literal with integers', () => {
      const ast = parseArithmetic('[1, 2, 3]');
      const result = evaluateArithmeticWithBindings(ast, {});
      expect(result).toEqual([1, 2, 3]);
    });

    test('evaluates list literal with variables', () => {
      const ast = parseArithmetic('[x, y, z]');
      const result = evaluateArithmeticWithBindings(ast, { x: 1, y: 2, z: 3 });
      expect(result).toEqual([1, 2, 3]);
    });

    test('evaluates length of list', () => {
      const ast = parseArithmetic('length([1, 2, 3])');
      const result = evaluateArithmeticWithBindings(ast, {});
      expect(result).toBe(3);
    });

    test('evaluates concat of two lists', () => {
      const ast = parseArithmetic('concat([1, 2], [3, 4])');
      const result = evaluateArithmeticWithBindings(ast, {});
      expect(result).toEqual([1, 2, 3, 4]);
    });

    test('evaluates head of list', () => {
      const ast = parseArithmetic('head([1, 2, 3])');
      const result = evaluateArithmeticWithBindings(ast, {});
      expect(result).toBe(1);
    });

    test('evaluates tail of list', () => {
      const ast = parseArithmetic('tail([1, 2, 3])');
      const result = evaluateArithmeticWithBindings(ast, {});
      expect(result).toEqual([2, 3]);
    });

    test('evaluates append to list', () => {
      const ast = parseArithmetic('append([1, 2], 3)');
      const result = evaluateArithmeticWithBindings(ast, {});
      expect(result).toEqual([1, 2, 3]);
    });

    test('evaluates sublist', () => {
      const ast = parseArithmetic('sublist([1, 2, 3, 4], 1, 2)');
      const result = evaluateArithmeticWithBindings(ast, {});
      expect(result).toEqual([2, 3]);
    });

    test('evaluates isSublistOf (true case)', () => {
      const ast = parseArithmetic('isSublistOf([2, 3], [1, 2, 3, 4])');
      const result = evaluateArithmeticWithBindings(ast, {});
      expect(result).toBe(true);
    });

    test('evaluates isSublistOf (false case)', () => {
      const ast = parseArithmetic('isSublistOf([2, 4], [1, 2, 3, 4])');
      const result = evaluateArithmeticWithBindings(ast, {});
      expect(result).toBe(false);
    });

    test('evaluates nested list operations', () => {
      const ast = parseArithmetic('length(concat([1, 2], [3]))');
      const result = evaluateArithmeticWithBindings(ast, {});
      expect(result).toBe(3);
    });
  });

  describe('Type Inference for Lists', () => {
    test('infers List type for array tokens', () => {
      expect(inferTokenType([1, 2, 3])).toBe('List');
      expect(inferTokenType([])).toBe('List');
      expect(inferTokenType(['a', 'b'])).toBe('List');
    });

    test('infers other types correctly', () => {
      expect(inferTokenType(5)).toBe('Int');
      expect(inferTokenType(true)).toBe('Bool');
      expect(inferTokenType('hello')).toBe('String');
    });
  });
});


