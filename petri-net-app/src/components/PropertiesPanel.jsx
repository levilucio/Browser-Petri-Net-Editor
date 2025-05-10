import React from 'react';

const PropertiesPanel = ({ selectedElement, setElements }) => {
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
    
    const tokens = parseInt(e.target.value) || 0;
    // Validate token count (0-20)
    const validTokens = Math.min(Math.max(tokens, 0), 20);
    
    setElements(prev => ({
      ...prev,
      places: prev.places.map(place => 
        place.id === selectedElement.id ? { ...place, tokens: validTokens } : place
      )
    }));
  };

  const handleWeightChange = (e) => {
    if (!selectedElement.id.startsWith('arc')) return;
    
    const weight = parseInt(e.target.value) || 1;
    // Validate weight (≥ 1)
    const validWeight = Math.max(weight, 1);
    
    setElements(prev => ({
      ...prev,
      arcs: prev.arcs.map(arc => 
        arc.id === selectedElement.id ? { ...arc, weight: validWeight } : arc
      )
    }));
  };

  return (
    <div className="properties-panel w-64 p-4 bg-gray-50 border-l border-gray-300 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4">Properties</h2>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          type="text"
          value={selectedElement.name || ''}
          onChange={handleNameChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
            value={selectedElement.tokens || 0}
            onChange={handleTokensChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {selectedElement.tokens > 20 && (
            <p className="text-red-500 text-xs mt-1">Token count exceeds 20</p>
          )}
        </div>
      )}

      {selectedElement.id.startsWith('arc') && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Weight (≥ 1)
          </label>
          <input
            type="number"
            min="1"
            value={selectedElement.weight || 1}
            onChange={handleWeightChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Position
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500">X</label>
            <input
              type="number"
              value={selectedElement.x || 0}
              disabled
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Y</label>
            <input
              type="number"
              value={selectedElement.y || 0}
              disabled
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertiesPanel;
