import React, { useState, useEffect } from 'react';

const PropertiesPanel = ({ selectedElement, elements, setElements, updateHistory, simulationSettings }) => {
  // Local state for form values to provide immediate feedback
  const [formValues, setFormValues] = useState({
    label: '',
    tokens: 0,
    weight: 1
  });

  // Update local state when selected element changes
  useEffect(() => {
    if (selectedElement) {
      setFormValues({
        label: selectedElement.label || '',
        tokens: selectedElement.tokens || 0,
        weight: selectedElement.weight !== undefined ? selectedElement.weight : 1
      });
    }
  }, [selectedElement]);

  if (!selectedElement) {
    return (
      <div className="properties-panel w-64 p-4 bg-gray-50 border-l border-gray-300 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Properties</h2>
        <p className="text-gray-500">Select an element to edit its properties</p>
      </div>
    );
  }

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
    // Get the actual element ID
    const elementId = selectedElement ? selectedElement.id : '';
    
    // Check if this is an arc by looking at the ID prefix
    if (!elementId || !elementId.startsWith('arc-')) return;
    
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
    // Get the actual element ID
    const elementId = selectedElement ? selectedElement.id : '';
    
    // Check if this is an arc by looking at the ID prefix
    if (!elementId || !elementId.startsWith('arc-')) return;
    
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
  
  // Determine if token count is valid
  const isTokenCountValid = elementType === 'place' && 
    (formValues.tokens === '' || (parseInt(formValues.tokens, 10) >= 0 && parseInt(formValues.tokens, 10) <= maxTokens));

  // Determine if weight is valid
  const isWeightValid = elementType === 'arc' && 
    (formValues.weight === '' || (parseInt(formValues.weight, 10) >= 1 && parseInt(formValues.weight, 10) <= maxTokens));

  return (
    <div className="properties-panel w-64 p-4 bg-gray-50 border-l border-gray-300 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4">Properties</h2>
      
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

      {elementType === 'place' && (
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

      {elementType === 'arc' && (
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


    </div>
  );
};

export default PropertiesPanel;
