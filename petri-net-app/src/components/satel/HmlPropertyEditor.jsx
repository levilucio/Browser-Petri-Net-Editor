import React, { useCallback, useEffect, useState } from 'react';
import { getPublicMethods, methodSignature } from '../../domain/apn/PublicMethods';
import { defaultMethodValue } from '../../utils/builtin-values';
import { formulaNotation } from '../../satel/core/HmlFormula';
import MethodArgumentInput from './MethodArgumentInput';
import ObservationEditor from './ObservationEditor';

const field = 'w-full min-w-0 border rounded p-2 text-sm';
const labels = { diamond: 'Possible continuation', box: 'Every matching continuation', and: 'All obligations hold here', or: 'Some obligation holds here', not: 'This property must not hold', marking: 'Check the current marking', true: 'No further requirement', false: 'Impossible (no matching outcome allowed)' };
export function newModal(methods) {
  const method = methods[0];
  return { op: 'diamond', stimulation: { method: method?.name || '', arguments: Object.fromEntries((method?.parameters || []).map(p => [p.name, defaultMethodValue(p.sort)])) }, child: { op: 'true' } };
}
function PropertyNode({ node, onChange, methods, places, path, validity }) {
  const [revision, setRevision] = useState(0);
  const observationValidity = useCallback(invalid => validity(`${path}:observation`, invalid), [path, validity]);
  useEffect(() => () => validity(`${path}:observation`, false), [path, validity]);
  const modal = ['diamond', 'box'].includes(node.op);
  useEffect(() => { if (!node.observation && node.op !== 'marking') observationValidity(false); }, [node.observation, node.op, observationValidity]);
  const replace = op => {
    if (['diamond', 'box'].includes(op)) onChange(modal ? { ...node, op } : { ...newModal(methods), op });
    else if (['and', 'or'].includes(op)) onChange({ op, children: node.children || [node, { op: 'true' }] });
    else if (op === 'marking') onChange({ op, markings: {} });
    else if (op === 'not') onChange({ op, child: node });
    else onChange({ op });
  };
  return <div className="border rounded p-2 space-y-2 bg-white min-w-0" aria-label={`Property ${path}`}>
    <label className="block text-xs font-medium">Requirement {path}
      <select aria-label={`Property ${path} requirement`} className={field} value={node.op} onChange={e => replace(e.target.value)}>
        {Object.entries(labels).map(([op, label]) => <option key={op} value={op}>{label}</option>)}
      </select>
    </label>
    {modal && <>
      <label className="block text-xs">Stimulation
        <select aria-label={`Property ${path} method`} className={field} value={node.stimulation.method} onChange={e => {
          const method = methods.find(m => m.name === e.target.value);
          onChange({ ...node, stimulation: { method: method.name, arguments: Object.fromEntries(method.parameters.map(p => [p.name, defaultMethodValue(p.sort)])) } });
        }}><option value="" disabled>Select method…</option>{methods.map(m => <option key={m.name} value={m.name}>{methodSignature(m)}</option>)}</select>
      </label>
      {(methods.find(m => m.name === node.stimulation.method)?.parameters || []).map(p => <label key={`${node.stimulation.method}:${p.name}`} className="block text-xs">{p.name} · {p.sort}
        <MethodArgumentInput value={node.stimulation.arguments[p.name]} sort={p.sort} label={`Property ${path} argument ${p.name}`} validityKey={`${path}:argument:${p.name}`} onValidityChange={validity}
          onChange={value => onChange({ ...node, stimulation: { ...node.stimulation, arguments: { ...node.stimulation.arguments, [p.name]: value } } })} />
      </label>)}
      <label className="block text-xs">Observation filter
        <select aria-label={`Property ${path} observation filter`} className={field} value={!node.observation ? 'any' : node.excludeObservation ? 'other' : 'match'} onChange={e => {
          const next = { ...node }; delete next.observation; delete next.excludeObservation;
          if (e.target.value !== 'any') { next.observation = node.observation || { outputs: {}, markings: {} }; next.excludeObservation = e.target.value === 'other'; }
          onChange(next);
        }}><option value="any">Any observation</option><option value="match">Matching these place expectations</option><option value="other">Not matching these place expectations</option></select>
      </label>
      {node.observation && <ObservationEditor key={`${path}:${revision}`} observation={node.observation} places={places} pairNumber={`property ${path}`} allowRefusal={false}
        onChange={observation => onChange({ ...node, observation })} onValidityChange={observationValidity} />}
      {node.op === 'box' && <p className="text-xs text-amber-900">This allows no matching outcome. To require an outcome as well, add a “possible” property in an “all” group.</p>}
    </>}
    {node.op === 'marking' && <ObservationEditor observation={{ outputs: {}, markings: node.markings }} places={places} pairNumber={`property ${path}`} allowRefusal={false} markingsOnly
      onChange={value => onChange({ ...node, markings: value.markings })} onValidityChange={observationValidity} />}
    {node.children && <div className="space-y-2 border-l-2 border-blue-200 pl-2">
      <p className="text-xs text-gray-600">Each obligation starts from the same state. They are not executed one after another.</p>
      {node.children.map((child, i) => <div key={`${revision}:${i}`} className="space-y-1">
        <PropertyNode node={child} path={`${path}.${i + 1}`} methods={methods} places={places} validity={validity} onChange={value => onChange({ ...node, children: node.children.map((c, j) => i === j ? value : c) })} />
        {node.children.length > 1 && <button type="button" className="text-xs text-red-800" aria-label={`Remove obligation ${path}.${i + 1}`} onClick={() => { setRevision(r => r + 1); onChange({ ...node, children: node.children.filter((_, j) => j !== i) }); }}>Remove obligation</button>}
      </div>)}
      <button type="button" className="text-sm border rounded p-2" onClick={() => onChange({ ...node, children: [...node.children, newModal(methods)] })}>Add obligation at {path}</button>
    </div>}
    {node.child && <details className="border-l-2 border-blue-200 pl-2" open={node.child.op !== 'true'}>
      <summary className="text-xs font-medium cursor-pointer">{modal ? 'Then, in the resulting state' : 'Property to negate'}</summary>
      <PropertyNode key={node.op} node={node.child} path={`${path}.1`} onChange={child => onChange({ ...node, child })} methods={methods} places={places} validity={validity} />
    </details>}
  </div>;
}
export default function HmlPropertyEditor({ formula, onChange, elements, onValidityChange }) {
  let methods = [];
  try { methods = getPublicMethods(elements); } catch {}
  const [errors, setErrors] = useState({});
  const validity = useCallback((key, value) => setErrors(old => old[key] === value ? old : { ...old, [key]: value }), []);
  const invalid = Object.values(errors).some(Boolean);
  useEffect(() => { onValidityChange?.(invalid); }, [invalid, onValidityChange]);
  return <section aria-label="Branching property editor" className="space-y-3">
    <p className="text-sm">Describe possible and required continuations. Every branch shares the same variable values. Calls start from the model’s initial marking.</p>
    <PropertyNode node={formula} onChange={onChange} methods={methods} places={elements.places || []} path="1" validity={validity} />
    <details className="border rounded p-3"><summary>HML notation</summary><pre className="text-xs whitespace-pre-wrap break-words mt-2">{formulaNotation(formula)}</pre>
      <p className="text-xs mt-2">⟨a⟩: some matching successor; [a]: every matching successor; ∧: both at the same state; ∨: either; ¬: negation; ⊤: true; ⊥: false. * matches any observation.</p>
    </details>
  </section>;
}
