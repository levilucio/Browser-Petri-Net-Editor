import { evaluateArithmeticWithBindings } from '../../../utils/z3/eval-arith';

describe('evaluateArithmeticWithBindings list ops (ground terms)', () => {
  function evalTerm(ast) {
    // evaluateArithmeticWithBindings expects AST-like nodes; reuse existing literal shape
    return evaluateArithmeticWithBindings(ast, {});
  }

  test('head/tail on list', () => {
    const list = { type: 'list', elements: [ { type: 'int', value: 1 }, { type: 'int', value: 2 }, { type: 'int', value: 3 } ] };
    // emulate head(list) and tail(list) evaluation paths
    const headRes = evaluateArithmeticWithBindings({ type: 'funcall', name: 'head', args: [list] }, {});
    const tailRes = evaluateArithmeticWithBindings({ type: 'funcall', name: 'tail', args: [list] }, {});
    expect(headRes).toEqual(1);
    expect(tailRes).toEqual([2,3]);
  });

  test('append (element) and sublist', () => {
    const l1 = { type: 'list', elements: [ { type: 'int', value: 1 } ] };
    const l2 = { type: 'list', elements: [ { type: 'int', value: 2 }, { type: 'int', value: 3 } ] };
    const appended = evaluateArithmeticWithBindings({ type: 'funcall', name: 'append', args: [l1, l2] }, {});
    // current semantics: append adds one element (which may itself be a list)
    expect(appended).toEqual([1, [2,3]]);
    const sub = evaluateArithmeticWithBindings({ type: 'funcall', name: 'sublist', args: [ { type: 'list', elements: [ { type: 'int', value: 1 }, { type: 'int', value: 2 }, { type: 'int', value: 3 } ] }, { type: 'int', value: 1 }, { type: 'int', value: 2 } ] }, {});
    expect(sub).toEqual([2,3]);
  });

  test('isSublistOf true/false', () => {
    const a = { type: 'list', elements: [ { type: 'int', value: 2 }, { type: 'int', value: 3 } ] };
    const b = { type: 'list', elements: [ { type: 'int', value: 1 }, { type: 'int', value: 2 }, { type: 'int', value: 3 } ] };
    const c = { type: 'list', elements: [ { type: 'int', value: 3 }, { type: 'int', value: 4 } ] };
    const t = evaluateArithmeticWithBindings({ type: 'funcall', name: 'isSublistOf', args: [a, b] }, {});
    const f = evaluateArithmeticWithBindings({ type: 'funcall', name: 'isSublistOf', args: [c, b] }, {});
    expect(t).toBe(true);
    expect(f).toBe(false);
  });
});


