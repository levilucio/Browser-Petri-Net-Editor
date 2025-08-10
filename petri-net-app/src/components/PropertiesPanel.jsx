import React, { useState, useEffect } from 'react';

const PropertiesPanel = ({ selectedElement, elements, setElements, updateHistory, simulationSettings }) => {
  // Local state for form values to provide immediate feedback
  const [formValues, setFormValues] = useState({
    label: '',
    tokens: 0,
    weight: 1
  });

  // State for markings panel
  const [isMarkingsPanelOpen, setIsMarkingsPanelOpen] = useState(false);

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
      <div className="properties-panel w-full px-4 py-2 overflow-y-auto mx-0">
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
    <div className="properties-panel w-full px-4 py-2 overflow-y-auto mx-0">
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

      {/* Markings Panel Section */}
      <div className="border-t border-gray-200 pt-4 mt-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-md font-semibold text-gray-700">Current Markings</h3>
          <button
            data-testid="toggle-markings"
            className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm flex items-center space-x-1 transition-colors"
            onClick={() => setIsMarkingsPanelOpen(!isMarkingsPanelOpen)}
          >
            <span>{isMarkingsPanelOpen ? 'Hide' : 'Show'}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </button>
        </div>
        
        {isMarkingsPanelOpen && (
          <div data-testid="current-marking" className="markings-panel p-3 bg-gray-50 border border-gray-200 rounded-md">
            {elements.places.length === 0 ? (
              <p className="text-gray-500 text-sm">No places defined</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {elements.places.map(place => (
                  <div key={place.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      {place.label || place.name || place.id.substring(6, 12)}:
                    </span>
                    <span className="font-bold text-purple-600">{place.tokens || 0}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertiesPanel;
