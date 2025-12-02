import React from 'react';

const EXAMPLES = [
  { filename: 'petri-net-PT.pnml', displayName: 'Petri Net PT' },
  { filename: 'petri-net-algebraic1.pnml', displayName: 'Algebraic Net 1' },
  { filename: 'petri-net-algebraic2.pnml', displayName: 'Algebraic Net 2' },
  { filename: 'petri-net-algebraic3.pnml', displayName: 'Algebraic Net 3' },
  { filename: 'petri-net-XL.pnml', displayName: 'Petri Net XL' },
];

export default function ExamplesDialog({ isOpen, onClose, onSelectExample }) {
  if (!isOpen) return null;

  const handleSelect = (filename) => {
    onSelectExample(filename);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-2 sm:p-4">
      <div className="bg-white rounded-lg sm:rounded shadow-lg w-full h-auto sm:max-w-md overflow-y-auto p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3 sticky top-0 bg-white pb-2 border-b -mx-3 sm:-mx-4 px-3 sm:px-4 z-10">
          <h3 className="text-base sm:text-lg font-semibold pr-2">Examples</h3>
          <button 
            className="px-3 py-2 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 rounded text-sm font-medium flex-shrink-0 transition-colors" 
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="space-y-2">
          {EXAMPLES.map((example) => (
            <button
              key={example.filename}
              className="w-full text-left px-4 py-3 border rounded hover:bg-gray-50 active:bg-gray-100 transition-colors"
              onClick={() => handleSelect(example.filename)}
              data-testid={`example-${example.filename}`}
            >
              <div className="font-medium text-gray-800">{example.displayName}</div>
              <div className="text-xs text-gray-500 mt-1">{example.filename}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

