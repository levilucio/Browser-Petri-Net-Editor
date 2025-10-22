import { generatePNML } from '../../utils/pnml/writer';

describe('pnml writer no inscription when bindings present', () => {
  test('omits inscription if bindings exist even when weight > 1', () => {
    const xml = generatePNML({
      places: [{ id: 'p1', x: 0, y: 0 }],
      transitions: [{ id: 't1', x: 0, y: 0 }],
      arcs: [{ id: 'a4', source: 'p1', target: 't1', weight: 5, bindings: ['x:Int'] }]
    });
    const arcIdx = xml.indexOf('id="a4"');
    expect(arcIdx).toBeGreaterThan(-1);
    const snippet = xml.slice(arcIdx, arcIdx + 300);
    expect(snippet).not.toContain('<inscription>');
  });
});


