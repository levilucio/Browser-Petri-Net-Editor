import { parsePNML } from '../../utils/pnml/reader';

const PNML_NS = 'http://www.pnml.org/version-2009/grammar/pnml';

describe('pnml reader binding top-level comma split', () => {
  test('keeps nested list intact and splits top-level', () => {
    const xml = `<?xml version="1.0"?>
<pnml xmlns="${PNML_NS}">
  <net id="n1" netMode="pt"><page id="p">
    <place id="p1"><name><text>P1</text></name></place>
    <transition id="t1"><name><text>T1</text></name></transition>
    <arc id="a1" source="p1" target="t1">
      <graphics><metadata/></graphics>
      <apn:binding xmlns:apn="http://example.org/apn"><apn:text>x:[1,2], y:(1,2)</apn:text></apn:binding>
    </arc>
  </page></net>
</pnml>`;
    const res = parsePNML(xml);
    const a1 = res.arcs.find(a => a.id === 'a1');
    expect(a1.bindings).toEqual(['x:[1,2]', 'y:(1,2)']);
  });
});


