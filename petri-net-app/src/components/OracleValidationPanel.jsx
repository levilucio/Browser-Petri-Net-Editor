import React, { useState } from 'react';
import SatelTestDisplay, { PlaceObservations } from './SatelTestDisplay';
import { evaluateOracleSuite } from '../satel/core/ValidatedSubuniformity.js';
import { deriveSymbolicIntention, admitSymbolicIntention } from '../satel/core/SymbolicIntention.js';
import { formatSymbolicTerm as term } from '../satel/core/SymbolicTerms.js';

function Domain({ domain, children }) {
  return <details className="p-3 border rounded break-words" open>
    <summary>{domain.witnessArgs ? domain.witnessArgs.map(term).join(', ') : domain.id} · {domain.status}</summary>
    <p className="mt-2"><strong>Pattern:</strong> {domain.patterns.map(term).join(', ')}</p>
    <p><strong>Constraints:</strong> {domain.conditions.map(term).join(' and ') || 'none'}</p>
    <p><strong>Derivation path:</strong> {domain.rules.join(' → ') || 'not unfolded'}</p>
    <p><strong>Result:</strong> {term(domain.resultPattern)}</p>
    {domain.witnessArgs && <p><strong>Witness:</strong> {domain.witnessArgs.map(term).join(', ')} ↦ {term(domain.witnessResult)}</p>}
    {domain.reason && <p className="text-amber-900">{domain.reason}</p>}
    {children}
  </details>;
}
export default function OracleValidationPanel({ elements, session, onSessionChange, selectedId, onSelect }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(null), [progress, setProgress] = useState('');
  const intentions = (elements.testIntentions || []).filter(i => i.kind === 'symbolic');
  const selected = intentions.find(i => i.id === selectedId) || intentions[0];
  const suite = session?.suite;
  const fingerprint = JSON.stringify(elements);
  const target = session?.targetFingerprint === fingerprint ? session.target : null;
  const currentName = elements.satelExample?.name || 'Current editor APN';
  const report = session?.report;
  const reportCurrent = report && session.reportFingerprint === fingerprint && report.intention.id === selected?.id;
  const derive = async (validate = false) => {
    if (!selected) return;
    setBusy(true); setError(null); setProgress('Deriving equation branches and checking constraints with Z3…');
    const snapshot = JSON.parse(fingerprint);
    // A new derivation replaces the previous report/suite, explicitly and atomically.
    onSessionChange(null);
    let next;
    try {
      const derived = await deriveSymbolicIntention(selected, snapshot);
      next = { report: derived, reportFingerprint: fingerprint, referenceName: currentName };
      onSessionChange(next);
      if (validate) {
        setProgress('Checking the instantiated pairs on the loaded reference APN…');
        const admitted = await admitSymbolicIntention(derived, snapshot);
        onSessionChange({ ...next, suite: admitted });
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); setProgress(''); }
  };
  const validateReport = async () => {
    setBusy(true); setError(null); setProgress('Checking the instantiated pairs on the loaded reference APN…');
    try { onSessionChange({ ...session, suite: await admitSymbolicIntention(report, JSON.parse(fingerprint)) }); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); setProgress(''); }
  };
  const replay = async () => {
    setBusy(true); setError(null); setProgress('Replaying frozen expectations…');
    try {
      const result = await evaluateOracleSuite(suite.selectedTests, JSON.parse(fingerprint), suite.interface);
      onSessionChange({ ...session, target: result, targetName: currentName, targetFingerprint: fingerprint });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); setProgress(''); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'satel-symbolic-validation.json'; a.click(); URL.revokeObjectURL(url);
  };
  return <div className="p-4 space-y-4 text-sm" data-testid="oracle-validation">
    <h3 className="font-semibold text-lg">Symbolic subuniformity and oracle validation</h3>
    <p><strong>Loaded model:</strong> {currentName}</p>
    {elements.satelExample?.description && <p>{elements.satelExample.description}</p>}
    <p>Derive constructor/equation classes first. Z3 checks constraints and supplies witnesses; the APN oracle checks the resulting stimulation/observation pairs afterwards.</p>
    {!intentions.length ? <p>No symbolic intentions in this model. Create one in Intentions, or load the SATEL Account or List example.</p> : <>
      <label className="block">Symbolic intention<select aria-label="Symbolic intention" className="block w-full border rounded p-2" disabled={busy} value={selected?.id || ''} onChange={e => { onSelect?.(e.target.value); setError(null); }}>
        {intentions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select></label>
      <p className="text-xs text-gray-600">Edit the equations, goal, unfolding budget and pair protocol in Intentions. Every free goal variable participates in class derivation.</p>
      <button disabled={busy} className="w-full border rounded p-2 disabled:opacity-50" onClick={() => derive(false)}>Derive classes without executing the APN</button>
      {!!selected?.symbolic.protocolSource?.trim() && <button disabled={busy} className="w-full rounded p-2 bg-blue-700 text-white disabled:opacity-50" onClick={() => derive(true)}>Generate and validate on loaded reference</button>}
      <p className="text-xs text-gray-600">A new derivation replaces the saved report and suite. Loading another model keeps them available for review and replay.</p>
    </>}
    {busy && <p role="status">{progress}</p>}
    {error && <div role="alert" className="p-3 border border-red-300 bg-red-50 text-red-800">{error}</div>}
    {report && <>
      <div className="p-3 border rounded bg-blue-50" data-testid="symbolic-summary">
        <strong>{report.decomposition.domains.length} feasible classes · {report.decomposition.infeasible.length} infeasible branches · {report.decomposition.unresolved.length} unresolved branches</strong>
        <p>{report.intention.name} · unfolding budget {report.symbolicGoal.maxDepth}</p>
        <p>{report.decomposition.disjoint ? 'Completed classes are pairwise disjoint.' : 'Overlapping classes or unresolved overlap checks: admission blocked.'}</p>
        <p>Exhaustive coverage is not proved. One witness per completed class relies on the subuniformity hypothesis.</p>
      </div>
      {!reportCurrent && <p className="text-amber-900">This report belongs to the saved intention/model snapshot. Derive again to use the current selection or edits.</p>}
      {report.encodingError && <p role="alert" className="text-red-800">Protocol encoding: {report.encodingError}</p>}
      {!report.interface && <p>Class derivation only: no APN method protocol is declared. These witnesses are not oracle-validated tests.</p>}
      {reportCurrent && report.interface && !suite && <button onClick={validateReport} disabled={busy || !!report.encodingError || !!report.decomposition.unresolved.length || !!report.decomposition.overlaps.length} className="w-full p-2 border rounded disabled:opacity-50">Validate derived pairs on loaded reference</button>}
      {!!report.decomposition.unresolved.length && <section aria-label="Unresolved symbolic branches" className="space-y-2">
        <h4 className="font-semibold text-amber-900">Unresolved branches — not discarded or counted as tests</h4>
        {report.decomposition.unresolved.map((d, i) => <Domain key={i} domain={d} />)}
      </section>}
      {!!report.decomposition.overlaps.length && <div role="alert" className="p-2 bg-amber-50">{report.decomposition.overlaps.map((o, i) => <p key={i}>{o.left} ∩ {o.right}: {o.status} {o.reason}</p>)}</div>}
    </>}
    {suite && <>
      <div role="status" className="p-3 border border-green-300 bg-green-50"><strong>{suite.validation.referencePassed}/{suite.validation.generated} tests passed the reference oracle</strong><p>Frozen from {session.referenceName} · {suite.intention.name}</p></div>
      <button onClick={replay} disabled={busy} className="w-full p-2 rounded bg-purple-700 text-white disabled:opacity-50">Replay frozen suite on loaded APN</button>
      <p className="text-xs text-gray-600">Replay uses saved expectations and the target’s own initial marking. It never regenerates the oracle from the target.</p>
      {session.target && !target && <p>Target changed. Replay to obtain current results.</p>}
      {target && <div data-testid="oracle-target-results" className="p-3 border rounded space-y-2">
        <strong>{session.targetName}: {target.counts.pass} passed · {target.counts.fail} failed · {target.counts.error} errors</strong>
        <p>{target.counts.error ? 'Execution error — not counted as a detected mutation.' : target.counts.fail ? 'Behavioral difference detected against the reference expectations.' : 'No difference detected by this suite.'}</p>
        {target.results.map(r => <details key={r.id} className="border-t pt-2" open={r.verdict !== 'pass'}>
          <summary>{r.id}: {r.verdict}{r.step ? ` at step ${r.step}` : ''}</summary>{r.reason && <p>{r.reason}</p>}
          {r.expected && <PlaceObservations label="Expected" outputs={r.expected} />}{r.actual && <PlaceObservations label="Actual" outputs={r.actual} />}
        </details>)}
      </div>}
    </>}
    {report && <>
      <h4 className="font-semibold">Classes, witnesses and instantiated pairs</h4>
      {report.decomposition.domains.map(d => {
        const test = suite?.selectedTests.find(t => t.id === d.id) || report.candidates.find(t => t.id === d.id);
        return <Domain key={d.id} domain={d}>{test && <><p className="mt-2 font-semibold">{suite ? 'Reference passed' : 'Candidate pairs — not yet oracle-validated'}</p><SatelTestDisplay test={test} io={report.interface} /></>}</Domain>;
      })}
      <details><summary>Infeasible branches ({report.decomposition.infeasible.length})</summary><div className="space-y-2">{report.decomposition.infeasible.map((d, i) => <Domain key={i} domain={d} />)}</div></details>
      <details><summary>Saved source equations and pair protocol</summary><pre className="text-xs whitespace-pre-wrap break-words">{report.intention.symbolic.source}{'\n\n'}{report.intention.symbolic.protocolSource}</pre></details>
      <button onClick={download} className="p-2 border rounded">Download derivation, suite and results (JSON)</button>
    </>}
  </div>;
}
