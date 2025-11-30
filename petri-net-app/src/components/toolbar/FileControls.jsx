import React from 'react';

const FileControls = ({ isLoading, onSave, onSaveAs, canSaveAs, onLoad, onClear, buttonStyle }) => {
  return (
    <div className="flex flex-col gap-2">
      <button 
        className="menu-button-hover"
        style={{ ...buttonStyle(false, 'file'), opacity: isLoading ? 0.5 : 1 }}
        onClick={onSave}
        disabled={isLoading}
        title="Save as PNML"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        Save
      </button>
      <button
        className="menu-button-hover"
        style={{ ...buttonStyle(false, 'file'), opacity: isLoading || !canSaveAs ? 0.5 : 1 }}
        onClick={onSaveAs}
        disabled={isLoading || !canSaveAs}
        title="Save As (choose location and filename)"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
        </svg>
        Save as
      </button>
      <button 
        className="menu-button-hover"
        style={{ ...buttonStyle(false, 'file'), opacity: isLoading ? 0.5 : 1 }}
        onClick={onLoad}
        disabled={isLoading}
        title="Load PNML file"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        Load
      </button>
      <button 
        className="menu-button-hover"
        style={{ ...buttonStyle(false, 'file') }}
        onClick={onClear}
        title="Clear canvas"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Clear
      </button>
    </div>
  );
};

export default FileControls;


