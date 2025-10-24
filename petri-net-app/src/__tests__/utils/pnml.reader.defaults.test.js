import { parsePNML } from '../../utils/pnml/reader';

const PNML_NS = 'http://www.pnml.org/version-2009/grammar/pnml';

describe('pnml reader defaults and naming', () => {
  test('defaults name/label and position when missing', () => {
    const xml = `<?xml version="1.0"?>
<pnml xmlns="${PNML_NS}">
  <net id="n1" netMode="pt"><page id="p">
    <place id="p1"></place>
    <transition id="t1"><graphics><position x="10" y="20"/></graphics></transition>
  </page></net>
</pnml>`;
    const res = parsePNML(xml);
    const p1 = res.places[0];
    const t1 = res.transitions[0];
    expect(p1.name).toBe('P1');
    expect(p1.label).toBe('P1');
    expect(p1.x).toBe(0);
    expect(p1.y).toBe(0);
    expect(t1.name).toBe('T1');
    expect(t1.label).toBe('T1');
    expect(t1.x).toBe(10);
    expect(t1.y).toBe(20);
  });
});


