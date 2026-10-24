import React from 'react';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import ExamplesDialog from '../../components/ExamplesDialog.jsx';
import useToolbarActions from '../../components/toolbar/useToolbarActions.jsx';
import { inventoryExamples } from '../../satel/examples/inventory/editor.js';

jest.mock('../../features/simulation', () => ({ simulatorCore: {} }));

test('searching Inventory exposes the references and mutants and selects their stable IDs', () => {
  const onSelectExample = jest.fn(), onClose = jest.fn();
  render(<ExamplesDialog isOpen onSelectExample={onSelectExample} onClose={onClose} />);
  fireEvent.change(screen.getByPlaceholderText('Name, type, or fault'), { target: { value: 'Inventory' } });
  for (const example of inventoryExamples) expect(screen.getByTestId(`example-${example.filename}`)).toBeTruthy();
  fireEvent.click(screen.getByTestId('example-inventory-large-reference'));
  expect(onSelectExample).toHaveBeenCalledWith('inventory-large-reference');
  expect(onClose).toHaveBeenCalled();
});

test.each(['inventory-large-reference', 'inventory-large-missing-cancel'])('%s loads methods and intention through the real toolbar route', async filename => {
  const params = { setElements: jest.fn(), setSimulationSettings: jest.fn(), setError: jest.fn(),
    forceSimulatorReset: jest.fn(), updateHistory: jest.fn() };
  const { result } = renderHook(() => useToolbarActions(params));
  await act(async () => { await result.current.handleLoadExample(filename); });
  expect(params.setError).toHaveBeenCalledTimes(1);
  expect(params.setError).toHaveBeenCalledWith(null);
  expect(params.forceSimulatorReset).toHaveBeenCalledTimes(1);
  const net = params.setElements.mock.calls[0][0];
  expect(net.satelExample.id).toBe(filename);
  expect(net.testIntentions[0].symbolic.protocolSource.match(/^pair /gm)).toHaveLength(20);
  expect(net.testIntentions[0].branchingProperty.op).toBe('and');
  expect(params.setSimulationSettings.mock.calls[0][0]({ netMode: 'pt' }).netMode).toBe('algebraic');
});
