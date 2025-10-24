import React from 'react';

const FileControls = ({ isLoading, onSave, onSaveAs, canSaveAs, onLoad, onClear, buttonStyle }) => {
  return (
    <div className="flex justify-between">
      <button 
        style={{ ...buttonStyle(false), opacity: isLoading ? 0.5 : 1 }}
        onClick={onSave}
        disabled={isLoading}
        title="Save as PNML"
      >
        Save
      </button>
      <button
        style={{ ...buttonStyle(false), opacity: isLoading || !canSaveAs ? 0.5 : 1 }}
        onClick={onSaveAs}
        disabled={isLoading || !canSaveAs}
        title="Save As (choose location and filename)"
      >
        Save as
      </button>
      <button 
        style={{ ...buttonStyle(false), opacity: isLoading ? 0.5 : 1 }}
        onClick={onLoad}
        disabled={isLoading}
        title="Load PNML file"
      >
        Load
      </button>
      <button 
        style={{ ...buttonStyle(false) }}
        onClick={onClear}
        title="Clear canvas"
      >
        Clear
      </button>
    </div>
  );
};

export default FileControls;


