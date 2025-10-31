// @ts-check
import { jest } from '@jest/globals';

// Import the hook and renderHook helper so hooks run inside a test renderer
import useToolbarActions from '../../../components/toolbar/useToolbarActions.jsx';
import { renderHook, act } from '@testing-library/react';

jest.mock('../../../utils/python/index', () => ({
  exportToPNML: jest.fn(async () => '<pnml />'),
  importFromPNML: jest.fn(),
}));

jest.mock('../../../features/simulation', () => ({
  simulatorCore: {
    deactivateSimulation: jest.fn(),
    reset: jest.fn(),
  },
}));

jest.mock('../../../utils/netMode', () => ({
  detectNetModeFromContent: jest.fn(() => 'pt'),
}));

const pythonMocks = jest.requireMock('../../../utils/python/index');
const { simulatorCore } = jest.requireMock('../../../features/simulation');
const { detectNetModeFromContent } = jest.requireMock('../../../utils/netMode');

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

  test('handleSave falls back to anchor download when File System API unavailable', async () => {
    // Remove FS API
    if (global.window && 'showSaveFilePicker' in global.window) {
      delete global.window.showSaveFilePicker;
    }

    const anchorClick = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const appendSpy = jest.spyOn(document.body, 'appendChild');
    const removeSpy = jest.spyOn(document.body, 'removeChild');

    const params = makeParams();
    const { result } = renderHook(() => useToolbarActions(params));
    await act(async () => {
      await result.current.handleSave();
    });

    expect(anchorClick).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(params.setSuccess).toHaveBeenCalledWith('Petri net saved.');

    anchorClick.mockRestore();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  test('handleOpenAdtManager toggles dialog state when setter provided', () => {
    const params = makeParams();
    const { result } = renderHook(() => useToolbarActions(params));
    act(() => {
      result.current.handleOpenAdtManager();
    });
    expect(params.setIsAdtOpen).toHaveBeenCalledWith(true);

    const withoutSetter = makeParams({ setIsAdtOpen: undefined });
    renderHook(() => useToolbarActions(withoutSetter)).result.current.handleOpenAdtManager();
    // Should not throw when setter missing
  });

  test('handleClear uses resetEditor when provided', () => {
    const params = makeParams();
    const { result } = renderHook(() => useToolbarActions(params));
    act(() => {
      result.current.handleClear();
    });
    expect(simulatorCore.deactivateSimulation).toHaveBeenCalled();
    expect(simulatorCore.reset).toHaveBeenCalled();
    expect(params.resetEditor).toHaveBeenCalled();
    expect(params.setSuccess).toHaveBeenCalledWith('Canvas cleared successfully.');
  });

  test('handleClear resets state when resetEditor is absent', () => {
    const params = makeParams({ resetEditor: undefined });
    const { result } = renderHook(() => useToolbarActions(params));
    act(() => {
      result.current.handleClear();
    });
    expect(params.setElements).toHaveBeenCalledWith({ places: [], transitions: [], arcs: [] });
    expect(params.setSimulationSettings).toHaveBeenCalled();
    expect(params.updateHistory).toHaveBeenCalledWith({ places: [], transitions: [], arcs: [] });
  });

  test('handleLoad imports PNML and updates state', async () => {
    const fileContent = '<pnml><net></net></pnml>';
    const importedNet = {
      places: [{ id: 'p1' }],
      transitions: [{ id: 't1' }],
      arcs: [
        { source: 'p1', target: 't1', type: 'place-to-transition' },
        { source: 'undefined', target: 't1' },
      ],
      netMode: 'algebraic',
    };
    pythonMocks.importFromPNML.mockResolvedValue(importedNet);

    detectNetModeFromContent.mockReturnValue('pt');

    const params = makeParams();
    const file = new File([fileContent], 'net.pnml', { type: 'application/xml' });

    global.FileReader = class {
      readAsText() {
        this.onload({ target: { result: fileContent } });
      }
    };

    const inputClick = jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function click() {
      this.onchange?.({ target: { files: [file] } });
    });

    const { result } = renderHook(() => useToolbarActions(params));
    await act(async () => {
      result.current.handleLoad();
      await Promise.resolve();
    });

    expect(params.setIsLoading).toHaveBeenNthCalledWith(1, true);
    expect(params.setIsLoading).toHaveBeenLastCalledWith(false);
    expect(params.setElements).toHaveBeenCalledWith({
      places: [{ id: 'p1' }],
      transitions: [{ id: 't1' }],
      arcs: [{ source: 'p1', target: 't1', type: 'place-to-transition' }],
    });
    expect(params.setSimulationSettings).toHaveBeenCalledWith(expect.any(Function));
    expect(params.updateHistory).toHaveBeenCalled();
    expect(params.setSuccess).toHaveBeenCalledWith(expect.stringContaining('Petri net loaded successfully'));

    inputClick.mockRestore();
  });

  test('handleLoad surfaces validation errors for invalid files', async () => {
    pythonMocks.importFromPNML.mockClear();

    const params = makeParams();
    const invalidFile = new File(['not pnml'], 'invalid.txt', { type: 'text/plain' });

    global.FileReader = class {
      readAsText() {
        this.onload({ target: { result: 'not pnml' } });
      }
    };

    const inputClick = jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function click() {
      this.onchange?.({ target: { files: [invalidFile] } });
    });

    const { result } = renderHook(() => useToolbarActions(params));
    await act(async () => {
      result.current.handleLoad();
      await Promise.resolve();
    });

    expect(params.setError).toHaveBeenCalled();
    expect(pythonMocks.importFromPNML).not.toHaveBeenCalled();
    inputClick.mockRestore();
  });
});


