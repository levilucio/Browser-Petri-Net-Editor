import React from 'react';

const ModeButtons = ({ mode, setMode, buttonStyle }) => {
  return (
    <div className="flex justify-between">
      <button 
        style={{ ...buttonStyle(mode === 'select') }}
        data-testid="toolbar-select"
        onClick={() => { if (mode !== 'select') setMode('select'); }}
      >
        Select
      </button>
      <button 
        style={buttonStyle(mode === 'place')}
        data-testid="toolbar-place"
        onClick={() => { if (mode !== 'place') setMode('place'); }}
      >
        Place
      </button>
      <button 
        style={buttonStyle(mode === 'transition')}
        data-testid="toolbar-transition"
        onClick={() => { if (mode !== 'transition') setMode('transition'); }}
      >
        Transition
      </button>
      <button 
        style={buttonStyle(mode === 'arc')}
        data-testid="toolbar-arc"
        onClick={() => { if (mode !== 'arc') setMode('arc'); }}
      >
        Arc
      </button>
    </div>
  );
};

export default ModeButtons;


