import { ConflictResolver } from '../../features/simulation/conflict-resolver';

const basePlaces = [
  { id: 'p1', tokens: 2 },
  { id: 'p2', tokens: 2 },
];

const buildArcs = () => ([
  { id: 'a1', sourceId: 'p1', targetId: 't1', sourceType: 'place', targetType: 'transition', type: 'place-to-transition', bindings: ['x:int'] },
  { id: 'a2', sourceId: 'p1', targetId: 't2', sourceType: 'place', targetType: 'transition', type: 'place-to-transition', bindings: ['y:int'] },
  { id: 'a3', sourceId: 'p1', targetId: 't3', sourceType: 'place', targetType: 'transition', type: 'place-to-transition', bindings: ['flag:boolean'] },
  { id: 'a4', sourceId: 'p2', targetId: 't2', sourceType: 'place', targetType: 'transition', type: 'place-to-transition', bindings: ['flag:boolean'] },
  { id: 'a5', sourceId: 't2', targetId: 'p2', sourceType: 'transition', targetType: 'place', type: 'transition-to-place' },
]);

describe('ConflictResolver', () => {
  let resolver;

  beforeEach(() => {
    resolver = new ConflictResolver();
  });

  test('detects conflicts between transitions competing for same int tokens', () => {
    const arcs = buildArcs();
    const result = resolver.areTransitionsInConflict('t1', 't2', basePlaces, arcs);
    expect(result).toBe(true);

    const stats = resolver.getCacheStats();
    expect(stats.size).toBe(1);
    expect(stats.keys).toEqual(['t1-t2']);

    // Cached reverse lookup should reuse result without new cache entry
    const reverse = resolver.areTransitionsInConflict('t2', 't1', basePlaces, arcs);
    expect(reverse).toBe(true);
    expect(resolver.getCacheStats().size).toBe(1);
  });

  test('distinguishes between int and bool requirements for shared place', () => {
    const arcs = buildArcs();
    const conflict = resolver.areTransitionsInConflict('t1', 't3', basePlaces, arcs);
    expect(conflict).toBe(false);
  });

  test('finds maximal non-conflicting transition sets', () => {
    const arcs = buildArcs();
    const enabled = [{ id: 't1' }, { id: 't2' }, { id: 't3' }];
    const combos = resolver.findNonConflictingTransitions(enabled, basePlaces, arcs);

    expect(Array.isArray(combos)).toBe(true);
    const serialised = combos.map(set => set.map(t => t.id).sort());
    expect(serialised).toEqual(expect.arrayContaining([['t1', 't3'], ['t2', 't3']]));
    expect(serialised.every(arr => arr.length === 2)).toBe(true);
  });

  test('collects combinations of requested size', () => {
    const combos = resolver.getCombinations([1, 2, 3], 2);
    expect(combos).toEqual(expect.arrayContaining([[1, 2], [1, 3], [2, 3]]));
    expect(combos.length).toBe(3);
  });

  test('extracts input and output places for transitions', () => {
    const arcs = buildArcs();
    const input = resolver.getInputPlaces('t1', basePlaces, arcs);
    expect(input.map(p => p.id)).toEqual(['p1']);

    const output = resolver.getOutputPlaces('t2', basePlaces, arcs);
    expect(output.map(p => p.id)).toEqual(['p2']);
  });

  test('clearCache removes cached entries', () => {
    resolver.areTransitionsInConflict('t1', 't2', basePlaces, buildArcs());
    expect(resolver.getCacheStats().size).toBe(1);
    resolver.clearCache();
    expect(resolver.getCacheStats().size).toBe(0);
  });
});


