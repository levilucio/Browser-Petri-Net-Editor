import React from 'react';

const PlaceProperties = ({ mode, tokens, valueTokensInput, onTokensChange, onValueTokensChange, onValueTokensBlur }) => {
  if (mode === 'pt') {
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Tokens (PT mode)</label>
        <input
          type="number"
          min="0"
          value={tokens}
          onChange={onTokensChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    );
  }
  if (mode === 'algebraic-int') {
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Algebraic Tokens</label>
        <input
          type="text"
          value={valueTokensInput}
          onChange={onValueTokensChange}
          onBlur={onValueTokensBlur}
          className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
          placeholder="e.g., 2, 3, 'hello', T, F, (1, 2), [1, 2, 3]"
        />
      </div>
    );
  }
  return null;
};

export default PlaceProperties;
