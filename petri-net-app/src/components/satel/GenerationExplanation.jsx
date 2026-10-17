import React from 'react';
import { formatSymbolicTerm as term } from '../../satel/core/SymbolicTerms.js';
import { SatelBindings, PlaceObservations } from '../SatelTestDisplay.jsx';

export function TestGenerationExplanation({ test }) {
  const domain = test.symbolicDomain, negative = test.negativeSelection;
  return <details className="border rounded p-3 text-xs space-y-2" aria-label="Test generation explanation">
    <summary>Why this test was selected</summary>
    {negative ? <>
      <p>Refusal companion of {negative.seedId}, ending at pair {negative.pair}. The preceding calls and their expected observations were kept fixed.</p>
      <p>The final call’s parameters range over their declared sorts. They may lie outside the original intention’s conditions or subuniformity classes. This is bounded robustness selection, with no class-coverage claim.</p>
      <p>All {negative.rules.length} method rules and {negative.rules.reduce((n, r) => n + r.bindings, 0)} distinct input bindings were included in the refusal constraint.</p>
      <PlaceObservations label="Marking that the refused call must preserve" outputs={negative.expectedMarking} />
    </> : domain ? <>
      <p><strong>Selected class:</strong> {domain.id} · {domain.patterns.map(term).join(', ')}</p>
      <p><strong>Class conditions:</strong> {domain.conditions.map(term).join(' and ') || 'true'}</p>
      <p><strong>Defining equations:</strong> {domain.rules.join(' → ') || 'none'}</p>
      {domain.staticWitness && <p><strong>Static representative:</strong> {domain.staticWitness.args.map(term).join(', ')}</p>}
      <SatelBindings bindings={domain.witnessBindings} />
      <p><strong>Sequence selection:</strong> {domain.execution?.representative || 'Static class analysis only; no execution evidence.'}</p>
      {domain.execution?.hmlSelection?.equationExpansions > 0 && <p>HML selection unfolded {domain.execution.hmlSelection.equationExpansions} operation calls. {domain.execution.hmlSelection.residualCalls ? 'Some alternatives exceeded the unfolding bound; this concrete witness avoids those unresolved alternatives.' : 'No residual equation calls remained in the constructed HML constraints.'}</p>}
      {domain.execution && <p>{domain.execution.pathsTried} complete path(s) considered before this representative was selected. This does not enumerate all possible executions.</p>}
      {domain.execution?.assertions.filter(a => a.kind === 'blocked').map((a, i) => <p key={i}>Final refusal covers {a.refusal?.length || 0} rules and {a.refusal?.reduce((n, r) => n + r.bindings, 0) || 0} input bindings at the reached marking.</p>)}
    </> : <><p>The intention’s declared finite values or explicit representatives were instantiated and filtered by its conditions. Those values were not repaired by the solver.</p><SatelBindings bindings={test.instantiation} /></>}
    {test.propertySelection && <p>{test.propertySelection === 'joint-sequence-and-hml' ? `The sequence and HML requirement jointly selected these values. The additional property must be ${test.branchingExpectedTruth ?? true}; all branches share the same assignment. Concrete reference replay checked the combined test.` : 'Additional branching obligations were checked using the sequence-selected representative. No new representative was solved for these obligations.'}</p>}
    <p>{test.referencePropertyResult ? 'The property has its expected truth value on the reference. Inspect its branching evidence below. This is not a proof of bisimulation.' : test.referenceMarkings ? 'Every pair passed concrete reference replay. Expand each pair’s execution details to inspect the marking after that step.' : 'This candidate has not been admitted by concrete reference replay.'}</p>
  </details>;
}

export function NegativeCoverage({ report }) {
  if (!report) return null;
  const counts = report.attempts.reduce((r, a) => ({ ...r, [a.status]: (r[a.status] || 0) + 1 }), {});
  return <section className="border rounded p-3 bg-amber-50 space-y-2" aria-label="Negative selection coverage">
    <h4 className="font-semibold">Bounded refusal selection</h4>
    <p>{counts.selected || 0} candidates · {counts['no-refusal'] || 0} prefix/call searches with no refused valuation · {report.unresolved.length} unresolved searches.</p>
    <p>{report.truncated ? 'A selection limit was reached; some prefix/call searches were not completed or attempted.' : 'All scheduled prefix/call searches were attempted.'} This is not exhaustive coverage of negative behavior.</p>
    <p>Limits: {report.limits.maxTests} tests, {report.limits.maxAttempts} searches, {report.limits.maxTimeMs / 1000} seconds and {report.limits.maxBindings} binding-search visits. {report.visited} visits used.</p>
    <p>Unresolved searches produce no tests. Successfully admitted tests remain usable; they do not establish coverage of the unresolved cases.</p>
    <details><summary>Selection outcomes by prefix and call</summary>
      <ul className="list-disc pl-5">{report.attempts.map((a, i) => <li key={i}>{a.seedId}, pair {a.pair}, {a.method}: {a.status}{a.reason ? ` — ${a.reason}` : ''}</li>)}</ul>
    </details>
  </section>;
}
