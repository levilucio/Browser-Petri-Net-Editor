import { formulaNotation } from '../satel/core/HmlFormula';
import { methodSignature } from '../features/simulation/PublicMethods';
import PublicMethodPanel from './PublicMethodPanel';
import React, { useState, useEffect, useMemo } from 'react';
import { usePetriNet } from '../contexts/PetriNetContext';
import { extractInterface, validateInterface } from '../satel';
import { validateIntention } from '../satel/core/IntentionSchema';
import IntentionEditor from './IntentionEditor';
import SymbolicIntentionEditor from './satel/SymbolicIntentionEditor';
import { createSymbolicListIntention } from '../satel/examples/symbolic-list/editor.js';
import { compileSymbolicIntention } from '../satel/core/SymbolicSource.js';
import { pairNotation, protocolCases } from '../satel/core/IntentionNotation.js';
import OracleValidationPanel from './OracleValidationPanel';
import BlackBoxPanel from './satel/BlackBoxPanel';
const button = 'px-3 py-2 border rounded disabled:opacity-50';

function SequencePreview({ intention }) {
  try {
    const text = intention.formula ? formulaNotation(intention.formula) : intention.kind === 'symbolic'
      ? protocolCases(intention.symbolic.protocolSource || '').map(c => `${c.name}:\n${c.pairs.join(' .\n')}`).join('\n\n')
      : intention.pairs.map(pairNotation).join(' .\n');
    return <pre className="mt-2 text-xs whitespace-pre-wrap break-words bg-slate-50 rounded p-2">{intention.formula ? `${intention.expectedTruth === false ? 'Must not hold' : 'Must hold'}: ` : ''}{text || 'No pair sequence defined.'}{intention.branchingProperty ? `\nAdditional requirement — ${intention.branchingExpectedTruth === false ? 'must not hold' : 'must hold'}: ${formulaNotation(intention.branchingProperty)}` : ''}</pre>;
  } catch { return <p>Edit this intention to review its sequence.</p>; }
}
export default function SatelPanel({ isOpen, onClose }) {
  const { elements, setElements, simulationSettings } = usePetriNet();
  const intentions = elements.testIntentions || [];
  const [selectedId, setSelectedId] = useState(null), [editing, setEditing] = useState(null);
  const [activeTab, setActiveTab] = useState('intentions'), [error, setError] = useState(null);
  // One saved reference session survives tab switches, closing, and target model loads.
  const [session, setSession] = useState(null);
  const isAlgebraic = ['algebraic', 'algebraic-int'].includes(simulationSettings?.netMode);
  useEffect(() => { setEditing(null); setError(null); }, [elements.testIntentions]);
  useEffect(() => {
    if (isOpen && localStorage.getItem('satel-test-intentions')) {
      localStorage.removeItem('satel-test-intentions');
      setError('An old cached intention list was discarded. Reload the example to use its intentions.');
    }
  }, [isOpen]);
  const ioInterface = useMemo(() => {
    if (!isAlgebraic) return null;
    try { return { ...extractInterface(elements), validation: validateInterface(elements) }; } catch { return null; }
  }, [elements, isAlgebraic]);
  const save = () => {
    try {
      if (editing.kind === 'symbolic') compileSymbolicIntention(editing); else validateIntention(editing);
      setElements(prev => ({ ...prev, testIntentions: (prev.testIntentions || []).some(i => i.id === editing.id)
        ? prev.testIntentions.map(i => i.id === editing.id ? editing : i) : [...(prev.testIntentions || []), editing] }));
      setSelectedId(editing.id); setEditing(null); setError(null);
    } catch (e) { setError(e.message); }
  };
  return <aside aria-label="SATEL Testing" style={{ display: isOpen ? undefined : 'none' }} className="fixed right-0 top-0 bottom-0 w-full sm:w-[620px] bg-white shadow-2xl z-50 flex flex-col border-l">
    <div className="flex items-center justify-between p-4 border-b"><h2 className="text-lg font-semibold">SATEL Testing</h2><button aria-label="Close SATEL" onClick={onClose} className={button}>✕</button></div>
    {!isAlgebraic ? <p className="p-4">Switch to Algebraic mode in Settings to use SATEL.</p> : <>
      <nav className="flex border-b text-sm" aria-label="SATEL views">
        {[['intentions', 'Intentions'], ['generated', 'Generated tests'], ['replay', 'Replay results'], ['blackbox', 'Black-box runs']].map(([id, label]) => <button key={id} aria-current={activeTab === id ? 'page' : undefined} onClick={() => setActiveTab(id)} className={`flex-1 py-3 ${activeTab === id ? 'bg-blue-50 text-blue-700 font-semibold' : ''}`}>{label}</button>)}
      </nav>
      {error && <div role="alert" className="m-3 p-3 bg-red-50 text-red-800 border rounded text-sm">{error}</div>}
      <div className="flex-1 overflow-y-auto min-w-0">
        <div hidden={!['generated', 'replay'].includes(activeTab)}><OracleValidationPanel enabled={isOpen} elements={elements} session={session} onSessionChange={setSession} selectedId={selectedId} onSelect={setSelectedId} view={activeTab === 'replay' ? 'replay' : 'generated'} onNavigate={setActiveTab} /></div>
        <div hidden={activeTab !== 'blackbox'}><BlackBoxPanel session={session} /></div>
        {activeTab === 'intentions' && (editing ?
          editing.kind === 'symbolic' ? <SymbolicIntentionEditor key={editing.id} intention={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} elements={elements} /> : <IntentionEditor key={editing.id} intention={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} elements={elements} /> :
          <div className="p-4 space-y-3 text-sm">
            <p>Describe calls and observations as a sequence or a branching property. Each test starts from the APN’s initial marking.</p>
            <button className={`${button} w-full text-blue-700`} onClick={() => setEditing({ id: `intention-${Date.now()}`, name: 'New Test Intention', description: '', testType: 'positive', variables: [], pairs: [] })}>+ Create Intention</button>
            <button className={`${button} w-full text-blue-700`} onClick={() => setEditing({ id: `property-${Date.now()}`, name: 'New branching property', testType: 'positive', variables: [], pairs: [], formula: { op: 'true' }, expectedTruth: true })}>+ Create branching property</button>
            {!intentions.length && <p>No intentions defined. Create one or load a SATEL example.</p>}
            {intentions.map(i => <article key={i.id} className="p-3 border rounded">
              <h3 className="font-semibold">{i.name}</h3>{i.description && <p>{i.description}</p>}
              <SequencePreview intention={i} />
              <div className="flex flex-wrap gap-2 mt-2">
                <button className={button} onClick={() => setEditing(JSON.parse(JSON.stringify(i)))}>Edit</button>
                <button className={button} onClick={() => { setSelectedId(i.id); setActiveTab('generated'); }}>Use intention</button>
                <button className={button} onClick={() => setElements(prev => ({ ...prev, testIntentions: prev.testIntentions.filter(x => x.id !== i.id) }))}>Delete</button>
              </div>
            </article>)}
            <details className="border rounded p-3"><summary className="cursor-pointer font-medium">Advanced model and selection tools</summary>
              <p className="my-2">Equation-based subuniformity is configured in a symbolic intention. Existing examples already include this setup.</p>
              <button className={button} onClick={() => setEditing({ ...createSymbolicListIntention(), id: `symbolic-${Date.now()}`, name: 'New symbolic intention' })}>+ Create symbolic intention</button>
              <details className="mt-3"><summary>Public methods</summary><PublicMethodPanel /></details>
              <details className="mt-3"><summary>Observable interface</summary><InterfaceTab ioInterface={ioInterface} /></details>
            </details>
          </div>)}
      </div>
    </>}
  </aside>;
}
// Interface Tab Component
const InterfaceTab = ({ ioInterface }) => {
  if (!ioInterface) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Unable to extract I/O interface.</p>
      </div>
    );
  }

  const { inputPlaces, outputPlaces, inputTransitions, outputTransitions, validation, methods = [] } = ioInterface;

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Validation</h3>
        {validation.valid ? (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            ✓ I/O interface is valid
          </div>
        ) : (
          <div className="space-y-2">
            {validation.errors?.map((err, idx) => (
              <div key={idx} className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                {err}
              </div>
            ))}
            {validation.warnings?.map((warn, idx) => (
              <div key={idx} className="p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-xs">
                {warn}
              </div>
            ))}
          </div>
        )}
      </div>

      {methods.length > 0 && <section className="space-y-2">
        <h3 className="text-sm font-semibold">Public methods ({methods.length})</h3>
        <p className="text-xs text-gray-600">A stimulation calls one method. Guards and the current marking choose its implementing rule.</p>
        {methods.map(m => <div key={m.name} className="font-mono text-sm border rounded p-2">{methodSignature(m)}</div>)}
      </section>}
      {!methods.length && <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Input Places ({inputPlaces.length})</h3>
        {inputPlaces.length === 0 ? (
          <p className="text-xs text-gray-500">No input places marked</p>
        ) : (
          <div className="space-y-1">
            {inputPlaces.map(p => (
              <div key={p.id} className="px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm">
                {p.label || p.id}
                {p.io_description && (
                  <span className="ml-2 text-xs text-gray-600">- {p.io_description}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>}

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Output Places ({outputPlaces.length})</h3>
        {outputPlaces.length === 0 ? (
          <p className="text-xs text-gray-500">No output places marked</p>
        ) : (
          <div className="space-y-1">
            {outputPlaces.map(p => (
              <div key={p.id} className="px-3 py-2 bg-green-50 border border-green-200 rounded text-sm">
                {p.label || p.id}
                {p.io_description && (
                  <span className="ml-2 text-xs text-gray-600">- {p.io_description}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {!methods.length && <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Input Transitions ({inputTransitions.length})</h3>
        {inputTransitions.length === 0 ? (
          <p className="text-xs text-gray-500">No input transitions marked</p>
        ) : (
          <div className="space-y-1">
            {inputTransitions.map(t => (
              <div key={t.id} className="px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm">
                {t.label || t.id}
              </div>
            ))}
          </div>
        )}
      </div>}

      {!methods.length && <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Output Transitions ({outputTransitions.length})</h3>
        {outputTransitions.length === 0 ? (
          <p className="text-xs text-gray-500">No output transitions marked</p>
        ) : (
          <div className="space-y-1">
            {outputTransitions.map(t => (
              <div key={t.id} className="px-3 py-2 bg-green-50 border border-green-200 rounded text-sm">
                {t.label || t.id}
              </div>
            ))}
          </div>
        )}
      </div>}
    </div>
  );
};
