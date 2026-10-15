import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PublicMethodEditor from '../../components/panel/PublicMethodEditor';
import { getPublicMethods } from '../../features/simulation/PublicMethods';

test('editor declares a typed method and can make its rule internal again', () => {
  const transition = { id: 'rule', guard: 'n >= 0' };
  const elements = { places: [], transitions: [transition], arcs: [] };
  const setElements = jest.fn(), updateHistory = jest.fn();
  const view = render(<PublicMethodEditor transition={transition} elements={elements} setElements={setElements} updateHistory={updateHistory} />);
  fireEvent.change(screen.getByLabelText('Method name'), { target: { value: 'deposit' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add parameter' }));
  fireEvent.change(screen.getByLabelText('Parameter 1 name'), { target: { value: 'n' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save method' }));
  const saved = setElements.mock.calls[0][0];
  expect(getPublicMethods(saved)).toEqual([{ name: 'deposit', parameters: [{ name: 'n', sort: 'Nat' }], rules: ['rule'] }]);
  expect(updateHistory).toHaveBeenCalledWith(saved);
  view.rerender(<PublicMethodEditor transition={saved.transitions[0]} elements={saved} setElements={setElements} updateHistory={updateHistory} />);
  fireEvent.click(screen.getByRole('button', { name: 'Make internal' }));
  expect(getPublicMethods(setElements.mock.calls[1][0])).toEqual([]);
});

test('editor rejects an inconsistent shared method signature without changing the model', () => {
  const transition = { id: 'other' };
  const elements = { transitions: [{ id: 'first', method: { name: 'withdraw', parameters: [{ name: 'n', sort: 'Nat' }] } }, transition] };
  const setElements = jest.fn();
  render(<PublicMethodEditor transition={transition} elements={elements} setElements={setElements} />);
  fireEvent.change(screen.getByLabelText('Method name'), { target: { value: 'withdraw' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save method' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Inconsistent signatures');
  expect(setElements).not.toHaveBeenCalled();
});
