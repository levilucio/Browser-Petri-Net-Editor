import React, { useState } from 'react';
import { usePetriNet } from '../../contexts/PetriNetContext';
import { parseMethodGateSource, serializeMethodGateSource } from '../../domain/apn/MethodGateSyntax';
import { convertOutputPlacesToGates } from '../../domain/apn/GateMigration';
import { getGates } from '../../domain/apn/Gates';
const button = 'px-3 py-2 border rounded disabled:opacity-50';
export default function MethodGateSourceEditor() {
  const { elements, setElements, updateHistory, forceSimulatorReset, isRunning, isContinuousSimulating } = usePetriNet();
  const currentSource = () => {
    try { return { source: serializeMethodGateSource(convertOutputPlacesToGates(elements)), error: '' }; }
    catch (e) { return { source: '', error: `Cannot represent the current model in this source dialect: ${e.message}` }; }
  };
  const [initial] = useState(currentSource);
  const [source, setSource] = useState(initial.source), [message, setMessage] = useState(''), [error, setError] = useState(initial.error);
  const apply = () => {
    try {
      const base = elements.transitions.every(t => t.method) ? convertOutputPlacesToGates(elements) : elements;
      const net = parseMethodGateSource(source, base);
      forceSimulatorReset?.(); setElements(net); updateHistory?.(net);
      setError(''); setMessage('Class applied. Gate occurrences are separate from the marking.');
    } catch (e) { setError(e.message); setMessage(''); }
  };
  const download = () => {
    const blob = new Blob([source], { type: 'text/plain' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `${elements.apnClass || 'APN'}.copn`; a.click(); URL.revokeObjectURL(url);
  };
  let gates = []; try { gates = getGates(elements); } catch { /* Source editor can repair malformed input. */ }
  return <section className="p-4 space-y-3" aria-label="APN methods and gates source">
    <h3 className="font-semibold text-lg">APN methods and gates</h3>
    <p className="text-sm">One method call and its gate occurrences form one completed interaction. Places retain internal state. Multiple axioms may implement the same method.</p>
    <div className="bg-blue-50 rounded p-3 text-sm">
      <h4 className="font-semibold">Declared gates</h4>
      {gates.length ? gates.map(g => <p className="font-mono" key={g.name}>{g.name} : {g.parameters.map(p => p.sort).join(' ') || '(no arguments)'}</p>) : <p>No gates declared yet. Applying a legacy model’s generated source converts its public output places.</p>}
    </div>
    <label className="block text-sm">Class source
      <textarea aria-label="APN class source" className="w-full border rounded p-3 font-mono text-xs mt-1" rows={28} spellCheck={false} value={source} onChange={e => { setSource(e.target.value); setMessage(''); }} />
    </label>
    <div className="flex flex-wrap gap-2">
      <button className={button} onClick={apply} disabled={!source.trim() || isRunning || isContinuousSimulating}>Apply class</button>
      <button className={button} onClick={() => {
        const current = currentSource(); setError(current.error);
        if (current.error) { setMessage(''); return; }
        setSource(current.source); setMessage('Reloaded the current model.');
      }}>Reload current model</button>
      <button className={button} onClick={download}>Download .copn</button>
      <label className={`${button} cursor-pointer`}>Open .copn<input className="sr-only" aria-label="Open APN source file" type="file" accept=".copn,.txt" onChange={async e => {
        const file = e.target.files?.[0]; if (!file) return;
        try { setSource(await file.text()); setError(''); setMessage('Source loaded for review. Apply class to update the model.'); }
        catch (error) { setError(error.message); }
        e.target.value = '';
      }} /></label>
    </div>
    {error && <p role="alert" className="text-red-800 text-sm">{error}</p>}
    {message && <p role="status" className="text-green-800 text-sm">{message}</p>}
    <details className="text-sm"><summary>Syntax and supported fragment</summary>
      <p className="mt-2">A rule has the form <code>ruleId: method args With this.gate (value) :: guard =&gt; pre -&gt; post;</code>. Use <code>//</code> between simultaneous gate calls, commas between marking terms, and <code>empty</code> for an empty marking. Parenthesize compound expressions.</p>
      <p className="mt-2">Typed built-in values; flat class; receptive output environment. Contexts, object creation, autonomous transitions and sequential/alternative gate expressions are outside this fragment. Alternative method rules remain supported. Rule IDs are an editor extension to the thesis syntax. Existing intentions are retained when applying edits.</p>
    </details>
  </section>;
}
