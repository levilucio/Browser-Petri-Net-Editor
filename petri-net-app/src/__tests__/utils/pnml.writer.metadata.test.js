import { generatePNML } from '../../utils/pnml/writer';

describe('pnml writer arc metadata', () => {
  test('writes default source/target directions when not provided', () => {
    const xml = generatePNML({
      places: [{ id: 'p1', x: 0, y: 0 }],
      transitions: [{ id: 't1', x: 0, y: 0 }],
      arcs: [{ id: 'a1', source: 'p1', target: 't1' }]
    });
    expect(xml).toContain('<sourceDirection>north</sourceDirection>');
    expect(xml).toContain('<targetDirection>south</targetDirection>');
  });

  test('writes custom source/target directions when provided', () => {
    const xml = generatePNML({
      places: [{ id: 'p1', x: 0, y: 0 }],
      transitions: [{ id: 't1', x: 0, y: 0 }],
      arcs: [{ id: 'a2', source: 'p1', target: 't1', sourceDirection: 'east', targetDirection: 'west' }]
    });
    expect(xml).toContain('<sourceDirection>east</sourceDirection>');
    expect(xml).toContain('<targetDirection>west</targetDirection>');
  });
});


