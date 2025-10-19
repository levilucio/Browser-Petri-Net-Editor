import React from 'react';

const EnabledTransitionsPanel = ({ enabledTransitions, isLoading, isOpen, onClose, onFire }) => {
  if (!isOpen) return null;

  return (
    <div data-testid="enabled-transitions" className="enabled-transitions-panel mt-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-md font-semibold">Enabled Transitions</h3>
        <span
          onClick={onClose}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose && onClose(); } }}
          className="text-gray-500 hover:text-gray-800 cursor-pointer select-none"
          aria-label="Close enabled transitions panel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      </div>
      
      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : enabledTransitions.length === 0 ? (
        <p className="text-gray-500">No enabled transitions</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
          {enabledTransitions.map(transition => (
            <button
              key={transition.id}
              type="button"
              className="flex items-center text-left hover:bg-gray-100 rounded px-1 py-0.5"
              onClick={() => onFire && onFire(transition.id)}
              data-testid={`enabled-${transition.label || transition.id}`}
              title={transition.label || transition.id}
            >
              <span className="font-medium">{transition.label || transition.id.substring(11, 17)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EnabledTransitionsPanel;
