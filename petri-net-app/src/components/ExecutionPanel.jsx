import React from 'react';

const ExecutionPanel = ({ elements }) => {
  const { places, transitions, arcs } = elements;
  
  // In a real implementation, this would compute enabled transitions
  // based on the current marking (token distribution)
  const enabledTransitions = [];
  
  return (
    <div className="execution-panel p-4 bg-gray-100 border-t border-gray-300">
      <h2 className="text-lg font-semibold mb-2">Execution</h2>
      
      <div className="flex">
        <div className="current-marking mr-8">
          <h3 className="text-sm font-medium mb-2">Current Marking</h3>
          {places.length === 0 ? (
            <p className="text-gray-500">No places defined</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {places.map(place => (
                <div key={place.id} className="flex items-center">
                  <span className="font-medium mr-2">{place.name}:</span>
                  <span>{place.tokens || 0}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="enabled-transitions">
          <h3 className="text-sm font-medium mb-2">Enabled Transitions</h3>
          {transitions.length === 0 ? (
            <p className="text-gray-500">No transitions defined</p>
          ) : enabledTransitions.length === 0 ? (
            <p className="text-gray-500">No enabled transitions</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {enabledTransitions.map(transition => (
                <button
                  key={transition.id}
                  className="px-3 py-1 bg-green-100 border border-green-300 rounded hover:bg-green-200"
                >
                  {transition.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExecutionPanel;
