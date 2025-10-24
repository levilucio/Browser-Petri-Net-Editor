import { generatePNML } from '../../utils/pnml/writer';

describe('pnml writer formats valueTokens in initialMarking', () => {
  test('formats booleans, strings with quotes, lists and pairs', () => {
    const xml = generatePNML({
      places: [
        {
          id: 'p1', x: 0, y: 0,
          valueTokens: [true, false, "a'b", { __pair__: true, fst: 1, snd: 3 }, [1, 2]]
        }
      ],
      transitions: [],
      arcs: []
    });
    expect(xml).toContain("<initialMarking>");
    // Expect escaped single quote in string, spaces after commas
    expect(xml).toContain("[T, F, 'a\\'b', (1, 3), [1, 2]]");
  });
});


