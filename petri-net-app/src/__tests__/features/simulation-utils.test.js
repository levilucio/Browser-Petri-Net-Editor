import {
  validatePetriNet,
  deepClonePetriNet,
  comparePetriNetStates,
  getMarkingVector,
  isDeadlock,
  toPNML,
  fromPNML,
  getSimulationStats,
} from '../../features/simulation/simulation-utils';

const makeValidNet = () => ({
  places: [{ id: 'p1', tokens: 1, x: 0, y: 0, label: 'P1' }],
  transitions: [{ id: 't1', x: 100, y: 0, label: 'T1' }],
  arcs: [{ id: 'a1', sourceId: 'p1', source: 'p1', targetId: 't1', target: 't1', weight: 1 }],
});

describe('simulation-utils validations', () => {
  test('validatePetriNet reports structural issues', () => {
    const net = {
      places: [{ id: '', tokens: -1, x: 'NaN', y: null }],
      transitions: [{ id: null, x: 'bad', y: 'bad' }],
      arcs: [{ id: null, sourceId: null, targetId: null, weight: 0 }],
    };
    const errors = validatePetriNet(net);
    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('Place at index 0 missing ID'),
      expect.stringContaining('invalid token count'),
      expect.stringContaining('Transition at index 0 missing ID'),
      expect.stringContaining('Arc at index 0 missing ID'),
    ]));
  });

  test('validatePetriNet passes healthy net', () => {
    const errors = validatePetriNet(makeValidNet());
    expect(errors).toEqual([]);
  });
});

describe('simulation-utils helpers', () => {
  test('deepClonePetriNet produces independent copy', () => {
    const original = makeValidNet();
    const clone = deepClonePetriNet(original);
    expect(clone).toEqual(original);
    expect(clone).not.toBe(original);
    clone.places[0].tokens = 5;
    expect(original.places[0].tokens).toBe(1);
  });

  test('comparePetriNetStates differentiates changes', () => {
    const a = makeValidNet();
    const b = deepClonePetriNet(a);
    expect(comparePetriNetStates(a, b)).toBe(true);
    b.places[0].tokens = 3;
    expect(comparePetriNetStates(a, b)).toBe(false);
  });

  test('getMarkingVector summarises place tokens', () => {
    const net = makeValidNet();
    const marking = getMarkingVector(net);
    expect(marking).toEqual([{ id: 'p1', tokens: 1, label: 'P1' }]);
  });

  test('isDeadlock inspects enabled transitions', () => {
    const liveNet = makeValidNet();
    expect(isDeadlock(liveNet)).toBe(false);

    const deadNet = makeValidNet();
    deadNet.places[0].tokens = 0;
    expect(isDeadlock(deadNet)).toBe(true);
  });

  test('toPNML and fromPNML round-trip basic structure', () => {
    const net = makeValidNet();
    const pnml = toPNML(net);
    expect(pnml).toContain('<place id="p1">');
    const parsed = fromPNML(pnml);
    expect(parsed.places[0].id).toBe('p1');
    expect(parsed.arcs[0].weight).toBe(1);
  });

  test('fromPNML rethrows parser failures', () => {
    const OriginalDOMParser = global.DOMParser;
    class FailingDOMParser {
      parseFromString() {
        throw new Error('parser failed');
      }
    }
    try {
      // eslint-disable-next-line no-global-assign
      global.DOMParser = FailingDOMParser;
      expect(() => fromPNML('<pnml />')).toThrow('Invalid PNML format');
    } finally {
      // eslint-disable-next-line no-global-assign
      global.DOMParser = OriginalDOMParser;
    }
  });

  test('getSimulationStats aggregates counts and enabled transitions', () => {
    const net = makeValidNet();
    const stats = getSimulationStats(net);
    expect(stats).toMatchObject({
      placeCount: 1,
      transitionCount: 1,
      arcCount: 1,
      totalTokens: 1,
      enabledTransitionCount: 1,
      enabledTransitions: ['t1'],
      isDeadlock: false,
    });
  });
});


