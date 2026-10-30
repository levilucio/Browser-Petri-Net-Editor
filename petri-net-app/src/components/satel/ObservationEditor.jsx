import React, { useEffect, useState } from 'react';
import { formatSatelTerm } from '../SatelTestDisplay';
import { parseObservationTokens, formatObservationTokens } from './observationTerms';

const field = 'w-full min-w-0 border rounded px-2 py-2 text-sm';
const constraintKind = c => c?.equals !== undefined ? 'equals' : c?.length !== undefined ? 'length' : c?.empty !== undefined ? (c.empty ? 'empty' : 'nonempty') : c?.contains !== undefined ? 'contains' : c ? 'custom' : 'ignore';

export default function ObservationEditor({ observation, places, pairNumber, onChange, onValidityChange, allowRefusal = true, markingsOnly = false }) {
  const [drafts, setDrafts] = useState({});
  const [errors, setErrors] = useState({});
  const blocked = observation.type === 'notEnabled';
  const invalid = !blocked && Object.values(errors).some(Boolean);
  useEffect(() => { onValidityChange(invalid); }, [invalid, onValidityChange]);
  const clear = key => {
    setDrafts(prev => { const next = { ...prev }; delete next[key]; return next; });
    setErrors(prev => ({ ...prev, [key]: '' }));
  };
  const updateMap = (kind, id, value) => {
    const next = { ...observation[kind] };
    if (value === undefined) delete next[id]; else next[id] = value;
    onChange({ ...observation, [kind]: next });
  };
  // Include saved place IDs even if a place has since been removed from the net.
  const hasGates = places.some(p => p.gate);
  const outputPlaces = hasGates ? places.filter(p => p.gate) : places;
  const outputIds = [...new Set([...outputPlaces.map(p => p.id), ...Object.keys(observation.outputs || {})])];
  const markingIds = [...new Set([...places.filter(p => !p.gate).map(p => p.id), ...Object.keys(observation.markings || {})])];
  const placeName = id => {
    const p = places.find(p => p.id === id);
    return p ? `${p.label || id}${p.label && p.label !== id ? ` (${id})` : ''}${p.gate ? ' · gate' : p.io_type === 'internal' ? ' · internal' : ''}` : `${id} · missing place`;
  };
  const tokensField = (key, values, label, commit) => {
    let formatted, unsupported;
    try { formatted = formatObservationTokens(values); } catch (e) { unsupported = e.message; }
    if (unsupported) return <div className="text-sm"><p>{values.map(formatSatelTerm).join(', ')}</p><p>{unsupported}</p></div>;
    return <div>
      <input aria-label={label} aria-invalid={!!errors[key]} className={field} placeholder="∅ (no tokens)" value={drafts[key] ?? formatted}
        onChange={event => {
          const text = event.target.value;
          setDrafts(prev => ({ ...prev, [key]: text }));
          try { const tokens = parseObservationTokens(text); commit(tokens); setErrors(prev => ({ ...prev, [key]: '' })); }
          catch (e) { setErrors(prev => ({ ...prev, [key]: e.message })); }
        }} />
      {errors[key] && <p role="alert" className="text-xs text-red-800 mt-1">{errors[key]}</p>}
    </div>;
  };
  return <section aria-label={`Pair ${pairNumber} observation`} className="bg-white p-3 rounded space-y-3">
    <h4 className="text-sm font-semibold">Observation</h4>
    {allowRefusal && <label className="block text-xs">Expected outcome
      <select aria-label={`Pair ${pairNumber} expected outcome`} className={field} value={blocked ? 'blocked' : 'fires'} onChange={e => {
        const next = { ...observation };
        if (e.target.value === 'blocked') next.type = 'notEnabled'; else delete next.type;
        onChange(next);
      }}><option value="fires">Call fires: check observations</option><option value="blocked">Call is blocked: marking unchanged</option></select>
    </label>}
    {blocked ? <p className="text-xs text-gray-600">Checks that no rule can accept this stimulation. No firing occurs; place checks are inactive.</p> : <>
      <p className="text-xs text-gray-600">List tokens separated by commas. Repeat a token for multiplicity. Use $variable or constructor terms, e.g. Order(10, High()). An empty field means ∅.</p>
      {!markingsOnly && <fieldset className="space-y-2">
        <legend className="text-sm font-semibold mb-1">{hasGates ? 'Gate occurrences from this call' : 'Tokens produced by this call'}</legend>
        <p className="text-xs text-gray-600">Select a channel to assert its exact occurrences in this interaction. Unchecked channels are unconstrained. Earlier occurrences do not count.</p>
        {outputIds.map(id => <div key={id} className="border rounded p-2 space-y-1">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label={`Pair ${pairNumber} check outputs at ${id}`}
            checked={Object.hasOwn(observation.outputs || {}, id)} onChange={e => { clear(`outputs:${id}`); updateMap('outputs', id, e.target.checked ? [] : undefined); }} />{placeName(id)}</label>
          {Object.hasOwn(observation.outputs || {}, id) && tokensField(`outputs:${id}`, observation.outputs[id], `Pair ${pairNumber} expected outputs at ${id}`, value => updateMap('outputs', id, value))}
        </div>)}
      </fieldset>}
      <details open={markingsOnly || Object.keys(observation.markings || {}).length > 0} className="border-t pt-2">
        <summary className="text-sm font-semibold cursor-pointer">Marking after this call (optional)</summary>
        <p className="text-xs text-gray-600 my-2">Checks all tokens remaining at a place, including earlier tokens.</p>
        <div className="space-y-2">{markingIds.map(id => {
          const constraint = observation.markings?.[id], kind = constraintKind(constraint), key = `markings:${id}`;
          return <div key={id} className="border rounded p-2 space-y-1">
            <label className="block text-sm">{placeName(id)}
              <select aria-label={`Pair ${pairNumber} marking check at ${id}`} className={field} value={kind} onChange={e => {
                clear(key);
                const selected = e.target.value;
                updateMap('markings', id, ({ ignore: undefined, equals: { equals: [] }, contains: { contains: [] }, length: { length: 0 }, empty: { empty: true }, nonempty: { empty: false } })[selected]);
              }}>
                <option value="ignore">Not checked</option><option value="equals">Exactly these tokens</option><option value="contains">Contains these values</option><option value="length">Token count equals</option><option value="empty">Empty</option><option value="nonempty">Nonempty</option>
                {kind === 'custom' && <option value="custom">Existing custom condition (preserved)</option>}
              </select>
            </label>
            {['equals', 'contains'].includes(kind) && tokensField(key, constraint[kind], `Pair ${pairNumber} expected marking at ${id}`, tokens => updateMap('markings', id, { [kind]: tokens }))}
            {kind === 'contains' && <p className="text-xs text-gray-600">Other tokens are allowed. This condition checks value presence; use an exact marking to check multiplicity.</p>}
            {kind === 'length' && <input aria-label={`Pair ${pairNumber} token count at ${id}`} className={field} inputMode="numeric" value={drafts[key] ?? constraint.length} aria-invalid={!!errors[key]} onChange={e => {
              const text = e.target.value, valid = /^\d+$/.test(text) && Number.isSafeInteger(Number(text));
              setDrafts(prev => ({ ...prev, [key]: text })); setErrors(prev => ({ ...prev, [key]: valid ? '' : 'Enter a nonnegative integer.' }));
              if (valid) updateMap('markings', id, { length: Number(text) });
            }} />}
            {kind === 'length' && errors[key] && <p role="alert" className="text-xs text-red-800">{errors[key]}</p>}
          </div>;
        })}</div>
      </details>
    </>}
  </section>;
}
