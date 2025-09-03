import React, { useState, useEffect, useContext } from 'react';
import { PetriNetContext } from '../contexts/PetriNetContext';
import { parseArithmetic } from '../utils/arith-parser';

const PropertiesPanel = ({ selectedElement, elements, setElements, updateHistory, simulationSettings }) => {
  // Read enabled transitions from context (fallback to defaults if no provider in unit tests)
  const context = useContext(PetriNetContext) || {};
  const enabledTransitionIds = context.enabledTransitionIds || [];
  const isSimulatorReady = context.isSimulatorReady || false;

  // Local state for form values to provide immediate feedback
  const [formValues, setFormValues] = useState({
    label: '',
    tokens: 0,
    weight: 1,
    valueTokensInput: '',
    bindingsInput: '',
    bindingError: null,
    guardText: '',
    guardError: null
  });

  // State for markings/enabled panels moved to PetriNetPanel

  // Update local state when selected element changes
  useEffect(() => {
    if (selectedElement) {
      const elementId = selectedElement.id || (selectedElement.element && selectedElement.element.id) || '';
      const elementType = selectedElement.type || (elementId.split('-')[0]);
      setFormValues((prev) => ({
        ...prev,
        label: selectedElement.label || '',
        tokens: selectedElement.tokens || 0,
        weight: selectedElement.weight !== undefined ? selectedElement.weight : 1,
        valueTokensInput: Array.isArray(selectedElement.valueTokens) ? selectedElement.valueTokens.join(', ') : '',
        bindingsInput: elementType === 'arc' && Array.isArray(selectedElement.bindings) ? selectedElement.bindings.join(', ') : '',
        guardText: elementType === 'transition' ? (selectedElement.guard || '') : ''
      }));
    }
  }, [selectedElement]);

  // Do not early-return; we want markings and enabled transitions to always render

  const handleLabelChange = (e) => {
    const newLabel = e.target.value;
    // Update local state for immediate feedback
    setFormValues(prev => ({ ...prev, label: newLabel }));
    
    // Get the actual element ID, handling both direct and nested structures
    const elementId = selectedElement.id || (selectedElement.element && selectedElement.element.id) || '';
    const elementType = selectedElement.type || (elementId.split('-')[0]);
    
    // Update the global state
    if (elementType === 'place') {
      setElements(prev => ({
        ...prev,
        places: prev.places.map(place => 
          place.id === elementId ? { ...place, label: newLabel } : place
        )
      }));
    } else if (elementType === 'transition') {
      setElements(prev => ({
        ...prev,
        transitions: prev.transitions.map(transition => 
          transition.id === elementId ? { ...transition, label: newLabel } : transition
        )
      }));
    } else if (elementType === 'arc') {
      setElements(prev => ({
        ...prev,
        arcs: prev.arcs.map(arc => 
          arc.id === elementId ? { ...arc, label: newLabel } : arc
        )
      }));
    }
  };

  const handleTokensChange = (e) => {
    // Get the actual element ID and type
    const elementId = selectedElement.id || (selectedElement.element && selectedElement.element.id) || '';
    const elementType = selectedElement.type || (elementId.split('-')[0]);
    
    if (elementType !== 'place') return;
    
    // Get the raw input value
    const inputValue = e.target.value;
    
    // Handle empty input
    if (inputValue === '') {
      setFormValues(prev => ({ ...prev, tokens: '' }));
      return;
    }
    
    // Only allow integer values
    const value = inputValue.replace(/[^0-9]/g, '');
    
    // Allow the user to type any number, but don't update the model until it's valid
    setFormValues(prev => ({ ...prev, tokens: value }));
    
    // If the value is valid, update the model
    if (value !== '') {
      const tokens = parseInt(value, 10);
      
      // Get max tokens from simulation settings or use default 20
      const maxTokens = simulationSettings?.maxTokens || 20;
      
      // Validate token count (0-maxTokens)
      const validTokens = Math.min(Math.max(tokens, 0), maxTokens);
      
      // Update the global state
      setElements(prev => ({
        ...prev,
        places: prev.places.map(place => 
          place.id === elementId ? { ...place, tokens: validTokens } : place
        )
      }));
    }
  };
  
  // Handle blur event for token input to ensure a valid value is set
  const handleTokensBlur = () => {
    // Get the actual element ID and type
    const elementId = selectedElement.id || (selectedElement.element && selectedElement.element.id) || '';
    const elementType = selectedElement.type || (elementId.split('-')[0]);
    
    // If the field is empty or invalid when focus is lost, set to 0
    if (formValues.tokens === '') {
      setFormValues(prev => ({ ...prev, tokens: 0 }));
      
      if (elementType === 'place') {
        setElements(prev => ({
          ...prev,
          places: prev.places.map(place => 
            place.id === elementId ? { ...place, tokens: 0 } : place
          )
        }));
      }
    }
  };

  const handleWeightChange = (e) => {
    // Get the actual element ID and type (support both direct and nested structures)
    const elementId = selectedElement ? (selectedElement.id || (selectedElement.element && selectedElement.element.id) || '') : '';
    const elementType = selectedElement ? (selectedElement.type || (elementId && elementId.split('-')[0])) : '';
    
    // Only handle weight changes for arcs
    if (!elementId || elementType !== 'arc') return;
    
    // Get the raw input value
    const inputValue = e.target.value;
    
    // Handle empty input as 1 (minimum valid weight)
    if (inputValue === '') {
      setFormValues(prev => ({ ...prev, weight: '' }));
      return;
    }
    
    // Only allow integer values
    const value = inputValue.replace(/[^0-9]/g, '');
    
    // Allow the user to type any number, but don't update the model until it's valid
    setFormValues(prev => ({ ...prev, weight: value }));
    
    // If the value is valid, update the model
    if (value !== '') {
      const weight = parseInt(value, 10);
      
      // Get max tokens from simulation settings or use default 20
      const maxTokens = simulationSettings?.maxTokens || 20;
      
      // Validate weight (1-maxTokens)
      const validWeight = Math.min(Math.max(weight, 1), maxTokens);
      
      // Update the global state
      setElements(prev => {
        const newState = {
          ...prev,
          arcs: prev.arcs.map(arc => 
            arc.id === elementId ? { ...arc, weight: validWeight } : arc
          )
        };
        
        // Add to history
        updateHistory(newState);
        
        return newState;
      });
    }
  };
  
  // Handle blur event for weight input to ensure a valid value is set
  const handleWeightBlur = () => {
    // Get the actual element ID and type (support both direct and nested structures)
    const elementId = selectedElement ? (selectedElement.id || (selectedElement.element && selectedElement.element.id) || '') : '';
    const elementType = selectedElement ? (selectedElement.type || (elementId && elementId.split('-')[0])) : '';
    
    // Only handle for arcs
    if (!elementId || elementType !== 'arc') return;
    
    // If the field is empty or invalid when focus is lost, set to minimum valid value (1)
    if (formValues.weight === '' || parseInt(formValues.weight, 10) < 1) {
      setFormValues(prev => ({ ...prev, weight: 1 }));
      
      setElements(prev => {
        const newState = {
          ...prev,
          arcs: prev.arcs.map(arc => 
            arc.id === elementId ? { ...arc, weight: 1 } : arc
          )
        };
        
        // Add to history
        updateHistory(newState);
        
        return newState;
      });
    }
  };

  // Get max tokens from simulation settings or use default 20
  const maxTokens = simulationSettings?.maxTokens || 20;

  // Get the actual element ID, handling both direct and nested structures
  const elementId = selectedElement ? (selectedElement.id || (selectedElement.element && selectedElement.element.id) || '') : '';
  // Extract element type from ID (place-123, transition-456, arc-789)
  const elementType = selectedElement ? (selectedElement.type || (elementId && elementId.split('-')[0])) : '';
  const netMode = simulationSettings?.netMode || 'pt';
  
  // Determine if token count is valid
  const isTokenCountValid = elementType === 'place' && 
    (formValues.tokens === '' || (parseInt(formValues.tokens, 10) >= 0 && parseInt(formValues.tokens, 10) <= maxTokens));

  // Determine if weight is valid
  const isWeightValid = elementType === 'arc' && 
    (formValues.weight === '' || (parseInt(formValues.weight, 10) >= 1 && parseInt(formValues.weight, 10) <= maxTokens));

  return (
    <div className="properties-panel w-full px-4 py-2 overflow-y-auto mx-0">
      <h2 className="text-lg font-semibold mb-4">Properties</h2>

      {!selectedElement && (
        <p className="text-gray-500 mb-4">Select an element to edit its properties</p>
      )}

      {selectedElement && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Label
          </label>
          <input
            type="text"
            value={formValues.label}
            onChange={handleLabelChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder={elementType === 'place' ? 'P1, P2, etc.' : 
                        elementType === 'transition' ? 'T1, T2, etc.' : 'Arc label'}
          />
        </div>
      )}

      {selectedElement && elementType === 'place' && netMode === 'pt' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tokens (0-{maxTokens})
          </label>
          <input
            type="number"
            min="0"
            max={maxTokens}
            value={formValues.tokens}
            onChange={handleTokensChange}
            onBlur={handleTokensBlur}
            data-testid="tokens-input"
            className={`w-full px-3 py-2 border ${isTokenCountValid ? 'border-gray-300' : 'border-red-500'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
          />
          {!isTokenCountValid && (
            <p className="text-red-500 text-xs mt-1">Token count must be between 0 and {maxTokens}</p>
          )}
        </div>
      )}

      {selectedElement && elementType === 'place' && netMode === 'algebraic-int' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Algebraic Tokens</label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
            value={formValues.valueTokensInput}
            onChange={(e) => {
              const raw = e.target.value;
              setFormValues(prev => ({ ...prev, valueTokensInput: raw }));
              // Live-parse integers as user types
              const parsed = String(raw || '')
                .split(',')
                .map(s => s.trim())
                .filter(s => s.length > 0)
                .map(s => Number.parseInt(s, 10))
                .filter(n => Number.isFinite(n));
              setElements(prev => ({
                ...prev,
                places: prev.places.map(p => p.id === elementId ? { ...p, valueTokens: parsed, tokens: parsed.length } : p)
              }));
            }}
            placeholder="e.g., 2, 3, 4"
          />
        </div>
      )}

      {selectedElement && elementType === 'arc' && netMode === 'pt' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Weight (1-{maxTokens})
          </label>
          <input
            type="number"
            min="1"
            max={maxTokens}
            value={formValues.weight}
            onChange={handleWeightChange}
            onBlur={handleWeightBlur}
            className={`w-full px-3 py-2 border ${isWeightValid ? 'border-gray-300' : 'border-red-500'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
          />
          {!isWeightValid && (
            <p className="text-red-500 text-xs mt-1">Weight must be between 1 and {maxTokens}</p>
          )}
        </div>
      )}

      {selectedElement && elementType === 'arc' && netMode === 'algebraic-int' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Bindings</label>
          <input
            type="text"
            value={formValues.bindingsInput}
            onChange={(e) => {
              const raw = e.target.value;
              const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
              let err = null;
              for (const p of parts) {
                try { if (p) parseArithmetic(p); } catch (ex) { err = String(ex.message || ex); break; }
              }
              setFormValues(prev => ({ ...prev, bindingsInput: raw, bindingError: err }));
              if (!err) {
                setElements(prev => ({
                  ...prev,
                  arcs: prev.arcs.map(a => a.id === elementId ? { ...a, bindings: parts, binding: undefined } : a)
                }));
              }
            }}
            className={`w-full px-3 py-2 border ${formValues.bindingError ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm font-mono text-sm`}
            placeholder="e.g., x, y+2, z-1"
          />
          {formValues.bindingError && <p className="text-red-500 text-xs mt-1">{formValues.bindingError}</p>}
        </div>
      )}

      {selectedElement && elementType === 'transition' && netMode === 'algebraic-int' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Guard (equality/inequality)</label>
          <input
            type="text"
            value={formValues.guardText}
            onChange={(e) => {
              const v = e.target.value;
              // Basic syntax check: must contain a comparison operator
              let err = null;
              const ops = ['==', '!=', '>=', '<=', '>', '<'];
              if (!ops.some(op => v.includes(op))) {
                err = 'Guard must include a comparison operator (==, !=, <, <=, >, >=)';
              } else {
                try {
                  const op = ops.find(op => v.includes(op));
                  const [lhs, rhs] = v.split(op);
                  parseArithmetic(lhs);
                  parseArithmetic(rhs);
                } catch (ex) { err = String(ex.message || ex); }
              }
              setFormValues(prev => ({ ...prev, guardText: v, guardError: err }));
              setElements(prev => ({
                ...prev,
                transitions: prev.transitions.map(t => t.id === elementId ? { ...t, guard: v } : t)
              }));
            }}
            className={`w-full px-3 py-2 border ${formValues.guardError ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm font-mono text-sm`}
            placeholder="e.g., x + y >= 3"
          />
          {formValues.guardError && <p className="text-red-500 text-xs mt-1">{formValues.guardError}</p>}
        </div>
      )}

      {/* Petri Net panel is rendered separately in the right sidebar */}
    </div>
  );
};

export default PropertiesPanel;
