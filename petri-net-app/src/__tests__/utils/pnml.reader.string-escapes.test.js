import { parsePNML } from '../../utils/pnml/reader';

const PNML_NS = 'http://www.pnml.org/version-2009/grammar/pnml';

describe('pnml reader parses string escape sequences in valueTokens', () => {
  test("parses \\n, \\t, \\r, \\' and \\\\ correctly", () => {
    const xml = `<?xml version="1.0"?>
<pnml xmlns="${PNML_NS}">
  <net id="n1" netMode="pt"><page id="p">
    <place id="p1">
      <name><text>P1</text></name>
      <initialMarking><text>['a\\n\\t\\r\\\'\\\\b']</text></initialMarking>
    </place>
  </page></net>
</pnml>`;
    const res = parsePNML(xml);
    const s = res.places[0].valueTokens[0];
    expect(s).toBe("a\n\t\r'\\b");
  });
});


