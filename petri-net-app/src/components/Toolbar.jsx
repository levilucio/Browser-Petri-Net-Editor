import React from 'react';

const Toolbar = ({ mode, setMode }) => {
  return (
    <div className="toolbar flex p-2 bg-gray-100 border-b border-gray-300">
      <div className="editing-tools mr-6">
        <h3 className="text-sm font-semibold mb-1">Editing</h3>
        <div className="flex space-x-2">
          <button 
            className={`px-3 py-1 rounded ${mode === 'select' ? 'bg-blue-500 text-white' : 'bg-white border border-gray-300'}`}
            onClick={() => setMode('select')}
          >
            Select
          </button>
          <button 
            className={`px-3 py-1 rounded ${mode === 'place' ? 'bg-blue-500 text-white' : 'bg-white border border-gray-300'}`}
            onClick={() => setMode('place')}
          >
            Place
          </button>
          <button 
            className={`px-3 py-1 rounded ${mode === 'transition' ? 'bg-blue-500 text-white' : 'bg-white border border-gray-300'}`}
            onClick={() => setMode('transition')}
          >
            Transition
          </button>
          <button 
            className={`px-3 py-1 rounded ${mode === 'arc' ? 'bg-blue-500 text-white' : 'bg-white border border-gray-300'}`}
            onClick={() => setMode('arc')}
          >
            Arc
          </button>
        </div>
      </div>

      <div className="file-operations mr-6">
        <h3 className="text-sm font-semibold mb-1">File</h3>
        <div className="flex space-x-2">
          <button className="px-3 py-1 rounded bg-white border border-gray-300">
            Save
          </button>
          <button className="px-3 py-1 rounded bg-white border border-gray-300">
            Load
          </button>
          <button className="px-3 py-1 rounded bg-white border border-gray-300">
            Clear
          </button>
        </div>
      </div>

      <div className="simulation-tools">
        <h3 className="text-sm font-semibold mb-1">Simulation</h3>
        <div className="flex space-x-2">
          <button className="px-3 py-1 rounded bg-white border border-gray-300">
            Step-by-Step
          </button>
          <button className="px-3 py-1 rounded bg-white border border-gray-300">
            Quick Visual
          </button>
          <button className="px-3 py-1 rounded bg-white border border-gray-300">
            Non-Visual
          </button>
          <button className="px-3 py-1 rounded bg-white border border-gray-300">
            Stop
          </button>
        </div>
      </div>

      <div className="history-tools ml-auto">
        <h3 className="text-sm font-semibold mb-1">History</h3>
        <div className="flex space-x-2">
          <button className="px-3 py-1 rounded bg-white border border-gray-300">
            Undo
          </button>
          <button className="px-3 py-1 rounded bg-white border border-gray-300">
            Redo
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
