import { nondeterminismExamples } from '../satel/examples/nondeterminism/editor.js';
import { hmlSelectionExamples } from '../satel/examples/hml-selection/editor.js';
import { refusalExamples } from '../satel/examples/refusal/editor.js';
import React, { useState } from 'react';
import { exerciseExamples } from '../satel/examples/exercises/editor.js';
import { fulfilmentExamples } from '../satel/examples/fulfilment/editor.js';
import { oracleAccountExamples } from '../satel/examples/oracle-account/editor.js';

const EXAMPLES = [
  ...oracleAccountExamples,
  ...refusalExamples,
  ...nondeterminismExamples,
  ...hmlSelectionExamples,
  ...fulfilmentExamples,
  { filename: 'executable-sequence', displayName: 'SATEL Whole-sequence selection — Reference' },
  { filename: 'executable-sequence-mutant', displayName: 'SATEL Whole-sequence selection — Mutant: no debit' },
  { filename: 'typed-store', displayName: 'SATEL Typed store — Reference' },
  { filename: 'typed-store-mutant', displayName: 'SATEL Typed store — Mutant: drops first item' },
  { filename: 'builtin-types', displayName: 'SATEL Built-in types — Symbolic classes' },
  { filename: 'compound-guard', displayName: 'SATEL Compound guard — Reference' },
  { filename: 'compound-guard-mutant', displayName: 'SATEL Compound guard — Mutant: missing x = 10' },
  { filename: 'symbolic-list', displayName: 'SATEL List — Symbolic membership classes' },
  { filename: 'petri-net-PT.pnml', displayName: 'Petri Net PT' },
  { filename: 'petri-net-algebraic1.pnml', displayName: 'Algebraic Net 1' },
  { filename: 'petri-net-algebraic2.pnml', displayName: 'Algebraic Net 2' },
  { filename: 'petri-net-algebraic3.pnml', displayName: 'Algebraic Net 3' },
  { filename: 'petri-net-XL.pnml', displayName: 'Petri Net XL' },
  { filename: 'philosophers-5.pnml', displayName: 'Dining Philosophers (5)' },
  { filename: 'manufacturing-workflow', displayName: 'Manufacturing Workflow (SATEL)', isSpecial: true },
];

export default function ExamplesDialog({ isOpen, onClose, onSelectExample }) {
  const [search, setSearch] = useState('');
  if (!isOpen) return null;
  const matches = example => `${example.displayName} ${example.description || ''}`.toLowerCase().includes(search.toLowerCase());
  const renderExample = example => (
    <button key={example.filename} className="w-full text-left px-4 py-3 border rounded hover:bg-gray-50 active:bg-gray-100 transition-colors"
      onClick={() => handleSelect(example.filename)} data-testid={`example-${example.filename}`}>
      <div className="font-medium text-gray-800">{example.displayName}</div>
      {example.description && <div className="text-xs text-gray-600 mt-1">{example.description}</div>}
    </button>
  );

  const handleSelect = (filename) => {
    onSelectExample(filename);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-2 sm:p-4">
      <div className="bg-white rounded-lg sm:rounded shadow-lg w-full h-auto max-h-[90vh] sm:max-w-md overflow-y-auto p-3 sm:p-4">
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
          <label className="block text-sm">Find an example
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, type, or fault" className="block w-full border rounded p-2 mt-1" />
          </label>
          <details open={search ? true : undefined}>
            <summary className="cursor-pointer font-semibold py-2">SATEL exercises — 10 references and 20 mutants</summary>
            <p className="text-sm text-gray-600 mb-2">Generate on a reference, then load its mutant and replay the frozen suite.</p>
            <div className="space-y-2">{exerciseExamples.filter(matches).map(renderExample)}</div>
          </details>
          {EXAMPLES.filter(matches).map(renderExample)}
        </div>
      </div>
    </div>
  );
}

