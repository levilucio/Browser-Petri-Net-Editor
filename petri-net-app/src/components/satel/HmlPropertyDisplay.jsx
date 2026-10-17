import React, { useId } from 'react';
import { formulaNotation } from '../../satel/core/HmlFormula';
import { callNotation, explainEvidence, explainProperty, markingRequirement, observationMismatch } from '../../satel/core/HmlExplanation';
import { PlaceObservations, SatelBindings } from '../SatelTestDisplay';
const truth = value => value === null ? 'inconclusive' : value ? 'true' : 'false';
function EvidenceLink({ path, prefix, children }) {
  const id = `${prefix}-${path}`;
  return <a className="text-blue-700 underline" href={`#${id}`} onClick={event => {
    const target = event.currentTarget.ownerDocument.getElementById(id);
    if (!target) return;
    event.preventDefault();
    for (let element = target; element; element = element.parentElement) if (element.tagName === 'DETAILS') element.open = true;
    target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    target.focus({ preventScroll: true });
  }}>{children || `Evidence ${path}`}</a>;
}
function ObservationRequirement({ observation }) {
  if (!observation) return <p className="text-xs">Observation filter: any outcome.</p>;
  return <div className="text-xs space-y-1">
    <PlaceObservations outputs={observation.outputs} label="Observation filter: produced tokens" />
    {Object.entries(observation.markings || {}).map(([place, constraint]) => <p key={place}>Marking at {place} must {markingRequirement(constraint)}.</p>)}
  </div>;
}
function Outcome({ branch, node, formula, prefix, rejected = false }) {
  const mismatch = observationMismatch(branch.observationCheck);
  return <div id={`${prefix}-${node.path}.outcome-${branch.outcome}`} tabIndex={-1} className="border rounded p-2 mt-2 space-y-2">
    <p className="text-xs font-semibold">Outcome {branch.outcome} · rule {branch.transitionId} · {rejected ? 'outside observation filter' : 'matches observation filter'}</p>
    {mismatch && <p className="text-xs" data-diagnostic={mismatch.code}>{mismatch.text}</p>}
    {formula?.excludeObservation && <p className="text-xs">This filter selects outcomes that do not satisfy the listed observation. {rejected ? 'This outcome satisfies that observation and is excluded.' : 'This outcome violates that observation and is included.'}</p>}
    {rejected && <p className="text-xs">No continuation is evaluated for this outcome. {node.op === 'diamond' ? 'It cannot witness this diamond.' : 'It is outside the outcomes constrained by this box.'}</p>}
    <SatelBindings bindings={branch.binding} />
    <PlaceObservations outputs={branch.produced} label="Tokens produced" />
    <details><summary className="text-xs">Resulting marking</summary><PlaceObservations outputs={branch.marking} /></details>
    {branch.child && <Evidence node={branch.child} formula={formula?.child} prefix={prefix} />}
  </div>;
}
function Evidence({ node, formula, prefix }) {
  if (!node) return null;
  const explanation = explainEvidence(node, formula);
  const inspected = (node.branches?.length || 0) + (node.rejectedBranches?.length || 0);
  return <details id={`${prefix}-${node.path}`} tabIndex={-1} className="border-l-2 pl-2 mt-2" open={node.path === '1' || node.value !== true}>
    <summary className="text-xs cursor-pointer break-words">{node.path} · {node.op} · {truth(node.value)}{node.stimulation ? ` · ${callNotation(node.stimulation)}` : ''}</summary>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-2 text-xs" data-diagnostic={explanation.code}>
      <div><p className="font-semibold">Explanation</p><p>{explanation.text}</p></div>
      <div className="min-w-0"><p className="font-semibold">Formal result</p><p className="font-serif break-words whitespace-pre-wrap">{explanation.formal}</p></div>
    </div>
    {node.reusedFrom && <EvidenceLink path={node.reusedFrom} prefix={prefix}>Follow shared evidence {node.reusedFrom}</EvidenceLink>}
    {node.reason && <p className="text-xs text-amber-900">{node.reason}</p>}
    {node.successorCount !== undefined && <>
      <p className="text-xs">{node.successorCount} distinct successors found; enumeration {node.complete ? 'complete' : 'incomplete'}. {node.branches.length} matching continuations evaluated. {node.rejectedBranches?.length || 0} inspected outcomes outside the observation filter.</p>
      {inspected < node.successorCount && <p className="text-xs">{node.successorCount - inspected} further outcomes were not inspected after a decisive result.</p>}
      {formula?.excludeObservation && <p className="text-xs font-medium">Complemented filter: only outcomes violating the listed observation are included.</p>}
      <ObservationRequirement observation={formula?.observation} />
    </>}
    {node.beforeMarking && <details><summary className="text-xs">Marking before call</summary><PlaceObservations outputs={node.beforeMarking} /></details>}
    {node.marking && <PlaceObservations outputs={node.marking} label="Marking being checked" />}
    {node.children?.map((child, i) => <Evidence key={i} node={child} formula={formula?.children?.[i] || formula?.child} prefix={prefix} />)}
    {node.branches?.map((branch, i) => <Outcome key={i} branch={{ ...branch, outcome: branch.outcome ?? i + 1 }} node={node} formula={formula} prefix={prefix} />)}
    {!!node.rejectedBranches?.length && <details className="mt-2"><summary className="text-xs cursor-pointer">Outcomes outside the observation filter ({node.rejectedBranches.length})</summary>
      {node.rejectedBranches.map(branch => <Outcome key={branch.outcome} branch={branch} node={node} formula={formula} prefix={prefix} rejected />)}
    </details>}
  </details>;
}
export default function HmlPropertyDisplay({ formula, expectedTruth = true, result, reference = false }) {
  const prefix = useId();
  const explanation = result && explainProperty(formula, result, expectedTruth);
  return <section className="space-y-2 border rounded p-3" aria-label="Branching property">
    <p className="text-sm font-medium">HML property · expected {String(expectedTruth)}</p>
    <pre className="font-serif text-sm whitespace-pre-wrap break-words" data-testid="satel-hml-formula">{formulaNotation(formula)}</pre>
    <p className="text-xs">⟨…⟩ requires a possible continuation; […] checks every matching continuation (including none). ∧ checks obligations at the same state.</p>
    {result && <div aria-label="Property evaluation evidence">
      <p className="text-sm">{reference ? 'Reference' : 'Target'} property: {truth(result.value)}</p>
      <div className="bg-slate-50 border rounded p-3 text-sm space-y-2" aria-label="Property explanation">
        <p className="font-medium">{explanation.summary}</p>
        {explanation.status !== 'pass' && <>
          <p className="text-xs">The linked evidence explains the observed truth value. Different alternatives may have different reasons; this need not be a single trace.</p>
          <ul className="list-disc pl-4 text-xs space-y-2">{explanation.findings.map((finding, i) => <li key={i}>
            <EvidenceLink path={finding.path} prefix={prefix} />: {finding.text}
          </li>)}</ul>
          {explanation.omitted > 0 && <p className="text-xs">{explanation.omitted} further details are available in the evidence tree below.</p>}
        </>}
      </div>
      <Evidence node={result.evidence} formula={formula} prefix={prefix} />
      <p className="text-xs">M[path] denotes the marking at that evidence node; ⊨ means the requirement holds, ⊭ means it does not, and ⊨ ? means unresolved.</p>
      <p className="text-xs mt-2">{result.stats.successorSearches} successor searches · {result.stats.cacheHits} successor cache hits · {result.stats.formulaCacheHits || 0} property cache hits · {result.stats.evaluatedNodes} formula nodes · {Math.round(result.stats.durationMs)} ms</p>
      <p className="text-xs">Evaluation stops at a decisive witness or counterexample. Unexplored branches are not claimed as covered.</p>
    </div>}
  </section>;
}
