import React from 'react';

const MarkingsPanel = ({ places, isLoading, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div data-testid="current-marking" className="markings-panel mt-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-md font-semibold">Current Markings</h3>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-gray-800"
          aria-label="Close markings panel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : places.length === 0 ? (
        <p className="text-gray-500">No places defined</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
          {places.map(place => (
            <div key={place.id} className="flex items-center">
              <span className="font-medium mr-2">{place.label || place.id.substring(6, 12)}:</span>
              <span>{place.tokens || 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MarkingsPanel;
