import React, { useState, useEffect, useMemo } from 'react';
import { usePetriNet } from '../contexts/PetriNetContext';
import { generateTestSuite, executeTestSuite, extractInterface, validateInterface } from '../satel';
import { validateIntention } from '../satel/core/IntentionSchema';
import { AlgebraicSimulator } from '../features/simulation/algebraic-simulator';
import IntentionEditorV2 from './IntentionEditorV2';
import OracleValidationPanel from './OracleValidationPanel';
import SatelTestDisplay, { formatSatelTerm } from './SatelTestDisplay';

const button = 'px-3 py-2 border rounded disabled:opacity-50';

export default function SatelPanel({ isOpen, onClose }) {
  const { elements, setElements, simulationSettings } = usePetriNet();
  const intentions = elements.testIntentions || [];
  const [editing, setEditing] = useState(null);
  const [activeTab, setActiveTab] = useState('intentions');
  const [suite, setSuite] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  // Kept at panel level so closing/tab changes/model loads do not discard the reference.
  const [oracleSession, setOracleSession] = useState(null);
  const isAlgebraic = ['algebraic', 'algebraic-int'].includes(simulationSettings?.netMode);
  const fingerprint = JSON.stringify(elements);
  const visibleResults = results?.fingerprint === fingerprint ? results.run : null;
  useEffect(() => { setEditing(null); setError(null); }, [elements.testIntentions]);
  useEffect(() => {
    if (elements.satelExample) setActiveTab('oracle');
  }, [elements.satelExample]);
  useEffect(() => {
    // Old transfer payloads must never be interpreted as supported intentions.
    if (isOpen && localStorage.getItem('satel-test-intentions')) {
      localStorage.removeItem('satel-test-intentions');
      setError('An old cached intention list was discarded. Reload the example to use its V2 intentions.');
    }
  }, [isOpen]);

  const ioInterface = useMemo(() => {
    if (!isAlgebraic) return null;
    try { return { ...extractInterface(elements), validation: validateInterface(elements) }; }
    catch { return null; }
  }, [elements, isAlgebraic]);

  const save = () => {
    try {
      validateIntention(editing);
      setElements(prev => ({ ...prev, testIntentions: intentions.some(i => i.id === editing.id)
        ? intentions.map(i => i.id === editing.id ? editing : i) : [...intentions, editing] }));
      setEditing(null); setError(null);
    } catch (e) { setError(e.message); }
  };
  const generate = async () => {
    setBusy(true); setError(null); setSuite(null); setResults(null);
    const snapshot = JSON.parse(fingerprint);
    try {
      const generated = await generateTestSuite(intentions, snapshot, new AlgebraicSimulator(), {
        onProgress: p => setProgress(p.message),
      });
      setProgress('Checking every candidate on the reference APN…');
      const checked = await executeTestSuite(generated, snapshot, new AlgebraicSimulator());
      if (!checked.statistics.total || checked.statistics.passed !== checked.statistics.total) {
        setResults({ run: checked, fingerprint });
        setActiveTab('results');
        throw new Error(`Reference admission rejected: ${checked.statistics.failed} failures and ${checked.statistics.errors} errors. No suite admitted.`);
      }
      setSuite({ ...generated, oracleValidated: true, referenceNet: snapshot });
      setResults({ run: checked, fingerprint });
      setActiveTab('results');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); setProgress(''); }
  };
  const execute = async () => {
    setBusy(true); setError(null);
    try {
      const run = await executeTestSuite(suite, JSON.parse(fingerprint), new AlgebraicSimulator());
      setResults({ run, fingerprint }); setActiveTab('results');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (!isOpen) return null;
  return <aside aria-label="SATEL Testing" className="fixed right-0 top-0 bottom-0 w-full sm:w-[540px] bg-white shadow-2xl z-50 flex flex-col border-l">
    <div className="flex items-center justify-between p-4 border-b">
      <h2 className="text-lg font-semibold">SATEL Testing · V2</h2>
      <button aria-label="Close SATEL" onClick={onClose} className={button}>✕</button>
    </div>
    {!isAlgebraic ? <p className="p-4">Switch to Algebraic mode in Settings to use SATEL.</p> : <>
      <nav className="flex border-b text-sm" aria-label="SATEL views">
        {[['oracle', 'Oracle validation'], ['intentions', 'V2 intentions'], ['results', 'Results'], ['interface', 'I/O']].map(([id, label]) =>
          <button key={id} onClick={() => setActiveTab(id)} className={`flex-1 py-3 ${activeTab === id ? 'bg-blue-50 text-blue-700 font-semibold' : ''}`}>{label}</button>)}
      </nav>
      {error && <div role="alert" className="m-3 p-3 bg-red-50 text-red-800 border rounded text-sm">{error}</div>}
      <div className="flex-1 overflow-y-auto">
        {/* Keep async work and controls mounted while switching tabs. */}
        <div hidden={activeTab !== 'oracle'}>
          <OracleValidationPanel elements={elements} session={oracleSession} onSessionChange={setOracleSession} />
        </div>
        {activeTab === 'intentions' && (editing ?
          <IntentionEditorV2 intention={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} elements={elements} /> :
          <div className="p-4 space-y-3">
            <button className={`${button} w-full text-blue-700`} onClick={() => setEditing({
              id: `intention-${Date.now()}`, name: 'New V2 Test Intention', description: '', testType: 'positive', variables: [], pairs: [],
            })}>+ Create V2 Intention</button>
            {!intentions.length && <p className="text-sm text-gray-600">No V2 intentions defined. The account symbolic example is available under Oracle validation.</p>}
            {intentions.map(i => <div key={i.id} className="p-3 border rounded text-sm">
              <strong>{i.name}</strong><p>{i.description}</p>
              <p>{i.testType} · {i.variables?.length || 0} variables · {i.pairs?.length || 0} pairs</p>
              <div className="flex gap-2 mt-2">
                <button className={button} onClick={() => setEditing(JSON.parse(JSON.stringify(i)))}>Edit</button>
                <button className={button} onClick={() => setElements(prev => ({ ...prev, testIntentions: intentions.filter(x => x.id !== i.id) }))}>Delete</button>
              </div>
            </div>)}
          </div>)}
        {activeTab === 'interface' && <InterfaceTab ioInterface={ioInterface} />}
        {activeTab === 'results' && <div className="p-4 space-y-3 text-sm">
          {suite && <p className="p-3 bg-green-50 border rounded">{suite.testCases.length} tests admitted by the reference oracle.</p>}
          {!suite && !visibleResults && <p>No validated V2 suite yet. Generate from the V2 intentions tab.</p>}
          {results && !visibleResults && <p>The loaded APN changed. Replay to see current results.</p>}
          {visibleResults && <>
            <p className="font-semibold">{visibleResults.statistics.passed} passed · {visibleResults.statistics.failed} failed · {visibleResults.statistics.errors} errors</p>
            {visibleResults.testResults.map(r => <details key={r.testCaseId} className="border rounded p-2" open={r.verdict !== 'pass'}>
              <summary>{r.testCaseId}: {r.verdict}</summary>
              {r.summary && <p>{r.summary}</p>}
              {r.error && <p className="text-red-800">{r.error}</p>}
              {r.pairResults?.map((pr, i) => <div key={i} className="mt-2 break-words">
                <p>Pair {i + 1}: {pr.phase === 'error' ? 'error' : pr.success ? 'matched' : 'not matched'} — {pr.error || pr.reason || pr.phase}</p>
                {pr.expected && <p className="font-mono text-xs">Expected {pr.place}: {formatSatelTerm(pr.expected)}</p>}
                {pr.actual && <p className="font-mono text-xs">Actual {pr.place}: {formatSatelTerm(pr.actual)}</p>}
              </div>)}
            </details>)}
          </>}
          {suite?.testCases.map(tc => <details key={tc.id} className="border rounded p-2" open>
            <summary>{tc.intentionName} · {tc.id}</summary>
            <SatelTestDisplay test={tc} pairResults={visibleResults?.testResults.find(r => r.testCaseId === tc.id)?.pairResults} />
          </details>)}
        </div>}
      </div>
      {['intentions', 'results'].includes(activeTab) && !editing && <div className="p-4 border-t space-y-2">
        <button onClick={generate} disabled={busy || !intentions.length} className={`${button} w-full bg-blue-700 text-white`}>Generate and validate V2 suite</button>
        {suite && <button onClick={execute} disabled={busy} className={`${button} w-full`}>Replay V2 suite on loaded APN</button>}
        {busy && <p role="status" className="text-sm">{progress || 'Executing…'}</p>}
      </div>}
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

  const { inputPlaces, outputPlaces, inputTransitions, outputTransitions, validation } = ioInterface;

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

      <div>
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
      </div>

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

      <div>
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
      </div>

      <div>
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
      </div>
    </div>
  );
};
