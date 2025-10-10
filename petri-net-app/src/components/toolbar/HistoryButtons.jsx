import React from 'react';

const HistoryButtons = ({ canUndo, canRedo, onUndo, onRedo, buttonStyle }) => {
  return (
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
  );
};

export default HistoryButtons;


