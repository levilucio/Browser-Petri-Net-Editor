import React from 'react';

const Toolbar = ({ mode, setMode, gridSnappingEnabled, toggleGridSnapping, canUndo, canRedo, onUndo, onRedo }) => {
  // Styles for the separator
  const separatorStyle = {
    width: '1px',
    backgroundColor: '#d1d5db', // gray-300
    margin: '0 16px',
    height: '100%', // Full height
    alignSelf: 'stretch' // Stretch to fill container height
  };

  // Common button style
  const buttonStyle = (isSelected) => ({
    padding: '0.25rem 0.75rem',
    borderRadius: '0.25rem',
    backgroundColor: isSelected ? '#4338ca' : 'white', // indigo-700 or white
    color: isSelected ? 'white' : 'black',
    border: isSelected ? 'none' : '1px solid #d1d5db', // gray-300
    margin: '0 0.25rem' // Even spacing on both sides
  });

  return (
    <div className="toolbar flex p-2 bg-gray-100 border-b border-gray-300" style={{ minHeight: '70px' }}>
      {/* File Operations Group */}
      <div className="file-operations">
        <h3 className="text-sm font-semibold mb-1">File</h3>
        <div className="flex justify-between">
          <button style={{ ...buttonStyle(false) }}>
            Save
          </button>
          <button style={buttonStyle(false)}>
            Load
          </button>
          <button style={buttonStyle(false)}>
            Clear
          </button>
        </div>
      </div>
      
      {/* Visual separator */}
      <div style={separatorStyle}></div>
      
      {/* Editing Tools Group */}
      <div className="editing-tools">
        <h3 className="text-sm font-semibold mb-1">Editing</h3>
        <div className="flex items-center">
          {/* Grid Snapping Toggle */}
          <div className="flex items-center mr-4">
            <input
              type="checkbox"
              id="grid-snap-toggle"
              data-testid="grid-snap-toggle"
              checked={gridSnappingEnabled}
              onChange={toggleGridSnapping}
              className="mr-1"
            />
            <label htmlFor="grid-snap-toggle" className="text-sm">Snap to Grid</label>
          </div>
          <div className="flex justify-between">
            <button 
              style={{ ...buttonStyle(mode === 'select') }}
              onClick={() => setMode('select')}
            >
              Select
            </button>
            <button 
              style={buttonStyle(mode === 'place')}
              data-testid="toolbar-place"
              onClick={() => setMode('place')}
            >
              Place
            </button>
            <button 
              style={buttonStyle(mode === 'transition')}
              onClick={() => setMode('transition')}
            >
              Transition
            </button>
            <button 
              style={buttonStyle(mode === 'arc')}
              onClick={() => setMode('arc')}
            >
              Arc
            </button>
          </div>
        </div>
      </div>
      
      {/* Visual separator */}
      <div style={separatorStyle}></div>
      
      {/* Simulation Tools Group */}
      <div className="simulation-tools">
        <h3 className="text-sm font-semibold mb-1">Simulation</h3>
        <div className="flex justify-between">
          <button style={buttonStyle(false)}>
            Step-by-Step
          </button>
          <button style={buttonStyle(false)}>
            Quick Visual
          </button>
          <button style={buttonStyle(false)}>
            Non-Visual
          </button>
          <button style={buttonStyle(false)}>
            Stop
          </button>
        </div>
      </div>

      <div className="history-tools ml-auto">
        <h3 className="text-sm font-semibold mb-1">History</h3>
        <div className="flex justify-between">
          <button 
            style={{ ...buttonStyle(false), opacity: canUndo ? 1 : 0.5 }}
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            Undo
          </button>
          <button 
            style={{ ...buttonStyle(false), opacity: canRedo ? 1 : 0.5 }}
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            Redo
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
