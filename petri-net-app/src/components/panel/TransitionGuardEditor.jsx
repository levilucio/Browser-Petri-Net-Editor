import React from 'react';

const TransitionGuardEditor = ({ guardText, guardError, onGuardChange, onGuardBlur }) => {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">Guard</label>
      <input
        type="text"
        value={guardText}
        onChange={onGuardChange}
        onBlur={onGuardBlur}
        className={`w-full px-3 py-2 border rounded-md font-mono text-sm ${guardError ? 'border-red-500' : 'border-gray-300'}`}
        placeholder="e.g., x > 0 and y < 10"
      />
      {guardError && (
        <p className="text-red-600 text-xs mt-1">{guardError}</p>
      )}
    </div>
  );
};

export default TransitionGuardEditor;
