import React from 'react';

const ArcBindingsEditor = ({ mode, weight, bindingsInput, bindingError, onWeightChange, onBindingsChange, onBindingsBlur }) => {
  if (mode === 'pt') {
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
        <input
          type="number"
          min="1"
          value={weight}
          onChange={onWeightChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    );
  }
  if (mode === 'algebraic-int') {
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Bindings</label>
        <input
          type="text"
          value={bindingsInput}
          onChange={onBindingsChange}
          onBlur={onBindingsBlur}
          className={`w-full px-3 py-2 border rounded-md font-mono text-sm ${bindingError ? 'border-red-500' : 'border-gray-300'}`}
          placeholder="e.g., x, y, (a, b)"
        />
        {bindingError && (
          <p className="text-red-600 text-xs mt-1">{bindingError}</p>
        )}
      </div>
    );
  }
  return null;
};

export default ArcBindingsEditor;
