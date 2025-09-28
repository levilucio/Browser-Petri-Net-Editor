import { AlgebraicSimulator } from '../../features/simulation/algebraic-simulator';
import { parsePattern, matchPattern, validatePatternTyping, addTypeAnnotations, stringifyPattern } from '../../utils/arith-parser';

describe('Pattern Deconstruction', () => {
  test('pattern parsing and matching works for (F,x) pattern', () => {
    const pattern = parsePattern('(F,x:integer)');
    expect(pattern.type).toBe('pairPattern');
    expect(pattern.fst.type).toBe('boolLit');
    expect(pattern.fst.value).toBe(false);
    expect(pattern.snd.type).toBe('var');
    expect(pattern.snd.name).toBe('x');
    expect(pattern.snd.varType).toBe('integer');
  });

  test('pattern matching extracts correct bindings', () => {
    const pattern = parsePattern('(F,x:integer)');
    const token = { __pair__: true, fst: false, snd: 1 };
    const bindings = matchPattern(pattern, token);
    expect(bindings).toEqual({ x: 1 });
  });

  test('pattern matching fails for wrong types', () => {
    const pattern = parsePattern('(F,x:integer)');
    const token = { __pair__: true, fst: false, snd: true }; // snd is boolean, not integer
    const bindings = matchPattern(pattern, token);
    expect(bindings).toBeNull();
  });

  test('pattern matching fails for wrong structure', () => {
    const pattern = parsePattern('(F,x:integer)');
    const token = { __pair__: true, fst: true, snd: 1 }; // fst is true, not false
    const bindings = matchPattern(pattern, token);
    expect(bindings).toBeNull();
  });

  test('variable typing validation enforces type annotations', () => {
    const pattern = parsePattern('(F,x)'); // x is not typed
    const error = validatePatternTyping(pattern);
    expect(error).toContain("Variable 'x' must be typed");
  });

  test('auto-type annotation adds default types', () => {
    const pattern = parsePattern('(F,x)');
    const typedPattern = addTypeAnnotations(pattern, 'integer');
    expect(typedPattern.snd.varType).toBe('integer');
  });

  test('stringify pattern preserves type annotations', () => {
    const pattern = parsePattern('(F,x:integer)');
    const str = stringifyPattern(pattern);
    expect(str).toBe('(F, x:integer)');
  });

  test('algebraic simulator enables transition with pattern deconstruction', async () => {
    const net = {
      places: [
        { id: 'p1', label: 'P1', x: 0, y: 0, valueTokens: [{ __pair__: true, fst: false, snd: 1 }] },
        { id: 'p2', label: 'P2', x: 0, y: 0, valueTokens: [] },
      ],
      transitions: [
        { id: 't1', label: 'T1', x: 0, y: 0, guard: 'x >= 1' },
      ],
      arcs: [
        { id: 'a1', sourceId: 'p1', targetId: 't1', sourceType: 'place', targetType: 'transition', bindings: ['(F,x:integer)'] },
        { id: 'a2', sourceId: 't1', targetId: 'p2', sourceType: 'transition', targetType: 'place', bindings: ['x+2'] },
      ],
      netMode: 'algebraic-int'
    };

    const sim = new AlgebraicSimulator();
    await sim.initialize(net, { simulationMode: 'single' });

    const enabledBefore = await sim.getEnabledTransitions();
    expect(enabledBefore).toContain('t1');

    const after = await sim.fireTransition('t1');
    const p1 = after.places.find(p => p.id === 'p1');
    const p2 = after.places.find(p => p.id === 'p2');
    expect(p1.tokens).toBe(0); // Token consumed
    expect(p2.valueTokens).toEqual([3]); // x+2 where x=1
  }, 15000);

  test('algebraic simulator handles multiple pattern bindings', async () => {
    const net = {
      places: [
        { id: 'p1', label: 'P1', x: 0, y: 0, valueTokens: [
          { __pair__: true, fst: false, snd: 1 },
          { __pair__: true, fst: true, snd: 2 }
        ] },
        { id: 'p2', label: 'P2', x: 0, y: 0, valueTokens: [] },
      ],
      transitions: [
        { id: 't1', label: 'T1', x: 0, y: 0, guard: 'T' },
      ],
      arcs: [
        { id: 'a1', sourceId: 'p1', targetId: 't1', sourceType: 'place', targetType: 'transition', bindings: ['(F,x:integer)', '(T,y:integer)'] },
        { id: 'a2', sourceId: 't1', targetId: 'p2', sourceType: 'transition', targetType: 'place', bindings: ['x+y'] },
      ],
      netMode: 'algebraic-int'
    };

    const sim = new AlgebraicSimulator();
    await sim.initialize(net, { simulationMode: 'single' });

    const enabledBefore = await sim.getEnabledTransitions();
    expect(enabledBefore).toContain('t1');

    const after = await sim.fireTransition('t1');
    const p1 = after.places.find(p => p.id === 'p1');
    const p2 = after.places.find(p => p.id === 'p2');
    expect(p1.tokens).toBe(0); // Both tokens consumed
    expect(p2.valueTokens).toEqual([3]); // x+y where x=1, y=2
  }, 15000);
});
