import { parsePNML } from '../../utils/pnml/reader';

const APN_NS = 'http://example.org/apn';
const PNML_NS = 'http://www.pnml.org/version-2009/grammar/pnml';

describe('pnml reader additional branches', () => {
  test('parses APN namespaced fields, positions, complex tokens, heuristics and bindings', () => {
    const xml = `<?xml version="1.0"?>
<pnml xmlns="${PNML_NS}" xmlns:apn="${APN_NS}">
  <net id="n1" netMode="algebraic-int">
    <page id="page1">
      <place id="P1">
        <name><text>P1</text></name>
        <graphics><position x="10" y="20"/></graphics>
        <apn:type><apn:text>Int</apn:text></apn:type>
        <initialMarking><text>['a, b', (1,2), [3,4], T, F, 5]</text></initialMarking>
      </place>
      <transition id="T1">
        <name><text>T1</text></name>
        <graphics><position x="30" y="40"/></graphics>
        <apn:guard><apn:text>x>0</apn:text></apn:guard>
        <apn:action><apn:text>y:=1</apn:text></apn:action>
      </transition>
      <arc id="aHeuristics" source="placeFoo" target="transitionBar">
        <graphics>
          <metadata>
            <sourceDirection>west</sourceDirection>
            <targetDirection>east</targetDirection>
          </metadata>
        </graphics>
        <inscription><text>abc</text></inscription>
        <apn:binding><apn:text>x:Int, y:Bool</apn:text></apn:binding>
      </arc>
      <arc id="a12" source="P1" target="T1">
        <inscription><text>2</text></inscription>
      </arc>
    </page>
  </net>
</pnml>`;

    const res = parsePNML(xml);
    expect(res.netMode).toBe('algebraic-int');
    expect(res.places.length).toBe(1);
    expect(res.transitions.length).toBe(1);
    expect(res.arcs.length).toBe(2);

    const p = res.places[0];
    expect(p).toMatchObject({ id: 'P1', x: 10, y: 20, label: 'P1', name: 'P1', type: 'Int' });
    expect(Array.isArray(p.valueTokens)).toBe(true);
    // ['a, b', (1,2), [3,4], T, F, 5]
    expect(p.valueTokens[0]).toBe("a, b");
    expect(p.valueTokens[1]).toEqual({ __pair__: true, fst: 1, snd: 2 });
    expect(p.valueTokens[2]).toEqual([3, 4]);
    expect(p.valueTokens[3]).toBe(true);
    expect(p.valueTokens[4]).toBe(false);
    expect(p.valueTokens[5]).toBe(5);

    const aHeu = res.arcs.find(a => a.id === 'aHeuristics');
    expect(aHeu).toBeTruthy();
    expect(aHeu.type).toBe('place-to-transition');
    expect(aHeu.sourceDirection).toBe('west');
    expect(aHeu.targetDirection).toBe('east');
    expect(Number.isNaN(aHeu.weight) || aHeu.weight === 1).toBe(true);
    expect(aHeu.bindings).toEqual(['x:Int', 'y:Bool']);

    const a12 = res.arcs.find(a => a.id === 'a12');
    expect(a12).toBeTruthy();
    expect(a12.type).toBe('place-to-transition');
    expect(a12.weight).toBe(2);
  });

  test('parses apn:valueTokens and prefers them over legacy initialMarking', () => {
    const xml = `<?xml version="1.0"?>
<pnml xmlns="${PNML_NS}" xmlns:apn="${APN_NS}">
  <net id="n2" netMode="algebraic-int">
    <page id="page1">
      <place id="P2">
        <name><text>P2</text></name>
        <graphics><position x="0" y="0"/></graphics>
        <initialMarking><text>[999]</text></initialMarking>
        <apn:valueTokens>
          <apn:token><apn:text>1</apn:text></apn:token>
          <apn:token><apn:text>[2, 3]</apn:text></apn:token>
          <apn:token><apn:text>(4, (5, 6))</apn:text></apn:token>
        </apn:valueTokens>
      </place>
    </page>
  </net>
</pnml>`;

    const res = parsePNML(xml);
    expect(res.places.length).toBe(1);
    const place = res.places[0];
    expect(place.tokens).toBe(3);
    expect(place.valueTokens).toEqual([
      1,
      [2, 3],
      { __pair__: true, fst: 4, snd: { __pair__: true, fst: 5, snd: 6 } },
    ]);
  });
});


