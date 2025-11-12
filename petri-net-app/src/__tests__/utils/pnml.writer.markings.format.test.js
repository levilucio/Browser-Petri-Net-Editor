import { generatePNML } from '../../utils/pnml/writer';

describe('pnml writer formats algebraic valueTokens using apn:valueTokens', () => {
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
    expect(xml).toMatch(/<apn:valueTokens[^>]*>/);
    // writer should no longer emit the ambiguous initialMarking for algebraic places
    expect(xml).not.toContain('<initialMarking>');
    expect(xml).toContain('<apn:token><apn:text>T</apn:text></apn:token>');
    expect(xml).toContain('<apn:token><apn:text>F</apn:text></apn:token>');
    expect(xml).toContain("<apn:token><apn:text>'a\\'b'</apn:text></apn:token>");
    expect(xml).toContain('<apn:token><apn:text>(1, 3)</apn:text></apn:token>');
    expect(xml).toContain('<apn:token><apn:text>[1, 2]</apn:text></apn:token>');
  });
});


