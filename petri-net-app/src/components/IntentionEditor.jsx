import { getPublicMethods, methodSignature } from '../features/simulation/PublicMethods';
/**
 * Intention Editor
 * 
 * Editor for SATEL-style intentions with variables and stim/obs pairs
 */

import React, { useState } from 'react';

const IntentionEditor = ({ intention, onChange, onSave, onCancel, elements }) => {
  const [markingText, setMarkingText] = useState(JSON.stringify(intention.initialMarking || {}, null, 2));
  const [markingError, setMarkingError] = useState('');
  const transitions = elements.transitions || [];
  const places = elements.places || [];
  let methods = [];
  try { methods = getPublicMethods(elements); } catch {}
  const methodMode = methods.length > 0 || intention.pairs.some(p => p.stimulation.method);
  
  const updateIntention = (field, value) => {
    onChange({ ...intention, [field]: value });
  };
  
  const updateVariable = (index, field, value) => {
    const newVariables = [...intention.variables];
    newVariables[index] = { ...newVariables[index], [field]: value };
    updateIntention('variables', newVariables);
  };
  
  const updateVariableHypothesis = (index, field, value) => {
    const newVariables = [...intention.variables];
    newVariables[index] = {
      ...newVariables[index],
      hypothesis: { ...newVariables[index].hypothesis, [field]: value }
    };
    updateIntention('variables', newVariables);
  };
  
  const addVariable = () => {
    const newVariables = [
      ...intention.variables,
      {
        name: `var${intention.variables.length + 1}`,
        sort: 'Nat',
        hypothesis: { type: 'uniformity', representative: 0 }
      }
    ];
    updateIntention('variables', newVariables);
  };
  
  const removeVariable = (index) => {
    const newVariables = intention.variables.filter((_, i) => i !== index);
    updateIntention('variables', newVariables);
  };
  
  const updatePair = (index, field, value) => {
    const newPairs = [...intention.pairs];
    newPairs[index] = { ...newPairs[index], [field]: value };
    updateIntention('pairs', newPairs);
  };
  
  const updateStimulation = (pairIndex, field, value) => {
    const newPairs = [...intention.pairs];
    newPairs[pairIndex] = {
      ...newPairs[pairIndex],
      stimulation: { ...newPairs[pairIndex].stimulation, [field]: value }
    };
    updateIntention('pairs', newPairs);
  };
  
  const updateObservation = (pairIndex, field, value) => {
    const newPairs = [...intention.pairs];
    newPairs[pairIndex] = {
      ...newPairs[pairIndex],
      observation: { ...newPairs[pairIndex].observation, [field]: value }
    };
    updateIntention('pairs', newPairs);
  };
  
  const addPair = () => {
    const newPairs = [
      ...intention.pairs,
      {
        stimulation: methodMode ? { method: methods[0]?.name || '', arguments: Object.fromEntries((methods[0]?.parameters || []).map(p => [p.name, 0])) } : { transition: '', inputs: {} },
        observation: { outputs: {}, markings: {} }
      }
    ];
    updateIntention('pairs', newPairs);
  };
  
  const removePair = (index) => {
    const newPairs = intention.pairs.filter((_, i) => i !== index);
    updateIntention('pairs', newPairs);
  };
  
  return (
    <div className="p-4 space-y-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        {intention.name === 'New Test Intention' ? 'Create Test Intention' : 'Edit Test Intention'}
      </h3>
      
      {/* Basic Info */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={intention.name}
            onChange={(e) => updateIntention('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Test intention name"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={intention.description || ''}
            onChange={(e) => updateIntention('description', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            placeholder="Describe what this test checks..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Test Type</label>
          <select
            value={intention.testType}
            onChange={(e) => updateIntention('testType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="positive">Positive (all pairs must succeed)</option>
            <option value="negative">Negative (at least one pair must fail)</option>
          </select>
        </div>
      </div>
      
      {!methodMode && <div className="border-t pt-4 space-y-2">
        <label htmlFor="satel-initial-marking" className="block text-sm font-medium">Initial marking overrides (JSON)</label>
        <p className="text-xs text-gray-600">Applied once before execution. Unlisted places keep the loaded APN marking. Use "$variable" for parameters. Pair inputs only select existing tokens.</p>
        <textarea id="satel-initial-marking" rows={4} className="w-full border rounded p-2 font-mono text-xs"
          value={markingText} onChange={e => {
            setMarkingText(e.target.value);
            try {
              const marking = JSON.parse(e.target.value);
              if (!marking || Array.isArray(marking) || typeof marking !== 'object' || !Object.values(marking).every(Array.isArray)) throw new Error('Use place IDs mapped to token arrays.');
              updateIntention('initialMarking', marking); setMarkingError('');
            } catch (err) { setMarkingError(err.message); }
          }} />
        {markingError && <p role="alert" className="text-red-700">{markingError}</p>}
      </div>}
      {methodMode && <p className="text-sm text-gray-600">Method tests start from the loaded model’s initial marking. Arguments vary; the test does not overwrite the model’s state.</p>}
      {/* Variables Section */}
      <div className="border-t pt-4">
        <div className="flex justify-between items-center mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Variables
            <span className="ml-2 text-xs text-gray-500">({intention.variables.length})</span>
          </label>
          <button
            onClick={addVariable}
            className="px-3 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100"
          >
            + Add Variable
          </button>
        </div>
        
        <div className="space-y-3">
          {intention.variables.map((variable, idx) => (
            <div key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-medium text-gray-600">Variable {idx + 1}</span>
                <button
                  onClick={() => removeVariable(idx)}
                  className="px-2 py-0.5 text-red-600 hover:bg-red-50 rounded text-xs"
                >
                  ✕
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Name</label>
                  <input
                    type="text"
                    value={variable.name}
                    onChange={(e) => updateVariable(idx, 'name', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                    placeholder="e.g., order"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Sort (ADT)</label>
                  <input
                    type="text"
                    value={variable.sort}
                    onChange={(e) => updateVariable(idx, 'sort', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                    placeholder="e.g., Order"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-gray-600 mb-1">Hypothesis</label>
                <select
                  value={variable.hypothesis.type}
                  onChange={(e) => {
                    const type = e.target.value;
                    let newHypothesis = { type };
                    if (type === 'uniformity') {
                      newHypothesis.representative = 0;
                    } else if (type === 'subuniformity') {
                      newHypothesis.source = 'constructors';
                    } else if (type === 'regularity') {
                      newHypothesis.bounds = { depth: 2, nbEvents: 5 };
                    }
                    updateVariable(idx, 'hypothesis', newHypothesis);
                  }}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                >
                  <option value="uniformity">Uniformity (single value)</option>
                  <option value="subuniformity">Subuniformity (partition)</option>
                  <option value="regularity">Regularity (bounded)</option>
                </select>
                
                {variable.hypothesis.type === 'subuniformity' && (
                  <select
                    value={variable.hypothesis.source || 'constructors'}
                    onChange={(e) => updateVariableHypothesis(idx, 'source', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs mt-1"
                  >
                    <option value="constructors">Constructors</option>
                    <option value="guards">Guards</option>
                    <option value="axiom">Axiom</option>
                  </select>
                )}
                
                {variable.hypothesis.type === 'uniformity' && (
                  <input
                    type="text"
                    value={JSON.stringify(variable.hypothesis.representative)}
                    onChange={(e) => {
                      try {
                        const val = JSON.parse(e.target.value);
                        updateVariableHypothesis(idx, 'representative', val);
                      } catch {}
                    }}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs mt-1 font-mono"
                    placeholder="e.g., 0"
                  />
                )}
              </div>
            </div>
          ))}
          
          {intention.variables.length === 0 && (
            <div className="text-center py-4 text-gray-400 text-sm">
              No variables defined. Add variables to parameterize this intention.
            </div>
          )}
        </div>
      </div>
      
      {/* Stim/Obs Pairs Section */}
      <div className="border-t pt-4">
        <div className="flex justify-between items-center mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Stimulation/Observation Pairs
            <span className="ml-2 text-xs text-gray-500">({intention.pairs.length})</span>
          </label>
          <button
            onClick={addPair}
            className="px-3 py-1 bg-blue-50 text-blue-600 rounded text-xs hover:bg-blue-100"
          >
            + Add Pair
          </button>
        </div>
        
        <div className="space-y-4">
          {intention.pairs.map((pair, idx) => (
            <div key={idx} className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-medium text-blue-700">Pair {idx + 1}</span>
                <button
                  onClick={() => removePair(idx)}
                  className="px-2 py-0.5 text-red-600 hover:bg-red-50 rounded text-xs"
                >
                  ✕
                </button>
              </div>
              
              {/* Stimulation */}
              <div className="bg-white p-2 rounded mb-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Stimulation</label>
                {methodMode ? <div className="space-y-2">
                  <label className="block text-xs">Public method
                    <select aria-label={`Pair ${idx + 1} method`} className="block w-full border rounded p-2"
                      value={pair.stimulation.method || ''} onChange={e => {
                        const method = methods.find(m => m.name === e.target.value);
                        updatePair(idx, 'stimulation', { method: e.target.value, arguments: Object.fromEntries((method?.parameters || []).map(p => [p.name, 0])) });
                      }}>
                      <option value="">Select method…</option>
                      {methods.map(m => <option key={m.name} value={m.name}>{methodSignature(m)}</option>)}
                    </select>
                  </label>
                  {(methods.find(m => m.name === pair.stimulation.method)?.parameters || []).map(p => <label key={p.name} className="block text-xs">{p.name} · {p.sort}
                    <input aria-label={`Pair ${idx + 1} argument ${p.name}`} className="block w-full border rounded p-2"
                      value={pair.stimulation.arguments?.[p.name] ?? ''} placeholder="Integer or $variable"
                      onChange={e => {
                        const text = e.target.value;
                        updateStimulation(idx, 'arguments', { ...pair.stimulation.arguments, [p.name]: /^-?\d+$/.test(text) ? Number(text) : text });
                      }} />
                  </label>)}
                </div> : <>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Transition</label>
                  <select
                    value={pair.stimulation.transition}
                    onChange={(e) => updateStimulation(idx, 'transition', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  >
                    <option value="">Select transition...</option>
                    {transitions.map(t => (
                      <option key={t.id} value={t.id}>{t.label || t.id}</option>
                    ))}
                  </select>
                </div>
                <div className="mt-2">
                  <label className="block text-xs text-gray-600 mb-1">Tokens to consume (JSON)</label>
                  <textarea
                    value={JSON.stringify(pair.stimulation.inputs, null, 2)}
                    onChange={(e) => {
                      try {
                        const val = JSON.parse(e.target.value);
                        updateStimulation(idx, 'inputs', val);
                      } catch {}
                    }}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                    rows={3}
                    placeholder='{ "placeId": ["$var"] }'
                  />
                </div>
                </>}

              </div>
              
              {/* Observation */}
              <div className="bg-white p-2 rounded">
                <label className="block text-xs font-medium text-gray-700 mb-1">Observation</label>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Expected tokens produced (JSON)</label>
                  <textarea
                    value={JSON.stringify(pair.observation.outputs, null, 2)}
                    onChange={(e) => {
                      try {
                        const val = JSON.parse(e.target.value);
                        updateObservation(idx, 'outputs', val);
                      } catch {}
                    }}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                    rows={3}
                    placeholder='{ "placeId": [tokens] }'
                  />
                </div>
                <div className="mt-2">
                  <label className="block text-xs text-gray-600 mb-1">Marking Constraints (JSON, optional)</label>
                  <textarea
                    value={JSON.stringify(pair.observation.markings || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const val = JSON.parse(e.target.value);
                        updateObservation(idx, 'markings', val);
                      } catch {}
                    }}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                    rows={2}
                    placeholder='{ "placeId": { "length": 0 } }'
                  />
                </div>
              </div>
            </div>
          ))}
          
          {intention.pairs.length === 0 && (
            <div className="text-center py-4 text-gray-400 text-sm">
              No pairs defined. Add stimulation/observation pairs to specify the test.
            </div>
          )}
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="pt-4 border-t flex gap-2">
        <button
          onClick={onSave}
          disabled={!!markingError}
          className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Save Intention
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default IntentionEditor;
