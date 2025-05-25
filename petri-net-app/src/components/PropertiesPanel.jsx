import React, { useState, useEffect } from 'react';

const PropertiesPanel = ({ selectedElement, setElements }) => {
  // Local state for form values to provide immediate feedback
  const [formValues, setFormValues] = useState({
    name: '',
    tokens: 0,
    weight: 1
  });

  // Update local state when selected element changes
  useEffect(() => {
    if (selectedElement) {
      setFormValues({
        name: selectedElement.name || '',
        tokens: selectedElement.tokens || 0,
        weight: selectedElement.weight || 1
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

  const handleNameChange = (e) => {
    const newName = e.target.value;
    // Update local state for immediate feedback
    setFormValues(prev => ({ ...prev, name: newName }));
    
    // Update the global state
    if (selectedElement.id.startsWith('place')) {
      setElements(prev => ({
        ...prev,
        places: prev.places.map(place => 
          place.id === selectedElement.id ? { ...place, name: newName } : place
        )
      }));
    } else if (selectedElement.id.startsWith('transition')) {
      setElements(prev => ({
        ...prev,
        transitions: prev.transitions.map(transition => 
          transition.id === selectedElement.id ? { ...transition, name: newName } : transition
        )
      }));
    } else if (selectedElement.id.startsWith('arc')) {
      setElements(prev => ({
        ...prev,
        arcs: prev.arcs.map(arc => 
          arc.id === selectedElement.id ? { ...arc, name: newName } : arc
        )
      }));
    }
  };

  const handleTokensChange = (e) => {
    if (!selectedElement.id.startsWith('place')) return;
    
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
      
      // Validate token count (0-20)
      const validTokens = Math.min(Math.max(tokens, 0), 20);
      
      // Update the global state
      setElements(prev => ({
        ...prev,
        places: prev.places.map(place => 
          place.id === selectedElement.id ? { ...place, tokens: validTokens } : place
        )
      }));
    }
  };
  
  // Handle blur event for token input to ensure a valid value is set
  const handleTokensBlur = () => {
    // If the field is empty or invalid when focus is lost, set to 0
    if (formValues.tokens === '') {
      setFormValues(prev => ({ ...prev, tokens: 0 }));
      
      setElements(prev => ({
        ...prev,
        places: prev.places.map(place => 
          place.id === selectedElement.id ? { ...place, tokens: 0 } : place
        )
      }));
    }
  };

  const handleWeightChange = (e) => {
    if (!selectedElement.id.startsWith('arc')) return;
    
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
      
      // Validate weight (1-20)
      const validWeight = Math.min(Math.max(weight, 1), 20);
      
      // Update the global state
      setElements(prev => ({
        ...prev,
        arcs: prev.arcs.map(arc => 
          arc.id === selectedElement.id ? { ...arc, weight: validWeight } : arc
        )
      }));
    }
  };
  
  // Handle blur event for weight input to ensure a valid value is set
  const handleWeightBlur = () => {
    // If the field is empty or invalid when focus is lost, set to minimum valid value (1)
    if (formValues.weight === '' || parseInt(formValues.weight, 10) < 1) {
      setFormValues(prev => ({ ...prev, weight: 1 }));
      
      setElements(prev => ({
        ...prev,
        arcs: prev.arcs.map(arc => 
          arc.id === selectedElement.id ? { ...arc, weight: 1 } : arc
        )
      }));
    }
  };

  // Determine if token count is valid
  const isTokenCountValid = selectedElement.id.startsWith('place') && 
    (formValues.tokens === '' || (parseInt(formValues.tokens, 10) >= 0 && parseInt(formValues.tokens, 10) <= 20));

  // Determine if weight is valid
  const isWeightValid = selectedElement.id.startsWith('arc') && 
    (formValues.weight === '' || (parseInt(formValues.weight, 10) >= 1 && parseInt(formValues.weight, 10) <= 20));

  return (
    <div className="properties-panel w-64 p-4 bg-gray-50 border-l border-gray-300 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4">Properties</h2>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          type="text"
          value={formValues.name}
          onChange={handleNameChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder={selectedElement.id.startsWith('place') ? 'Place name' : 
                      selectedElement.id.startsWith('transition') ? 'Transition name' : 'Arc name'}
        />
      </div>

      {selectedElement.id.startsWith('place') && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tokens (0-20)
          </label>
          <input
            type="number"
            min="0"
            max="20"
            value={formValues.tokens}
            onChange={handleTokensChange}
            onBlur={handleTokensBlur}
            data-testid="tokens-input"
            className={`w-full px-3 py-2 border ${isTokenCountValid ? 'border-gray-300' : 'border-red-500'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
          />
          {!isTokenCountValid && (
            <p className="text-red-500 text-xs mt-1">Token count must be between 0 and 20</p>
          )}
        </div>
      )}

      {selectedElement.id.startsWith('arc') && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Weight (1-20)
          </label>
          <input
            type="number"
            min="1"
            max="20"
            value={formValues.weight}
            onChange={handleWeightChange}
            onBlur={handleWeightBlur}
            className={`w-full px-3 py-2 border ${isWeightValid ? 'border-gray-300' : 'border-red-500'} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500`}
          />
          {!isWeightValid && (
            <p className="text-red-500 text-xs mt-1">Weight must be between 1 and 20</p>
          )}
        </div>
      )}


    </div>
  );
};

export default PropertiesPanel;
