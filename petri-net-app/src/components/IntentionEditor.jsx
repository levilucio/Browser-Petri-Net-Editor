import HmlPropertyEditor, { newModal } from './satel/HmlPropertyEditor';
import { sequenceFormula } from '../satel/core/HmlFormula';
import VariableSelectionEditor from './satel/VariableSelectionEditor';
import { intentionNotation } from '../satel/core/IntentionNotation';
import { validateIntention } from '../satel/core/IntentionSchema';
import { defaultMethodValue } from '../utils/builtin-values';
import MethodArgumentInput from './satel/MethodArgumentInput';
import { getPublicMethods, methodSignature } from '../features/simulation/PublicMethods';
/**
 * Intention Editor
 * 
 * Editor for SATEL-style intentions with variables and stim/obs pairs
 */

import ObservationEditor from './satel/ObservationEditor';
import { observationChannels } from '../domain/apn/Gates';
import React, { useState, useRef, useCallback } from 'react';

const IntentionEditor = ({ intention, onChange, onSave, onCancel, elements }) => {
  const variableKeys = useRef(intention.variables.map((_, i) => `variable-${i}`));
  const nextVariableKey = useRef(intention.variables.length);
  const [markingText, setMarkingText] = useState(JSON.stringify(intention.initialMarking || {}, null, 2));
  const [markingError, setMarkingError] = useState('');
  const pairKeys = useRef(intention.pairs.map((_, i) => i));
  const nextPairKey = useRef(intention.pairs.length);
  const [observationErrors, setObservationErrors] = useState({});
  const [propertyInvalid, setPropertyInvalid] = useState(false);
  const observationValidity = useCallback((key, invalid) => setObservationErrors(prev => prev[key] === invalid ? prev : { ...prev, [key]: invalid }), []);
  const transitions = elements.transitions || [];
  const places = elements.places || [];
  let methods = [];
  try { methods = getPublicMethods(elements); } catch {}
  const methodMode = !!intention.formula || methods.length > 0 || intention.pairs.some(p => p.stimulation.method);
  
  const updateIntention = (field, value) => {
    onChange({ ...intention, [field]: value });
  };
  
  const addVariable = () => {
    variableKeys.current.push(`variable-${nextVariableKey.current++}`);
    const newVariables = [
      ...intention.variables,
      {
        name: `var${intention.variables.length + 1}`,
        sort: 'Nat',
        hypothesis: { type: 'finite', values: [0] }
      }
    ];
    updateIntention('variables', newVariables);
  };
  
  const removeVariable = (index) => {
    variableKeys.current.splice(index, 1);
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
  
  const addPair = () => {
    pairKeys.current.push(nextPairKey.current++);
    const newPairs = [
      ...intention.pairs,
      {
        stimulation: methodMode ? { method: methods[0]?.name || '', arguments: Object.fromEntries((methods[0]?.parameters || []).map(p => [p.name, defaultMethodValue(p.sort)])) } : { transition: '', inputs: {} },
        observation: { outputs: {}, markings: {} }
      }
    ];
    updateIntention('pairs', newPairs);
  };
  
  const removePair = (index) => {
    const [key] = pairKeys.current.splice(index, 1);
    setObservationErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
    const newPairs = intention.pairs.filter((_, i) => i !== index);
    updateIntention('pairs', newPairs);
  };
  
  let invalid = '', preview = '';
  try { validateIntention(intention); } catch (err) { invalid = err.message; }
  if (intention.testType === 'negative') invalid = 'Whole-test verdict inversion is unsupported. Review the pair assertions.';
  try { preview = intentionNotation(intention); } catch { preview = 'Complete the fields to preview this intention.'; }
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

      </div>
      <details className="border rounded p-3 space-y-3"><summary>Additional intention settings</summary>
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
        
        <p className="text-sm text-gray-600">Each pair must satisfy its stated observation.</p>
        {intention.testType === 'negative' && <div role="alert" className="text-red-800">
          <p>This saved intention uses unsupported whole-test verdict inversion. Review its pairs and state the expected behavior explicitly.</p>
          <button type="button" className="border rounded p-2" onClick={() => updateIntention('testType', 'positive')}>Use explicit pair assertions</button>
        </div>}

      </details>

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
      <details className="border rounded p-3" open={!intention.formula || intention.variables.length > 0}>
        <summary className="text-sm font-medium cursor-pointer">Parameters and value selection</summary>
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
          {intention.variables.map((variable, idx) => <VariableSelectionEditor key={variableKeys.current[idx]} variable={variable}
            validityKey={variableKeys.current[idx]} onValidityChange={observationValidity} onRemove={() => removeVariable(idx)}
            onChange={value => updateIntention('variables', intention.variables.map((v, i) => i === idx ? value : v))} />)}
          
          {intention.variables.length === 0 && (
            <div className="text-center py-4 text-gray-400 text-sm">
              No variables defined. Add variables to parameterize this intention.
            </div>
          )}
        </div>
      </div>
      
      <label className="block text-sm font-medium">Conditions (optional)
        <input aria-label="Intention conditions" className="w-full border rounded p-2 mt-1 font-mono text-xs" placeholder="amount > 0 and amount <= 10" value={intention.conditionsText || ''} onChange={e => updateIntention('conditionsText', e.target.value)} />
        <span className="block text-xs font-normal text-gray-600 mt-1">Filters the selected combinations of variable values before reference execution. Use declared variable names without $ here.</span>
      </label>
      </details>
      {!intention.formula && <details className="border rounded p-3" open><summary className="font-medium">Intention notation preview</summary>
        <p className="text-xs text-gray-600 my-2">Edit the fields and pairs below. $name denotes a variable in calls and observations. Additional marking checks stay in the pair editor.</p>
        <pre className="text-xs whitespace-pre-wrap break-words">{preview}</pre>
      </details>
      }
      {intention.formula && <>
        <label className="block text-sm">Expected property truth on the reference
          <select aria-label="Expected property truth" className="w-full border rounded p-2" value={String(intention.expectedTruth ?? true)} onChange={e => updateIntention('expectedTruth', e.target.value === 'true')}>
            <option value="true">True — this behavior is required</option><option value="false">False — this property must not hold</option>
          </select>
        </label>
        <HmlPropertyEditor formula={intention.formula} elements={elements} onChange={value => updateIntention('formula', value)} onValidityChange={setPropertyInvalid} />
      </>}
      {!intention.formula && methodMode && <button type="button" className="border rounded p-2 text-blue-700" onClick={() => { setObservationErrors({}); onChange({ ...intention, pairs: [], formula: intention.pairs.length ? sequenceFormula(intention.pairs) : newModal(methods), expectedTruth: true }); }}>Use a branching property</button>}
      {/* Stim/Obs Pairs Section */}
      {!intention.formula && <div className="border-t pt-4">
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
            <div key={pairKeys.current[idx]} className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-medium text-blue-700">Pair {idx + 1}</span>
                <button
                  aria-label={`Remove pair ${idx + 1}`}
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
                        updatePair(idx, 'stimulation', { method: e.target.value, arguments: Object.fromEntries((method?.parameters || []).map(p => [p.name, defaultMethodValue(p.sort)])) });
                      }}>
                      <option value="">Select method…</option>
                      {methods.map(m => <option key={m.name} value={m.name}>{methodSignature(m)}</option>)}
                    </select>
                  </label>
                  {(methods.find(m => m.name === pair.stimulation.method)?.parameters || []).map(p => <label key={p.name} className="block text-xs">{p.name} · {p.sort}
                    <MethodArgumentInput key={pair.stimulation.method + ':' + p.name} label={`Pair ${idx + 1} argument ${p.name}`} sort={p.sort}
                      value={pair.stimulation.arguments?.[p.name] ?? defaultMethodValue(p.sort)} validityKey={`${pairKeys.current[idx]}:argument:${p.name}`} onValidityChange={observationValidity}
                      onChange={value => updateStimulation(idx, 'arguments', { ...pair.stimulation.arguments, [p.name]: value })} />
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
              
              {methodMode && <label className="block text-xs mb-2">Expected response
                <select aria-label={`Pair ${idx + 1} expected response`} className="block w-full border rounded p-2"
                  value={pair.assertion || (pair.observation.type === 'notEnabled' ? 'blocked' : 'required')}
                  onChange={e => {
                    const pairs = intention.pairs.map((p, i) => i === idx ? { ...p, assertion: e.target.value,
                      observation: { outputs: {}, ...(p.observation.markings ? { markings: p.observation.markings } : {}) } } : p);
                    updateIntention('pairs', pairs);
                  }}>
                  <option value="required">Accepted, with these observations</option>
                  <option value="blocked" disabled={idx !== intention.pairs.length - 1}>Refused; marking unchanged (final pair)</option>
                </select>
              </label>}
              {pair.assertion === 'blocked' || pair.observation.type === 'notEnabled' ? <p className="text-xs p-2">The final call must have no enabled rule or token binding. It produces no tokens and leaves the marking unchanged.</p> : <ObservationEditor observation={pair.observation} places={observationChannels(elements)} pairNumber={idx + 1}
                onChange={value => updatePair(idx, 'observation', value)}
                onValidityChange={invalid => observationValidity(pairKeys.current[idx], invalid)} />}
            </div>
          ))}
          
          {intention.pairs.length === 0 && (
            <div className="text-center py-4 text-gray-400 text-sm">
              No pairs defined. Add stimulation/observation pairs to specify the test.
            </div>
          )}
        </div>
      </div>
      
      }
      {invalid && <p role="status" className="text-sm text-amber-900">{invalid}</p>}
      {/* Action Buttons */}
      <div className="pt-4 border-t flex gap-2">
        <button
          onClick={onSave}
          disabled={!!invalid || propertyInvalid || !!markingError || Object.values(observationErrors).some(Boolean)}
          className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
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
