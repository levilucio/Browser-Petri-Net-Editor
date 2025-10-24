import { parsePNML } from '../../utils/pnml/reader';

const PNML_NS = 'http://www.pnml.org/version-2009/grammar/pnml';

describe('pnml reader non-APN bindings', () => {
  test('splits binding text by commas and preserves single binding', () => {
    const xml = `<?xml version="1.0"?>
<pnml xmlns="${PNML_NS}">
  <net id="n1">
    <page id="page1">
      <place id="p1"><name><text>P1</text></name></place>
      <transition id="t1"><name><text>T1</text></name></transition>
      <arc id="aMany" source="p1" target="t1"><binding><text>a, b, c</text></binding></arc>
      <arc id="aOne" source="p1" target="t1"><binding><text>x</text></binding></arc>
    </page>
  </net>
</pnml>`;
    const res = parsePNML(xml);
    const aMany = res.arcs.find(a => a.id === 'aMany');
    const aOne = res.arcs.find(a => a.id === 'aOne');
    expect(aMany.bindings).toEqual(['a', 'b', 'c']);
    expect(aOne.bindings).toEqual(['x']);
  });
});


