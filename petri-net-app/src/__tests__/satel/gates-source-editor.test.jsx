import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { PetriNetContext } from '../../contexts/PetriNetContext';
import MethodGateSourceEditor from '../../components/satel/MethodGateSourceEditor';
import { createMethodGateExample } from '../../satel/examples/methods-gates/editor';
import ObservationEditor from '../../components/satel/ObservationEditor';
import { observationChannels } from '../../domain/apn/Gates';

test('source editor applies validated gates, preserves intentions and resets the simulator',()=>{
 const elements=createMethodGateExample('gates-oracle-account-reference'), setElements=jest.fn(), reset=jest.fn(), history=jest.fn();
 render(<PetriNetContext.Provider value={{elements,setElements,forceSimulatorReset:reset,updateHistory:history}}><MethodGateSourceEditor/></PetriNetContext.Provider>);
 const input=screen.getByLabelText('APN class source');
 expect(input.value).toContain('Gates');expect(input.value).toContain('With this.ack');
 fireEvent.change(input,{target:{value:input.value.replace('this.ack (1)','this.ack (2)')}});
 fireEvent.click(screen.getByRole('button',{name:'Apply class'}));
 expect(setElements.mock.calls[0][0].transitions[0].gates[0].arguments).toEqual(['(2)']);
 expect(setElements.mock.calls[0][0].testIntentions).toEqual(elements.testIntentions);
 expect(reset).toHaveBeenCalled();expect(history).toHaveBeenCalled();
 fireEvent.change(input,{target:{value:input.value.replace('this.ack (2)','this.missing (2)')}});
 fireEvent.click(screen.getByRole('button',{name:'Apply class'}));
 expect(screen.getByRole('alert')).toHaveTextContent('Invalid gate call');expect(setElements).toHaveBeenCalledTimes(1);
});

test('gate output controls are distinct from state marking assertions',()=>{
 const net=createMethodGateExample('gates-oracle-account-reference');
 render(<ObservationEditor observation={{outputs:{ack:[1]}}} places={observationChannels(net)} pairNumber={1} onChange={()=>{}} onValidityChange={()=>{}}/>);
 expect(screen.getByText('Gate occurrences from this call')).toBeVisible();
 expect(screen.getByLabelText('Pair 1 check outputs at ack')).toBeChecked();
 expect(screen.queryByLabelText('Pair 1 marking check at ack')).toBeNull();
 expect(screen.getByLabelText('Pair 1 marking check at balance')).toBeDefined();
 expect(screen.queryByLabelText('Pair 1 check outputs at balance')).toBeNull();
});

test('unsupported models show an error without offering a fabricated empty replacement', () => {
 const elements = { mode: 'algebraic', places: [], arcs: [], transitions: [{ id: 'internal' }] }, setElements = jest.fn();
 render(<PetriNetContext.Provider value={{ elements, setElements }}><MethodGateSourceEditor /></PetriNetContext.Provider>);
 expect(screen.getByRole('alert')).toHaveTextContent('Cannot represent the current model');
 expect(screen.getByLabelText('APN class source')).toHaveValue('');
 expect(screen.getByRole('button', { name: 'Apply class' })).toBeDisabled();
 expect(setElements).not.toHaveBeenCalled();
});
