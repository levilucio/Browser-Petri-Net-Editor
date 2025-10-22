import { generatePNML } from '../../utils/pnml/writer';

describe('pnml writer branches', () => {
  test('skips invalid arcs and emits valid arcs with defaults', () => {
    const xml = generatePNML({
      places: [{ id: 'p1', x: 0, y: 0 }],
      transitions: [{ id: 't1', x: 0, y: 0 }],
      arcs: [
        { id: 'bad1' },
        { id: 'bad2', source: 'pX', target: 't1' },
        { id: 'good', source: 'p1', target: 't1', weight: 1, bindings: ['x:Int'] }
      ]
    });
    expect(xml).toContain('id="good"');
    expect(xml).not.toContain('id="bad1"');
    expect(xml).not.toContain('id="bad2"');
    expect(xml).toContain('xmlns:apn');
  });
});
