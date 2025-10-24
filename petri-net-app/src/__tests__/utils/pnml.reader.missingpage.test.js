import { parsePNML } from '../../utils/pnml/reader';

const PNML_NS = 'http://www.pnml.org/version-2009/grammar/pnml';

describe('pnml reader missing page', () => {
  test('returns empty result when page element is missing', () => {
    const xml = `<?xml version="1.0"?>
<pnml xmlns="${PNML_NS}">
  <net id="n1" netMode="pt">
  </net>
</pnml>`;
    const res = parsePNML(xml);
    expect(res.places.length).toBe(0);
    expect(res.transitions.length).toBe(0);
    expect(res.arcs.length).toBe(0);
  });
});


