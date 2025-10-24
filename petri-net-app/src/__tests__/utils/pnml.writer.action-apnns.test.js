import { generatePNML } from '../../utils/pnml/writer';

describe('pnml writer adds xmlns:apn when action provided', () => {
  test('xmlns:apn present with action only', () => {
    const xml = generatePNML({
      places: [{ id: 'p1', x: 0, y: 0 }],
      transitions: [{ id: 't1', x: 0, y: 0, action: 'x := x + 1' }],
      arcs: []
    });
    expect(xml).toContain('xmlns:apn');
    expect(xml).toContain('<apn:action');
    expect(xml).toContain('<apn:text>x := x + 1</apn:text>');
  });
});


