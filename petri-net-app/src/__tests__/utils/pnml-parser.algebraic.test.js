import { parsePNML, generatePNML } from '../../utils/pnml-parser';

describe('PNML (algebraic annotations)', () => {
  test('parsePNML reads algebraic tokens, guard/action, and bindings', () => {
    const xml = `
      <pnml xmlns="http://www.pnml.org/version-2009/grammar/pnml" xmlns:apn="http://example.org/apn">
        <net id="n1" type="http://www.pnml.org/version-2009/grammar/ptnet">
          <page id="p">
            <place id="p1">
              <name><text>P1</text></name>
              <graphics><position x="0" y="0"/></graphics>
              <initialMarking><text>[1, 3, 5]</text></initialMarking>
              <apn:type><apn:text>Integer</apn:text></apn:type>
            </place>
            <transition id="t1">
              <name><text>T1</text></name>
              <graphics><position x="100" y="0"/></graphics>
              <apn:guard><apn:text>x>1</apn:text></apn:guard>
              <apn:action><apn:text>y=x+1</apn:text></apn:action>
            </transition>
            <arc id="a1" source="p1" target="t1">
              <apn:binding><apn:text>x</apn:text></apn:binding>
            </arc>
          </page>
        </net>
      </pnml>`;
    const result = parsePNML(xml);
    expect(result.places[0].valueTokens).toEqual([1, 3, 5]);
    expect(result.places[0].type).toBeDefined();
    expect(result.transitions[0].guard).toBeDefined();
    expect(result.transitions[0].action).toBeDefined();
    expect(result.arcs[0].binding || result.arcs[0].bindings?.[0]).toBeTruthy();
  });

  test('generatePNML: bindings suppress inscription even with weight > 1', () => {
    const net = {
      places: [{ id: 'p1', name: 'P1', x: 0, y: 0 }],
      transitions: [{ id: 't1', name: 'T1', x: 100, y: 0 }],
      arcs: [{ id: 'a1', source: 'p1', target: 't1', weight: 5, bindings: ['x'] }],
    };
    const out = generatePNML(net);
    expect(out).toContain('xmlns:apn=');
    expect(out).toContain('<apn:binding');
    expect(out).not.toContain('<inscription>');
  });

  test('algebraic tokens: booleans T/F round-trip in PNML', () => {
    const net = {
      places: [{ id: 'p1', name: 'P1', x: 0, y: 0, valueTokens: [2, 11, 6, true, false] }],
      transitions: [],
      arcs: [],
      netMode: 'algebraic'
    };
    const xml = generatePNML(net);
    expect(xml).toMatch(/<apn:valueTokens[^>]*>/);
    expect(xml).not.toContain('[2, 11, 6, T, F]');
    expect(xml).toContain('<apn:token><apn:text>2</apn:text></apn:token>');
    expect(xml).toContain('<apn:token><apn:text>11</apn:text></apn:token>');
    expect(xml).toContain('<apn:token><apn:text>6</apn:text></apn:token>');
    expect(xml).toContain('<apn:token><apn:text>T</apn:text></apn:token>');
    expect(xml).toContain('<apn:token><apn:text>F</apn:text></apn:token>');
    const parsed = parsePNML(xml);
    expect(parsed.places[0].valueTokens).toEqual([2, 11, 6, true, false]);
  });
});


