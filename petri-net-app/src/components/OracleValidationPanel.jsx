import React, { useState } from 'react';
import { TestGenerationExplanation, NegativeCoverage } from './satel/GenerationExplanation.jsx';
import SatelTestDisplay, { PlaceObservations } from './SatelTestDisplay';
import { formatSymbolicTerm as term } from '../satel/core/SymbolicTerms.js';
import { useOracleSession } from './satel/hooks/useOracleSession.js';
function Domain({
  domain,
  children
}) {
  return <details className="p-3 border rounded break-words">
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
export default function OracleValidationPanel({
  elements,
  session,
  onSessionChange,
  selectedId,
  onSelect,
  view = 'generated',
  onNavigate
}) {
  const [includeNegative, setIncludeNegative] = useState(false);
  const intentions = elements.testIntentions || [];
  const selected = intentions.find(i => i.id === selectedId) || intentions[0];
  const {
    busy,
    error,
    setError,
    progress,
    fingerprint,
    target,
    currentName,
    generate,
    replay,
    cancel
  } = useOracleSession({
    elements,
    selected,
    session,
    onSessionChange
  });
  const suite = session?.suite,
    report = session?.report;
  const candidates = report?.candidates || [];
  const stale = session && (session.referenceFingerprint !== fingerprint || session.intentionId !== selected?.id);
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(session, null, 2)], {
      type: 'application/json'
    }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'satel-tests-and-results.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  const passed = suite?.validation.referencePassed;
  return <div className="p-4 space-y-4 text-sm" data-testid="oracle-validation">
    <h3 className="font-semibold text-lg">{view === 'replay' ? 'Replay results' : 'Generated tests'}</h3>
    <p><strong>Loaded model:</strong> {currentName}</p>
    {busy && <div><p role="status">{progress}</p><button onClick={cancel} className="border rounded p-2">Cancel</button></div>}
    {error && <div role="alert" className="p-3 border border-red-300 bg-red-50 text-red-800">{error}</div>}
    {view === 'generated' ? <>
      <p>Select values → instantiate pairs → validate on the reference APN.</p>
      {!intentions.length ? <p>No intentions in this model. Create an intention or load a SATEL example.</p> : <>
        <label className="block">Intention<select aria-label="Intention to generate" className="block w-full border rounded p-2" disabled={busy} value={selected?.id || ''} onChange={e => {
            onSelect?.(e.target.value);
            setError(null);
          }}>
          {intentions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select></label>
        <button disabled={busy || selected?.kind === 'symbolic' && !selected.symbolic.protocolSource?.trim()} className="w-full rounded p-2 bg-blue-700 text-white disabled:opacity-50" onClick={() => generate(false, includeNegative && !selected?.formula)}>Generate tests</button>
        <label className="flex gap-2 items-start"><input type="checkbox" aria-label="Include bounded refusal tests" disabled={busy || !!selected?.formula} checked={includeNegative && !selected?.formula} onChange={e => setIncludeNegative(e.target.checked)} /><span>Also select bounded refusal tests from validated positive prefixes</span></label>
        {selected?.formula && <p className="text-xs text-gray-600">Branching properties share fixed variable values across every obligation. Refusals can be written directly as “every outcome → impossible”. Automatic prefix companions apply to linear tests only.</p>}
        {includeNegative && !selected?.formula && <p className="text-xs text-gray-600">At most 10 extra tests. Prefixes stay fixed; terminal parameters may leave the intention’s conditions, within their declared sorts. A call is refused only when no method rule can accept it. Explicit error responses such as ack(0) are accepted calls.</p>}
        {selected?.kind === 'symbolic' && !selected.symbolic.protocolSource?.trim() && <p>This intention has no pair sequence. It supports class analysis only, available under Advanced details.</p>}
        <p className="text-xs text-gray-600">Generation replaces the saved suite. Loading another APN keeps it for replay.</p>
      </>}
      <p className="p-3 border rounded bg-amber-50">Equation-based intentions select values jointly across the complete sequence and any supported additional HML property, starting from the model initial marking. Explicit finite values and chosen representatives remain fixed. Every generated test must then pass concrete reference replay. Exhaustive coverage is not proved.</p>
      {session && <p><strong>Saved run:</strong> {session.intentionName} · {session.referenceName}</p>}
      {stale && <p className="text-amber-900">These tests belong to the saved intention/model snapshot. Generate again to use the current selection or edits.</p>}
      {suite && <div role="status" className="p-3 border border-green-300 bg-green-50"><strong>{passed}/{passed} tests passed the reference oracle</strong><p>Expectations are frozen. Open Replay results to check another APN.</p></div>}
      {session?.validation && !suite && <p>{session.validation.statistics.passed} passed · {session.validation.statistics.failed} failed · {session.validation.statistics.errors} errors on the reference. No suite admitted.</p>}
      {report?.encodingError && <p role="alert" className="text-red-800">Pair sequence encoding: {report.encodingError}</p>}
      {report?.symbolicGoal && report.interface && !report.execution && <p>Class analysis only: these pairs use static witnesses. Generate tests to select executable values and validate them.</p>}
      {report?.execution && <section aria-label="Executable selection" className="p-3 border rounded bg-blue-50">
        <p>{report.intention.branchingProperty ? 'Joint sequence / HML selection' : 'Whole-sequence selection'}: {report.execution.selected.length} executable classes · {report.execution.blocked.length} blocked classes · {report.execution.unresolved.length} unresolved searches.</p>
        <p className="text-sm">Values respect available input tokens, shared variables, guards and expected observations through every pair{report.intention.branchingProperty ? ', together with the additional HML property from the initial marking' : ''}. One representative is selected per algebraic class.</p>
        {[...report.execution.blocked, ...report.execution.unresolved].map((d, i) => <p key={i}>{d.id}: {d.reason}</p>)}
      </section>}
      {report?.decomposition && (!!report.decomposition.unresolved.length || !!report.decomposition.overlaps.length) && <p role="alert" className="bg-amber-50 p-2">Admission blocked: {report.decomposition.unresolved.length} unresolved branches and {report.decomposition.overlaps.length} overlapping or unchecked class pairs. Inspect Advanced details.</p>}
      <NegativeCoverage report={report?.negativeSelection} />
      {!!candidates.length && <section aria-label="Instantiated test sequences" className="space-y-3">
        <h4 className="font-semibold">{suite ? 'Validated tests' : 'Candidate tests — not admitted'}</h4>
        {candidates.map((candidate, i) => <article key={candidate.id} className="border rounded p-3 space-y-2">
          <h5 className="font-semibold">Test {i + 1}{candidate.formula ? ' · branching property' : candidate.pairs?.some(p => p.assertion === 'blocked') ? ' · final refusal' : ' · accepted sequence'}</h5>
          <TestGenerationExplanation test={suite?.selectedTests.find(t => t.id === candidate.id) || candidate} />
          <SatelTestDisplay test={suite?.selectedTests.find(t => t.id === candidate.id) || candidate} io={report?.interface} propertyOrigin="reference" propertyResult={report?.referenceResults?.find(r => r.testCaseId === candidate.id)?.propertyResult} pairResults={session.validation?.testResults.find(r => r.testCaseId === candidate.id)?.pairResults} />
        </article>)}
      </section>}
      <details className="border rounded p-3 space-y-3"><summary className="cursor-pointer font-medium">Advanced details</summary>
        {selected?.kind === 'symbolic' && <button disabled={busy} className="border rounded p-2" onClick={() => generate(true)}>Derive classes without executing the APN</button>}
        {report?.decomposition && <>
          <div className="p-3 border rounded bg-blue-50" data-testid="symbolic-summary">
            <strong>{report.decomposition.domains.length} feasible classes · {report.decomposition.infeasible.length} infeasible branches · {report.decomposition.unresolved.length} unresolved branches</strong>
            <p>{report.intention.name} · unfolding budget {report.symbolicGoal.maxDepth}</p>
            <p>{report.decomposition.disjoint ? 'Completed classes are pairwise disjoint.' : 'Overlapping classes or unresolved overlap checks: admission blocked.'}</p>
            <p>Exhaustive coverage is not proved. One witness per completed class relies on the subuniformity hypothesis.</p>
          </div>
          {!report.interface && <p>Class derivation only: these witnesses are not oracle-validated tests.</p>}
          {!!report.decomposition.unresolved.length && <section aria-label="Unresolved symbolic branches"><h4>Unresolved branches — not discarded or counted as tests</h4>{report.decomposition.unresolved.map((d, i) => <Domain key={i} domain={d} />)}</section>}
          {report.decomposition.overlaps.map((o, i) => <p key={i}>{o.left} ∩ {o.right}: {o.status} {o.reason}</p>)}
          <h4>Classes and selection evidence</h4>
          {report.decomposition.domains.map(d => <Domain key={d.id} domain={d}>
            {report.execution?.selected.find(s => s.id === d.id) && <p><strong>Executable witness:</strong> {report.execution.selected.find(s => s.id === d.id).witnessArgs.map(term).join(', ')} · {report.execution.selected.find(s => s.id === d.id).execution.representative}</p>}
          </Domain>)}
          <details><summary>Infeasible branches ({report.decomposition.infeasible.length})</summary>{report.decomposition.infeasible.map((d, i) => <Domain key={i} domain={d} />)}</details>
          <details><summary>Saved source equations and pair protocol</summary><pre className="text-xs whitespace-pre-wrap break-words">{report.intention.symbolic.source}{'\n\n'}{report.intention.symbolic.protocolSource}</pre></details>
        </>}
        {session && <button onClick={download} className="p-2 border rounded">Download selection, suite and results (JSON)</button>}
      </details>
      {suite && onNavigate && <button onClick={() => onNavigate('replay')} className="w-full border rounded p-2">Continue to replay</button>}
    </> : <>
      {!suite ? <p>No validated suite yet. Generate tests from an intention first.</p> : <>
        <p>{passed} frozen tests from {session.referenceName} · {session.intentionName}</p>
        <button onClick={replay} disabled={busy} className="w-full p-2 rounded bg-purple-700 text-white disabled:opacity-50">Replay frozen suite on loaded APN</button>
        <p className="text-xs text-gray-600">Uses saved expectations and the target’s own initial marking. Load the mutant example, then replay; no regeneration is needed.</p>
        {session.target && !target && <p>Target changed. Replay to obtain current results.</p>}
        {target && <div data-testid="oracle-target-results" className="p-3 border rounded space-y-2">
            <strong>{session.targetName}: {target.counts.pass} passed · {target.counts.fail} failed · {target.counts.error} errors{target.counts.inconclusive ? ` · ${target.counts.inconclusive} inconclusive` : ''}</strong>
            <p>{target.counts.error ? 'Execution error — not counted as a detected mutation.' : target.counts.fail ? 'Behavioral difference detected against the reference expectations.' : target.counts.inconclusive ? 'Exploration incomplete — no conformance claim for unresolved properties.' : 'No difference detected by this suite.'}</p>
            {target.results.map(r => <details key={r.id} className="border-t pt-2" open={r.verdict !== 'pass'}>
              <summary>{r.id}: {r.verdict}{r.step ? ` at step ${r.step}` : ''}</summary>{r.reason && <p>{r.reason}</p>}
              {r.expected && <PlaceObservations label="Expected" outputs={r.expected} />}{r.actual && <PlaceObservations label="Actual" outputs={r.actual} />}
              <SatelTestDisplay test={suite.selectedTests.find(t => t.id === r.id)} io={suite.interface} propertyResult={r.propertyResult} />
            </details>)}
        </div>}
      </>}
    </>}
  </div>;
}
