import { parsePNML } from '../../utils/pnml/reader';

const PNML_NS = 'http://www.pnml.org/version-2009/grammar/pnml';

describe('pnml reader parses various algebraic tokens', () => {
  test('booleans, numbers, lists, nested pairs; drops unknowns', () => {
    const xml = `<?xml version="1.0"?>
<pnml xmlns="${PNML_NS}">
  <net id="n1" netMode="pt"><page id="p">
    <place id="p1">
      <name><text>P1</text></name>
      <initialMarking><text>[T, F, true, false, -12, 0, [1, 2], (1, (2,3)), abc]</text></initialMarking>
    </place>
  </page></net>
</pnml>`;
    const res = parsePNML(xml);
    const vt = res.places[0].valueTokens;
    expect(vt).toEqual([
      true,
      false,
      true,
      false,
      -12,
      0,
      [1, 2],
      { __pair__: true, fst: 1, snd: { __pair__: true, fst: 2, snd: 3 } }
      // 'abc' dropped
    ]);
  });
});


