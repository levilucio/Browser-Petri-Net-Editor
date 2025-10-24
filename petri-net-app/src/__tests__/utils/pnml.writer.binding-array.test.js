import { generatePNML } from '../../utils/pnml/writer';

describe('pnml writer binding (array) omits inscription and joins values', () => {
  test('bindings array present, joined with comma and no inscription', () => {
    const xml = generatePNML({
      places: [{ id: 'p1', x: 0, y: 0 }],
      transitions: [{ id: 't1', x: 0, y: 0 }],
      arcs: [{ id: 'a1', source: 'p1', target: 't1', weight: 3, bindings: ['x:Int', 'y:String'] }]
    });
    expect(xml).toContain('xmlns:apn');
    expect(xml).toContain('<apn:binding');
    expect(xml).toContain('<apn:text>x:Int, y:String</apn:text>');
    expect(xml).not.toContain('<inscription>');
  });
});


