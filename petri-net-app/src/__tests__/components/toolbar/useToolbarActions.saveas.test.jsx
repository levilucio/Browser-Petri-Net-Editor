// @ts-check
import { jest } from '@jest/globals';

// Import the hook and renderHook helper so hooks run inside a test renderer
import useToolbarActions from '../../../components/toolbar/useToolbarActions.jsx';
import { renderHook, act } from '@testing-library/react';

describe('useToolbarActions - Save / Save As', () => {
  const makeParams = (overrides = {}) => ({
    elements: { places: [], transitions: [], arcs: [] },
    setElements: jest.fn(),
    updateHistory: jest.fn(),
    simulationSettings: { netMode: 'pt' },
    setSimulationSettings: jest.fn(),
    resetEditor: jest.fn(),
    setIsLoading: jest.fn(),
    setError: jest.fn(),
    setSuccess: jest.fn(),
    setIsAdtOpen: jest.fn(),
    saveFileHandle: null,
    setSaveFileHandle: jest.fn(),
    ...overrides,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    // JSDOM doesn't implement these by default
    if (!global.URL) {
      // @ts-ignore
      global.URL = {};
    }
    if (!global.URL.createObjectURL) {
      Object.defineProperty(global.URL, 'createObjectURL', { value: jest.fn(() => 'blob:mock'), writable: true });
    }
    if (!global.URL.revokeObjectURL) {
      Object.defineProperty(global.URL, 'revokeObjectURL', { value: jest.fn(), writable: true });
    }
  });

  test('Save As uses showSaveFilePicker and stores handle', async () => {
    const mockWritable = { write: jest.fn(), close: jest.fn() };
    const mockHandle = { createWritable: jest.fn().mockResolvedValue(mockWritable) };
    const showSaveFilePicker = jest.fn().mockResolvedValue(mockHandle);
    // Attach to existing JSDOM window instead of replacing it
    // @ts-ignore
    global.window = global.window || {};
    // @ts-ignore
    global.window.showSaveFilePicker = showSaveFilePicker;

    const params = makeParams();
    const { result } = renderHook(() => useToolbarActions(params));
    await act(async () => {
      await result.current.handleSaveAs();
    });

    expect(showSaveFilePicker).toHaveBeenCalled();
    expect(mockHandle.createWritable).toHaveBeenCalled();
    expect(mockWritable.write).toHaveBeenCalled();
    expect(mockWritable.close).toHaveBeenCalled();
    expect(params.setSaveFileHandle).toHaveBeenCalledWith(mockHandle);
  });

  test('Save overwrites when handle exists', async () => {
    const mockWritable = { write: jest.fn(), close: jest.fn() };
    const mockHandle = { createWritable: jest.fn().mockResolvedValue(mockWritable) };
    // Ensure the API exists so we take native path
    // @ts-ignore
    global.window = global.window || {};
    // @ts-ignore
    global.window.showSaveFilePicker = jest.fn();

    const params = makeParams({ saveFileHandle: mockHandle });
    const { result } = renderHook(() => useToolbarActions(params));
    await act(async () => {
      await result.current.handleSave();
    });

    expect(mockHandle.createWritable).toHaveBeenCalled();
    expect(mockWritable.write).toHaveBeenCalled();
    expect(mockWritable.close).toHaveBeenCalled();
    // Should not prompt again when handle exists
    expect(window.showSaveFilePicker).not.toHaveBeenCalled();
  });
});


