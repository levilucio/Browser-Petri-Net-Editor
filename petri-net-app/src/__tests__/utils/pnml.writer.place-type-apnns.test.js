import { generatePNML } from '../../utils/pnml/writer';

describe('pnml writer adds apn:type for place types', () => {
  test('xmlns:apn and apn:type present when place has type', () => {
    const xml = generatePNML({
      places: [{ id: 'p1', x: 0, y: 0, type: 'Int' }],
      transitions: [],
      arcs: []
    });
    expect(xml).toContain('xmlns:apn');
    expect(xml).toContain('<apn:type');
    expect(xml).toContain('<apn:text>Int</apn:text>');
  });
});


