import { generatePNML } from '../../utils/pnml/writer';

describe('pnml writer omissions for empty/none', () => {
  test('omits binding when bindings array empty', () => {
    const xml = generatePNML({
      places: [{ id: 'p1', x: 0, y: 0 }],
      transitions: [{ id: 't1', x: 0, y: 0 }],
      arcs: [{ id: 'a1', source: 'p1', target: 't1', bindings: [] }]
    });
    expect(xml).not.toContain('<apn:binding');
  });
});


