import { generatePNML } from '../../utils/pnml/writer';

describe('pnml writer adds xmlns:apn when APN elements used', () => {
  test('xmlns:apn present when guard provided', () => {
    const xml = generatePNML({
      places: [{ id: 'p1', x: 0, y: 0 }],
      transitions: [{ id: 't1', x: 0, y: 0, guard: 'x:Int' }],
      arcs: []
    });
    expect(xml).toContain('xmlns:apn');
  });
});


