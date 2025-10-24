import { parsePNML } from '../../utils/pnml/reader';

const PNML_NS = 'http://www.pnml.org/version-2009/grammar/pnml';

describe('pnml reader tokens and arc defaults', () => {
  test('keeps commas inside strings, parses pair, drops unknown token', () => {
    const xml = `<?xml version="1.0"?>
<pnml xmlns="${PNML_NS}">
  <net id="n1" netMode="pt"><page id="p">
    <place id="p1">
      <name><text>P1</text></name>
      <initialMarking><text>['a,b', (1,2), X]</text></initialMarking>
    </place>
  </page></net>
</pnml>`;
    const res = parsePNML(xml);
    const p1 = res.places.find(p => p.id === 'p1');
    expect(p1.valueTokens).toEqual([
      'a,b',
      { __pair__: true, fst: 1, snd: 2 }
      // 'X' is unrecognized and dropped
    ]);
  });

  test('arc type falls back and invalid weight ignored', () => {
    const xml = `<?xml version="1.0"?>
<pnml xmlns="${PNML_NS}">
  <net id="n1" netMode="pt"><page id="p">
    <place id="p1"><name><text>P1</text></name></place>
    <transition id="t1"><name><text>T1</text></name></transition>
    <arc id="a1" source="foo" target="bar">
      <inscription><text>abc</text></inscription>
    </arc>
  </page></net>
</pnml>`;
    const res = parsePNML(xml);
    const a1 = res.arcs.find(a => a.id === 'a1');
    expect(a1.type).toBe('place-to-transition');
    expect(a1.weight).toBe(1);
  });
});


