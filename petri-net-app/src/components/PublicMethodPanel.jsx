import { observationChannels } from '../domain/apn/Gates';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePetriNet } from '../contexts/PetriNetContext';
import { getPublicMethods, methodSignature } from '../features/simulation/PublicMethods';
import { parseMethodValue } from '../features/simulation/MethodTerms';
import { PlaceObservations, formatSatelTerm } from './SatelTestDisplay';

function MethodCall({ method, disabled, invoke, outputIds }) {
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState('');
  const call = async () => {
    setBusy(true); setError(''); setMessage(null);
    try {
      const args = Object.fromEntries(method.parameters.map(p => {
        return [p.name, parseMethodValue(values[p.name] ?? '', p.sort)];
      }));
      const result = await invoke(method.name, args);
      setMessage({ ...result, display: `${method.name}(${method.parameters.map(p => formatSatelTerm(args[p.name])).join(', ')})` });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <div className="border rounded-lg p-3 space-y-2 bg-white">
    <h4 className="font-mono text-sm break-words">{methodSignature(method)}</h4>
    {method.parameters.map(p => <label key={p.name} className="block text-sm">{p.name} · {p.sort}
      <input aria-label={`${method.name} argument ${p.name}`} inputMode={['Nat', 'Int'].includes(p.sort) ? 'numeric' : 'text'} value={values[p.name] ?? ''}
        onChange={e => setValues({ ...values, [p.name]: e.target.value })} disabled={disabled || busy}
        className="mt-1 block border rounded w-full px-2 py-2" placeholder={({ Nat: 'Nonnegative integer', Int: 'Integer', Bool: 'true or false', String: '"text" (quotes required)', List: '[1, true, "text"]', Pair: '("text", false)' })[p.sort]} />
    </label>)}
    {!!method.parameters.length && <p className="text-xs text-gray-600">Use quoted strings, true/false, [a, b] for a list, or (a, b) for a pair.</p>}
    <button onClick={call} disabled={disabled || busy} className="px-3 py-2 rounded bg-blue-700 text-white disabled:opacity-50">Call {method.name}</button>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    {message && <div role="status" className="text-sm space-y-2">
      <p>{message.display}: {message.status === 'blocked' ? 'blocked — marking unchanged' : 'fired'}</p>
      {message.status === 'fired' && <PlaceObservations label="Public observation from this call" outputs={Object.fromEntries(outputIds.map(id => [id, message.produced[id] || []]))} />}
    </div>}
  </div>;
}

export default function PublicMethodPanel() {
  const { elements, invokePublicMethod, isContinuousSimulating, isRunning } = usePetriNet();
  let methods;
  try { methods = getPublicMethods(elements); } catch (e) { return <p role="alert">{e.message}</p>; }
  const disabled = isContinuousSimulating || isRunning;
  return <section aria-label="Public method calls" className="p-4 space-y-3">
    <h3 className="font-semibold text-lg">Public methods</h3>
    <p className="text-sm text-gray-600">Calls supply arguments; firings change the current marking. Automatic simulation runs internal transitions only.</p>
    {disabled && <p>Stop automatic simulation before making a call.</p>}
    {!methods.length && <p className="text-sm">Select a transition in the editor to declare a public method.</p>}
    {methods.map(m => <MethodCall key={methodSignature(m) + m.rules.join(',')} method={m} disabled={disabled} invoke={invokePublicMethod} outputIds={observationChannels(elements).filter(p => p.io_type === 'output').map(p => p.id)} />)}
  </section>;
}

export function PublicMethodLauncher() {
  const { elements } = usePetriNet();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const dismiss = event => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [open]);
  if (!elements.transitions?.some(t => t.method)) return null;
  return <>
    <button onClick={() => setOpen(true)} className="fixed bottom-20 right-4 lg:right-[336px] z-40 px-4 py-2 rounded-lg shadow bg-blue-800 text-white">Call public method</button>
    {open && createPortal(<div className="fixed inset-0 z-[70] bg-black/30 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="Call public method">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white flex justify-end p-2 border-b"><button aria-label="Close method calls" onClick={() => setOpen(false)} className="px-3 py-2 border rounded">Close</button></div>
        <PublicMethodPanel />
      </div>
    </div>, document.body)}
  </>;
}
