import { parsePNML } from '../../utils/pnml/reader';

describe('pnml reader error branches', () => {
  test('invalid xml returns empty result and logs errors', () => {
    const res = parsePNML('<bad');
    expect(res.places).toEqual([]);
    expect(res.transitions).toEqual([]);
    expect(res.arcs).toEqual([]);
  });

  test('missing net/page elements returns empty result', () => {
    const xml = `<?xml version="1.0"?><pnml></pnml>`;
    const res = parsePNML(xml);
    expect(res.places.length + res.transitions.length + res.arcs.length).toBe(0);
  });
});


