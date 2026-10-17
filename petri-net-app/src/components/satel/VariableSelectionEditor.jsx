import React, { useState, useEffect } from 'react';
import { parseObservationTokens, groundNotation } from './observationTerms';
import { validBuiltinValue, defaultMethodValue, methodSorts } from '../../utils/builtin-values';

function groundValue(value) {
  if (typeof value === 'string' && value.startsWith('$')) throw new Error('Use concrete values here; quote strings beginning with $.');
  if (value && typeof value === 'object') {
    if (Object.hasOwn(value, 'literal')) return value.literal;
    return Array.isArray(value) ? value.map(groundValue) : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, groundValue(v)]));
  }
  return value;
}
function Values({ variable, onChange, validityKey, onValidityChange }) {
  const h = variable.hypothesis, finite = h.type === 'finite';
  const [draft, setDraft] = useState(null), [error, setError] = useState('');
  useEffect(() => { onValidityChange(validityKey, !!error); return () => onValidityChange(validityKey, false); }, [validityKey, error, onValidityChange]);
  const current = finite ? h.values : [h.representative];
  let formatted = '';
  try { formatted = current.filter(x => x !== undefined).map(groundNotation).join(', '); } catch {}
  return <label className="block text-xs mt-2">{finite ? 'Values to try' : 'Chosen representative'}
    <input aria-label={`${variable.name} ${finite ? 'values' : 'representative'}`} aria-invalid={!!error} className="w-full border rounded p-2 font-mono mt-1" value={draft ?? formatted} onChange={e => {
      setDraft(e.target.value);
      try {
        const values = parseObservationTokens(e.target.value).map(groundValue);
        if (!values.length || values.length > (finite ? 128 : 1)) throw new Error(finite ? 'Supply 1–128 comma-separated values.' : 'Supply exactly one representative.');
        if (methodSorts.includes(variable.sort) && !values.every(v => validBuiltinValue(v, variable.sort))) throw new Error(`Expected ${variable.sort} values.`);
        onChange({ ...variable, hypothesis: { ...h, ...(finite ? { values } : { representative: values[0] }) } }); setError('');
      } catch (err) { setError(err.message); }
    }} />{error && <span role="alert" className="text-red-800">{error}</span>}
  </label>;
}
export default function VariableSelectionEditor({ variable, onChange, onRemove, validityKey, onValidityChange }) {
  const h = variable.hypothesis;
  return <div className="border rounded p-3 bg-slate-50 space-y-2">
    <div className="flex items-end gap-2">
      <label className="min-w-0 flex-1 text-xs">Name<input aria-label={`Variable ${validityKey} name`} className="w-full border rounded p-2" value={variable.name} onChange={e => onChange({ ...variable, name: e.target.value })} /></label>
      <label className="min-w-0 flex-1 text-xs">Sort<input aria-label={`Variable ${validityKey} sort`} className="w-full border rounded p-2" value={variable.sort} onChange={e => onChange({ ...variable, sort: e.target.value })} /></label>
      <button aria-label={`Remove variable ${variable.name}`} className="p-2 text-red-700" onClick={onRemove}>✕</button>
    </div>
    <label className="block text-xs">Selection / hypothesis<select aria-label={`${variable.name} selection`} className="w-full border rounded p-2" value={h.type} onChange={e => {
      const type = e.target.value, value = defaultMethodValue(variable.sort) ?? 0;
      onChange({ ...variable, hypothesis: type === 'finite' ? { type, values: [value] } : type === 'uniformity' ? { type, representative: value } : type === 'subuniformity' ? { type, source: 'constructors' } : { type, bounds: { depth: 2, nbEvents: 5 } } });
    }}>
      <option value="finite">Explicit finite values</option><option value="uniformity">Uniformity — one representative</option>
      {['subuniformity', 'regularity'].includes(h.type) && <option value={h.type}>{h.type} — saved selector</option>}
    </select></label>
    {['finite', 'uniformity'].includes(h.type) ? <Values key={`${h.type}:${variable.sort}`} variable={variable} onChange={onChange} validityKey={validityKey} onValidityChange={onValidityChange} /> : <details><summary>Saved selection settings</summary><p className="text-xs">This older per-variable selector is preserved. Use an equation-based intention for joint symbolic classes.</p>{h.type === 'subuniformity' ? <>
      <label className="block mt-2 text-xs">Saved partition source<select className="block border rounded p-2 w-full" value={h.source} onChange={e => onChange({ ...variable, hypothesis: { ...h, source: e.target.value } })}><option value="constructors">Constructors</option><option value="guards">Guard boundary heuristic</option><option value="axiom">Named axiom selector</option><option value="path-conditions">Path conditions</option></select></label>
      {h.source === 'axiom' && <label className="block text-xs">Axiom name<input className="block border rounded p-2 w-full" value={h.axiom || ''} onChange={e => onChange({ ...variable, hypothesis: { ...h, axiom: e.target.value } })} /></label>}
    </> : <label className="block mt-2 text-xs">Term depth bound<input type="number" min="0" max="10" className="block border rounded p-2" value={h.bounds?.depth ?? 2} onChange={e => onChange({ ...variable, hypothesis: { ...h, bounds: { ...h.bounds, depth: Number(e.target.value) } } })} /></label>}</details>}
    {h.type === 'finite' && <p className="text-xs text-gray-600">Enumerates only these values. No claim about the rest of the sort.</p>}
    {h.type === 'uniformity' && <p className="text-xs text-gray-600">Uses this chosen value as a representative. Conditions may reject it; the generator does not search for a replacement.</p>}
  </div>;
}
