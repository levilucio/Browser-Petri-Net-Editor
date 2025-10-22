import { getArcSourceType, getArcTargetType, normalizeArc } from '../../utils/arcTypes';

describe('arcTypes', () => {
  test('infers source/target types from arc.type when not provided', () => {
    expect(getArcSourceType({ type: 'place-to-transition' })).toBe('place');
    expect(getArcTargetType({ type: 'place-to-transition' })).toBe('transition');
    expect(getArcSourceType({ type: 'transition-to-place' })).toBe('transition');
    expect(getArcTargetType({ type: 'transition-to-place' })).toBe('place');
  });

  test('normalizeArc fills sourceType/targetType and preserves id', () => {
    const arc = { id: 'a1', type: 'place-to-transition', source: 'p1', target: 't1' };
    const norm = normalizeArc(arc);
    expect(norm).toEqual({ ...arc, sourceType: 'place', targetType: 'transition', type: 'place-to-transition' });
    expect(arc).not.toBe(norm);
  });
});


