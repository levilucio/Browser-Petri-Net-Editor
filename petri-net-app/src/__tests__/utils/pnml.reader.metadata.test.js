import { parsePNML } from '../../utils/pnml/reader';

const PNML_NS = 'http://www.pnml.org/version-2009/grammar/pnml';

describe('pnml reader arc metadata and APN text nodes', () => {
  test('reads source/target directions from metadata; defaults when missing', () => {
    const xml = `<?xml version="1.0"?>
<pnml xmlns="${PNML_NS}">
  <net id="n1" netMode="pt"><page id="p">
    <place id="p1"><name><text>P1</text></name></place>
    <transition id="t1"><name><text>T1</text></name></transition>
    <arc id="a1" source="p1" target="t1">
      <graphics>
        <metadata>
          <sourceDirection>east</sourceDirection>
          <targetDirection>west</targetDirection>
        </metadata>
      </graphics>
    </arc>
    <arc id="a2" source="p1" target="t1" />
  </page></net>
</pnml>`;
    const res = parsePNML(xml);
    const a1 = res.arcs.find(a => a.id === 'a1');
    const a2 = res.arcs.find(a => a.id === 'a2');
    expect(a1.sourceDirection).toBe('east');
    expect(a1.targetDirection).toBe('west');
    expect(a2.sourceDirection).toBe('north');
    expect(a2.targetDirection).toBe('south');
  });

  test('reads APN namespaced text for type/guard/action', () => {
    const xml = `<?xml version="1.0"?>
<pnml xmlns="${PNML_NS}">
  <net id="n1" netMode="pt"><page id="p">
    <place id="p1">
      <name><text>P1</text></name>
      <apn:type xmlns:apn="http://example.org/apn"><apn:text>Int</apn:text></apn:type>
    </place>
    <transition id="t1">
      <name><text>T1</text></name>
      <apn:guard xmlns:apn="http://example.org/apn"><apn:text>x>0</apn:text></apn:guard>
      <apn:action xmlns:apn="http://example.org/apn"><apn:text>x:=x-1</apn:text></apn:action>
    </transition>
  </page></net>
</pnml>`;
    const res = parsePNML(xml);
    expect(res.places[0].type).toBe('Int');
    expect(res.transitions[0].guard).toBe('x>0');
    expect(res.transitions[0].action).toBe('x:=x-1');
  });
});


