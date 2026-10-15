import React, { useState } from 'react';
import { getPublicMethods } from '../../features/simulation/PublicMethods';

export default function PublicMethodEditor({ transition, elements, setElements, updateHistory }) {
  const [name, setName] = useState(transition.method?.name || '');
  const [parameters, setParameters] = useState(transition.method?.parameters || []);
  const [error, setError] = useState('');
  const save = method => {
    try {
      const next = { ...elements, transitions: elements.transitions.map(t => {
        if (t.id !== transition.id) return t;
        const changed = { ...t };
        if (method) changed.method = method; else delete changed.method;
        return changed;
      }) };
      getPublicMethods(next); setElements(next); updateHistory?.(next); setError('');
    } catch (e) { setError(e.message); }
  };
  return <section className="border-t pt-3 space-y-2 mb-4">
    <h3 className="font-semibold">Public method</h3>
    <p className="text-xs text-gray-600">Rules with the same signature implement alternatives of one method. Undeclared transitions remain internal.</p>
    <label className="block text-sm">Method name<input aria-label="Method name" className="border rounded w-full p-2" value={name} onChange={e => setName(e.target.value)} /></label>
    {parameters.map((p, i) => <div key={i} className="flex gap-1">
      <input aria-label={`Parameter ${i + 1} name`} value={p.name} className="border p-1 min-w-0 flex-1" onChange={e => setParameters(parameters.map((v, j) => j === i ? { ...v, name: e.target.value } : v))} />
      <select aria-label={`Parameter ${i + 1} sort`} value={p.sort} onChange={e => setParameters(parameters.map((v, j) => j === i ? { ...v, sort: e.target.value } : v))}><option>Nat</option><option>Int</option></select>
      <button aria-label={`Remove parameter ${i + 1}`} onClick={() => setParameters(parameters.filter((_, j) => j !== i))}>×</button>
    </div>)}
    <button className="border rounded p-1 text-sm" onClick={() => setParameters([...parameters, { name: `arg${parameters.length + 1}`, sort: 'Nat' }])}>Add parameter</button>
    <div className="flex gap-2"><button className="border rounded p-2 text-sm" onClick={() => save({ name, parameters })}>Save method</button>
      {transition.method && <button className="border rounded p-2 text-sm" onClick={() => save(null)}>Make internal</button>}</div>
    {error && <p role="alert" className="text-red-800 text-sm">{error}</p>}
  </section>;
}
