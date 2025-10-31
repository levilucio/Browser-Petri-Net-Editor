import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const mockParseValueTokensInput = jest.fn();
const mockValidateBindings = jest.fn();
const mockComputeGlobalTypeInferenceForState = jest.fn((state) => state);
const mockParseBooleanExpr = jest.fn();

jest.mock('../../components/hooks/useValueTokensInput', () => ({
  useValueTokensInput: () => ({ parseValueTokensInput: mockParseValueTokensInput }),
}));

jest.mock('../../components/hooks/useBindingsInput', () => ({
  useBindingsInput: () => ({ validateBindings: mockValidateBindings }),
}));

jest.mock('../../components/hooks/useGlobalTypeInference', () => ({
  computeGlobalTypeInferenceForState: jest.fn((state) => mockComputeGlobalTypeInferenceForState(state)),
}));

jest.mock('../../utils/z3-arith', () => ({
  parseBooleanExpr: jest.fn((...args) => mockParseBooleanExpr(...args)),
}));

const { computeGlobalTypeInferenceForState } = jest.requireMock('../../components/hooks/useGlobalTypeInference');
const { parseBooleanExpr } = jest.requireMock('../../utils/z3-arith');

import PropertiesPanel from '../../components/PropertiesPanel';

describe('PropertiesPanel behavior details', () => {
  const setElements = jest.fn();
  const updateHistory = jest.fn();

  const baseElements = {
    places: [{ id: 'place-1', tokens: 2, valueTokens: [1, 2], label: 'P1' }],
    transitions: [{ id: 'transition-1', guard: '', label: 'T1' }],
    arcs: [{ id: 'arc-1', source: 'place-1', bindings: ['x'], label: 'A1' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockParseValueTokensInput.mockReset();
    mockValidateBindings.mockReset();
    mockComputeGlobalTypeInferenceForState.mockReset();
    mockParseBooleanExpr.mockReset();
    computeGlobalTypeInferenceForState.mockImplementation((state) => mockComputeGlobalTypeInferenceForState(state));
    parseBooleanExpr.mockImplementation((...args) => mockParseBooleanExpr(...args));
  });

  function renderPanel(props) {
    return render(
      <PropertiesPanel
        elements={baseElements}
        simulationSettings={{ netMode: 'algebraic-int' }}
        setElements={setElements}
        updateHistory={updateHistory}
        {...props}
      />
    );
  }

  test('clears algebraic tokens when input emptied', () => {
    const selected = { id: 'place-1', type: 'place', label: 'P1' };
    renderPanel({ selectedElement: selected });

    const input = screen.getByPlaceholderText("e.g., 2, 3, 'hello', T, F, (1, 2), [1, 2, 3]");
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);

    expect(setElements).toHaveBeenCalledTimes(1);
    const updater = setElements.mock.calls[0][0];
    const result = updater({ places: [{ id: 'place-1', tokens: 5, valueTokens: [1, 2] }], transitions: [], arcs: [] });
    expect(result.places[0].tokens).toBe(0);
    expect(result.places[0].valueTokens).toEqual([]);
    expect(updateHistory).toHaveBeenCalledTimes(1);
  });

  test('parses algebraic tokens and triggers type inference', () => {
    mockParseValueTokensInput.mockReturnValue(['a', 'b']);
    mockComputeGlobalTypeInferenceForState.mockReturnValue({ mutated: true });
    const selected = { id: 'place-1', type: 'place', label: 'P1' };
    renderPanel({ selectedElement: selected });

    const input = screen.getByPlaceholderText("e.g., 2, 3, 'hello', T, F, (1, 2), [1, 2, 3]");
    fireEvent.change(input, { target: { value: "'a', 'b'" } });
    fireEvent.blur(input);

    expect(mockParseValueTokensInput).toHaveBeenCalledWith("'a', 'b'");
    expect(setElements).toHaveBeenCalledTimes(1);
    const inferenceUpdater = setElements.mock.calls[0][0];
    inferenceUpdater(baseElements);
    expect(mockComputeGlobalTypeInferenceForState).toHaveBeenCalledTimes(1);
    expect(updateHistory).toHaveBeenCalledTimes(1);
  });

  test('shows binding validation error when arc input invalid', () => {
    mockValidateBindings.mockReturnValue({ ok: false, error: 'bad binding' });
    const selected = { id: 'arc-1', type: 'arc', label: 'A1' };
    renderPanel({ selectedElement: selected });

    const input = screen.getByPlaceholderText('e.g., x, y, (a, b)');
    fireEvent.change(input, { target: { value: 'invalid' } });
    fireEvent.blur(input);

    expect(screen.getByText('bad binding')).toBeInTheDocument();
    expect(setElements).not.toHaveBeenCalled();
  });

  test('updates bindings and re-runs type inference on success', () => {
    mockValidateBindings.mockReturnValue({ ok: true, bindings: ['x:int'], error: null });
    mockComputeGlobalTypeInferenceForState.mockReturnValue({ updated: true });
    const selected = { id: 'arc-1', type: 'arc', label: 'A1' };
    renderPanel({ selectedElement: selected });

    const input = screen.getByPlaceholderText('e.g., x, y, (a, b)');
    fireEvent.change(input, { target: { value: 'x:int' } });
    fireEvent.blur(input);

    expect(mockValidateBindings).toHaveBeenCalledWith('x:int');
    expect(setElements).toHaveBeenCalledTimes(2);
    const inferenceUpdater = setElements.mock.calls[1][0];
    inferenceUpdater(baseElements);
    expect(mockComputeGlobalTypeInferenceForState).toHaveBeenCalledTimes(1);
    expect(updateHistory).toHaveBeenCalledTimes(2);
  });

  test('persists guard when valid expression supplied', () => {
    mockParseBooleanExpr.mockReturnValue({});
    mockComputeGlobalTypeInferenceForState.mockReturnValue({ withGuard: true });
    const selected = { id: 'transition-1', type: 'transition', label: 'T1' };
    renderPanel({ selectedElement: selected });

    const input = screen.getByPlaceholderText("e.g., x > 0 and y < 10");
    fireEvent.change(input, { target: { value: 'x > 0' } });
    fireEvent.blur(input);

    expect(mockParseBooleanExpr).toHaveBeenCalledWith('x > 0', expect.any(Function));
    expect(setElements).toHaveBeenCalledTimes(2);
    const inferenceUpdater = setElements.mock.calls[1][0];
    inferenceUpdater(baseElements);
    expect(mockComputeGlobalTypeInferenceForState).toHaveBeenCalledTimes(1);
    expect(updateHistory).toHaveBeenCalledTimes(2);
  });

  test('shows guard error when boolean expression invalid', () => {
    mockParseBooleanExpr.mockImplementation(() => { throw new Error('syntax'); });
    const selected = { id: 'transition-1', type: 'transition', label: 'T1' };
    renderPanel({ selectedElement: selected });

    const input = screen.getByPlaceholderText("e.g., x > 0 and y < 10");
    fireEvent.change(input, { target: { value: 'bad guard' } });
    fireEvent.blur(input);

    expect(screen.getByText('Invalid guard: syntax')).toBeInTheDocument();
    expect(setElements).not.toHaveBeenCalled();
  });
});


