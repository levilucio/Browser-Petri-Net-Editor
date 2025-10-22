import { generatePNML } from '../../utils/pnml/writer';

describe('pnml writer inscription branch', () => {
  test('adds inscription when weight > 1 and no bindings', () => {
    const xml = generatePNML({
      places: [{ id: 'p1', x: 0, y: 0 }],
      transitions: [{ id: 't1', x: 0, y: 0 }],
      arcs: [{ id: 'a3', source: 'p1', target: 't1', weight: 3 }]
    });
    expect(xml).toContain('<arc');
    expect(xml).toContain('id="a3"');
    expect(xml).toContain('<inscription>');
    expect(xml).toContain('<text>3</text>');
  });
});


