import React from 'react';
import { formulaNotation } from '../../satel/core/HmlFormula';
import { PlaceObservations } from '../SatelTestDisplay';
const truth = value => value === null ? 'inconclusive' : value ? 'true' : 'false';
function Evidence({ node }) {
  if (!node) return null;
  return <details className="border-l-2 pl-2 mt-2" open={node.path === '1' || node.value !== true}>
    <summary className="text-xs cursor-pointer break-words">{node.path} · {node.op} · {truth(node.value)}{node.stimulation ? ` · ${node.stimulation.method}()` : ''}</summary>
    {node.reusedFrom && <p className="text-xs">Same property and complete marking already checked at {node.reusedFrom}.</p>}
    {node.reason && <p className="text-xs text-amber-900">{node.reason}</p>}
    {node.successorCount !== undefined && <p className="text-xs">{node.successorCount} distinct successors found; enumeration {node.complete ? 'complete' : 'incomplete'}. {node.branches.length} matching continuations evaluated.</p>}
    {node.children?.map((child, i) => <Evidence key={i} node={child} />)}
    {node.branches?.map((branch, i) => <div key={i} className="border rounded p-2 mt-2">
      <p className="text-xs">Outcome {i + 1} · rule {branch.transitionId}</p>
      <PlaceObservations outputs={branch.produced} label="Tokens produced" />
      <details><summary className="text-xs">Resulting marking</summary><PlaceObservations outputs={branch.marking} /></details>
      <Evidence node={branch.child} />
    </div>)}
  </details>;
}
export default function HmlPropertyDisplay({ formula, expectedTruth = true, result, reference = false }) {
  return <section className="space-y-2 border rounded p-3" aria-label="Branching property">
    <p className="text-sm font-medium">HML property · expected {String(expectedTruth)}</p>
    <pre className="font-serif text-sm whitespace-pre-wrap break-words" data-testid="satel-hml-formula">{formulaNotation(formula)}</pre>
    <p className="text-xs">⟨…⟩ requires a possible continuation; […] checks every matching continuation (including none). ∧ checks obligations at the same state.</p>
    {result && <div aria-label="Property evaluation evidence">
      <p className="text-sm">{reference ? 'Reference' : 'Target'} property: {truth(result.value)}</p>
      <Evidence node={result.evidence} />
      <p className="text-xs mt-2">{result.stats.successorSearches} successor searches · {result.stats.cacheHits} successor cache hits · {result.stats.formulaCacheHits || 0} property cache hits · {result.stats.evaluatedNodes} formula nodes · {Math.round(result.stats.durationMs)} ms</p>
      <p className="text-xs">Evaluation stops at a decisive witness or counterexample. Unexplored branches are not claimed as covered.</p>
    </div>}
  </section>;
}
