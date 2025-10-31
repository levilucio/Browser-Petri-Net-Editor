import { exportToPNML, importFromPNML, importADT, validateADTSpec, exportADT } from '../../utils/python/index';

jest.mock('../../utils/pnml-parser', () => ({
  parsePNML: jest.fn(() => ({ parsed: true })),
  generatePNML: jest.fn(() => '<pnml />'),
}));

jest.mock('../../utils/adt-parser', () => ({
  parseADT: jest.fn(async () => ({ types: [] })),
  validateADT: jest.fn(async () => ({ valid: true, errors: [] })),
  generateADT: jest.fn(async () => '<adt />'),
}));

const pnmlParser = jest.requireMock('../../utils/pnml-parser');
const adtParser = jest.requireMock('../../utils/adt-parser');

describe('python/index PNML wrappers', () => {
  test('exportToPNML delegates to generatePNML', async () => {
    const payload = { places: [] };
    const result = await exportToPNML(payload);
    expect(pnmlParser.generatePNML).toHaveBeenCalledWith(payload);
    expect(result).toBe('<pnml />');
  });

  test('exportToPNML rethrows generator errors', async () => {
    pnmlParser.generatePNML.mockImplementationOnce(() => { throw new Error('boom'); });
    await expect(exportToPNML({})).rejects.toThrow('boom');
  });

  test('importFromPNML resolves parsed structure', async () => {
    const result = await importFromPNML('<pnml />');
    expect(pnmlParser.parsePNML).toHaveBeenCalledWith('<pnml />');
    expect(result).toEqual({ parsed: true });
  });

  test('importFromPNML surfaces parser errors', async () => {
    pnmlParser.parsePNML.mockImplementationOnce(() => { throw new Error('parse fail'); });
    await expect(importFromPNML('<bad />')).rejects.toThrow('parse fail');
  });
});

describe('python/index ADT helpers', () => {
  test('importADT delegates to parseADT', async () => {
    const result = await importADT('<adt />');
    expect(adtParser.parseADT).toHaveBeenCalledWith('<adt />');
    expect(result).toEqual({ types: [] });
  });

  test('validateADTSpec passes through to validateADT', async () => {
    const payload = { types: [] };
    const result = await validateADTSpec(payload);
    expect(adtParser.validateADT).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  test('exportADT calls generateADT', async () => {
    const payload = { types: [] };
    const result = await exportADT(payload);
    expect(adtParser.generateADT).toHaveBeenCalledWith(payload);
    expect(result).toBe('<adt />');
  });
});



