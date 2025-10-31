import React from 'react';
import { render, renderHook, act } from '@testing-library/react';
import { AdtProvider, useAdtRegistry } from '../../contexts/AdtContext';

const mockParseADT = jest.fn();
const mockValidateADT = jest.fn();

jest.mock('../../utils/adt-parser', () => ({
  parseADT: jest.fn((...args) => mockParseADT(...args)),
  validateADT: jest.fn((...args) => mockValidateADT(...args)),
  generateADT: jest.fn(() => '<adt />'),
}));

const baseRegistry = {
  types: [
    { name: 'Int', operations: [], axioms: [] },
    { name: 'Bool', operations: [], axioms: [] },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParseADT.mockImplementation((xml) => {
    if (xml === 'custom-ok') {
      return { types: [{ name: 'Alpha', operations: [], axioms: [] }] };
    }
    if (xml === 'duplicate-name') {
      return { types: [{ name: 'Int', operations: [], axioms: [] }] };
    }
    if (xml === 'invalid-spec') {
      return { types: [{ name: 'Broken', operations: [], axioms: [] }] };
    }
    return baseRegistry;
  });
  mockValidateADT.mockReturnValue({ valid: true, errors: [] });
});

describe('AdtContext registry', () => {
  const wrapper = ({ children }) => <AdtProvider>{children}</AdtProvider>;

  test('provides base types as read-only definitions', () => {
    const { result: registry } = renderHook(() => useAdtRegistry(), { wrapper });
    expect(registry.current.listTypes()).toEqual(expect.arrayContaining(['Int', 'Bool']));
    expect(registry.current.getType('Int').__readonly).toBe(true);
    expect(registry.current.baseReadOnly).toBe(true);
  });

  test('registerCustomADTXml accepts validated custom XML', async () => {
    const { result: registry } = renderHook(() => useAdtRegistry(), { wrapper });
    let response;
    await act(async () => {
      response = registry.current.registerCustomADTXml('custom-ok');
    });
    expect(response).toEqual({ ok: true });
    expect(mockValidateADT).toHaveBeenCalled();
    expect(registry.current.listTypes()).toEqual(expect.arrayContaining(['Alpha']));
    expect(registry.current.getType('Alpha').__readonly).toBe(false);
    expect(registry.current.exportCustomADTXml()).toBe('custom-ok');
  });

  test('registerCustomADTXml rejects duplicate names', async () => {
    const { result: registry } = renderHook(() => useAdtRegistry(), { wrapper });
    let response;
    await act(async () => {
      response = registry.current.registerCustomADTXml('duplicate-name');
    });
    expect(response).toEqual({ ok: false, errors: ['Duplicate type: Int'] });
  });

  test('registerCustomADTXml propagates validator errors', async () => {
    mockValidateADT.mockReturnValueOnce({ valid: false, errors: ['bad schema'] });
    const { result: registry } = renderHook(() => useAdtRegistry(), { wrapper });
    let response;
    await act(async () => {
      response = registry.current.registerCustomADTXml('invalid-spec');
    });
    expect(response).toEqual({ ok: false, errors: ['bad schema'] });
    expect(registry.current.listTypes()).not.toContain('Broken');
  });

  test('clearCustomADTs removes custom definitions and exported XML', async () => {
    const { result: registry } = renderHook(() => useAdtRegistry(), { wrapper });
    await act(async () => {
      registry.current.registerCustomADTXml('custom-ok');
    });
    expect(registry.current.listTypes()).toEqual(expect.arrayContaining(['Alpha']));

    await act(async () => {
      registry.current.clearCustomADTs();
    });
    expect(registry.current.listTypes()).not.toContain('Alpha');
    expect(registry.current.exportCustomADTXml()).toBe('');
  });

  test('useAdtRegistry throws outside provider boundary', () => {
    const Orphan = () => {
      useAdtRegistry();
      return null;
    };
    expect(() => render(<Orphan />)).toThrow('useAdtRegistry must be used within AdtProvider');
  });
});
