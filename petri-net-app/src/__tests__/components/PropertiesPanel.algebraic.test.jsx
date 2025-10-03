import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PropertiesPanel from '../../components/PropertiesPanel';

describe('PropertiesPanel (algebraic mode)', () => {
  const elementsEmpty = { places: [], transitions: [], arcs: [] };
  const simulationSettings = { netMode: 'algebraic-int', maxTokens: 20 };

  test('place: updates valueTokens and tokens from Algebraic Tokens input', () => {
    const setElements = jest.fn();
    const updateHistory = jest.fn();
    const selectedPlace = { id: 'place-1', label: 'P', tokens: 0, valueTokens: [], x: 0, y: 0 };

    render(
      <PropertiesPanel
        selectedElement={selectedPlace}
        elements={elementsEmpty}
        setElements={setElements}
        updateHistory={updateHistory}
        simulationSettings={simulationSettings}
      />
    );

    const input = screen.getByPlaceholderText("e.g., 2, 3, 'hello', T, F, (1, 2)");
    fireEvent.change(input, { target: { value: '2, 3, 5' } });
    fireEvent.blur(input);

    expect(setElements).toHaveBeenCalled();
    const updater = setElements.mock.calls[0][0];
    const newState = updater({ places: [{ id: 'place-1', tokens: 0 }], transitions: [], arcs: [] });
    expect(newState.places[0].valueTokens).toEqual([2, 3, 5]);
    expect(newState.places[0].tokens).toBe(3);
  });

  test('arc: validates and updates bindings array when expressions are valid', () => {
    const setElements = jest.fn();
    const updateHistory = jest.fn();
    const selectedArc = { id: 'arc-1', sourceId: 'place-1', targetId: 'transition-1', type: 'arc', bindings: [] };

    render(
      <PropertiesPanel
        selectedElement={selectedArc}
        elements={elementsEmpty}
        setElements={setElements}
        updateHistory={updateHistory}
        simulationSettings={simulationSettings}
      />
    );

    const input = screen.getByPlaceholderText('e.g., x:Int, (F,x:Int), y+2, z-1');
    fireEvent.change(input, { target: { value: 'x:Int, y+2, z-1' } });
    fireEvent.blur(input);

    expect(setElements).toHaveBeenCalled();
    const updater = setElements.mock.calls[0][0];
    const newState = updater({ places: [], transitions: [], arcs: [{ id: 'arc-1', bindings: [] }] });
    expect(newState.arcs[0].bindings).toEqual(['x:Int', 'y+2', 'z-1']);
  });

});


