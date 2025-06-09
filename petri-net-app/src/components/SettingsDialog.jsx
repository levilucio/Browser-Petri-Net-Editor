import React, { useState, useEffect } from 'react';

/**
 * Settings dialog component for configuring simulation parameters
 */
const SettingsDialog = ({ isOpen, onClose, settings, onSave }) => {
  const [maxIterations, setMaxIterations] = useState(settings.maxIterations);
  const [isInfinite, setIsInfinite] = useState(settings.maxIterations === Infinity);
  const [maxTokens, setMaxTokens] = useState(settings.maxTokens || 20);
  
  // Update local state when settings prop changes
  useEffect(() => {
    setMaxIterations(settings.maxIterations === Infinity ? 100 : settings.maxIterations);
    setIsInfinite(settings.maxIterations === Infinity);
    setMaxTokens(settings.maxTokens || 20);
  }, [settings]);
  
  // Handle save button click
  const handleSave = () => {
    onSave({
      maxIterations: isInfinite ? Infinity : Math.max(1, maxIterations),
      maxTokens: Math.max(1, maxTokens)
    });
    onClose();
  };
  
  // Handle cancel button click
  const handleCancel = () => {
    // Reset to original values
    setMaxIterations(settings.maxIterations === Infinity ? 100 : settings.maxIterations);
    setIsInfinite(settings.maxIterations === Infinity);
    onClose();
  };
  
  // Handle max iterations input change
  const handleMaxIterationsChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      setMaxIterations(value);
    }
  };
  
  // Handle infinite checkbox change
  const handleInfiniteChange = (e) => {
    setIsInfinite(e.target.checked);
  };

  // Handle max tokens input change
  const handleMaxTokensChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      setMaxTokens(Math.max(1, value));
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-full">
        <h2 className="text-xl font-bold mb-4">Simulation Settings</h2>
        
        <div className="mb-4">
          <label className="block mb-2 font-medium">Maximum Iterations</label>
          <div className="flex items-center mb-2">
            <input
              type="checkbox"
              id="infinite-iterations"
              checked={isInfinite}
              onChange={handleInfiniteChange}
              className="mr-2"
            />
            <label htmlFor="infinite-iterations">Infinite</label>
          </div>
          
          {!isInfinite && (
            <input
              type="number"
              value={maxIterations}
              onChange={handleMaxIterationsChange}
              min="1"
              className="border border-gray-300 rounded px-3 py-2 w-full"
              disabled={isInfinite}
            />
          )}
          
          <p className="text-sm text-gray-500 mt-1">
            {isInfinite 
              ? "The simulation will run until no transitions are enabled."
              : "The simulation will stop after this many iterations or when no transitions are enabled."}
          </p>
        </div>

        <div className="mb-4">
          <label className="block mb-2 font-medium">Maximum Tokens per Place</label>
          <input
            type="number"
            value={maxTokens}
            onChange={handleMaxTokensChange}
            min="1"
            className="border border-gray-300 rounded px-3 py-2 w-full"
          />
          <p className="text-sm text-gray-500 mt-1">
            Places and arcs will be limited to this maximum number of tokens.
          </p>
        </div>
        
        <div className="flex justify-end space-x-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsDialog;
