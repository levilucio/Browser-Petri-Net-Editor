import { generatePNML } from '../../utils/pnml/writer';

describe('pnml writer binding (string) omits inscription and adds apn binding', () => {
  test('binding string present, no inscription even if weight > 1', () => {
    const xml = generatePNML({
      places: [{ id: 'p1', x: 0, y: 0 }],
      transitions: [{ id: 't1', x: 0, y: 0 }],
      arcs: [{ id: 'a1', source: 'p1', target: 't1', weight: 5, binding: 'x:Int' }]
    });
    expect(xml).toContain('xmlns:apn');
    expect(xml).toContain('<apn:binding');
    expect(xml).toContain('<apn:text>x:Int</apn:text>');
    expect(xml).not.toContain('<inscription>');
  });
});


