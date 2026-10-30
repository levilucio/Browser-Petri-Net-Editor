import HmlPropertyEditor from './HmlPropertyEditor';
import React, { useState, useEffect, useCallback } from 'react';
import { protocolCases, replaceProtocolSequence } from '../../satel/core/IntentionNotation.js';
import { compileSymbolicIntention, importSymbolicADTXml, guardFromTransition } from '../../satel/core/SymbolicSource.js';
import { useAdtRegistry } from '../../contexts/AdtContext';

function SequenceCase({ value, label, onChange, onValidityChange }) {
  const [draft, setDraft] = useState(value), [error, setError] = useState('');
  useEffect(() => { setDraft(value); setError(''); }, [value]);
  useEffect(() => { onValidityChange(label, !!error); return () => onValidityChange(label, false); }, [error, label, onValidityChange]);
  return <label className="block font-medium">{label}<textarea aria-label={label} aria-invalid={!!error} spellCheck={false} rows={5} className="block w-full rounded border p-3 font-mono text-xs mt-2" value={draft} onChange={e => {
    setDraft(e.target.value);
    try { onChange(e.target.value); setError(''); } catch (err) { setError(err.message); }
  }} />{error && <span role="alert" className="text-red-800 text-xs">{error}</span>}</label>;
}
export default function SymbolicIntentionEditor({ intention, onChange, onSave, onCancel, elements }) {
  const [error, setError] = useState('');
  const [propertyInvalid, setPropertyInvalid] = useState(false);
  const [sequenceErrors, setSequenceErrors] = useState({});
  const sequenceValidity = useCallback((key, value) => setSequenceErrors(prev => prev[key] === value ? prev : { ...prev, [key]: value }), []);
  const registry = useAdtRegistry();
  const s = intention.symbolic;
  const update = (field, value) => { setError(''); onChange({ ...intention, symbolic: { ...s, [field]: value } }); };
  let cases = [];
  try { cases = protocolCases(s.protocolSource || ''); } catch {}
  let invalid = '';
  try { compileSymbolicIntention(intention); } catch (e) { invalid = e.message; }
  return <div className="p-4 space-y-4 text-sm">
    <h3 className="text-lg font-semibold">Test intention</h3>
    <p>Variables and conditions select instances of the pair sequences below. Each sequence starts from the model’s initial marking.</p>
    <label className="block">Name<input aria-label="Symbolic intention name" className="block w-full border p-2 rounded" value={intention.name} onChange={e => onChange({ ...intention, name: e.target.value })} /></label>
    <label className="block">Variables<input aria-label="Symbolic goal variables" className="block w-full border rounded p-2" placeholder="x: Nat, xs: NatList" value={s.variablesText || ''} onChange={e => update('variablesText', e.target.value)} /></label>
    <label className="block">Conditions (optional)<input aria-label="Symbolic goal constraints" className="block w-full border rounded p-2" placeholder="amount <= balance and balance > 0" value={s.conditionsText || ''} onChange={e => update('conditionsText', e.target.value)} /></label>
    <section className="p-3 bg-slate-50 border rounded space-y-2" aria-label="Selection hypothesis">
      <h4 className="font-semibold">Hypothesis</h4>
      <p className="font-mono text-xs break-words">subUniformity({s.variablesText || 'no free variables'})</p>
      <p>Choose one representative per completed symbolic class of the saved selection expression:</p>
      <p className="font-mono text-xs break-words">{s.goalKind === 'guard' ? s.guardText : `${s.operation}(${s.argsText || ''})`}</p>
      <p className="text-xs text-gray-600">ADT equations unfold the operations used in this expression. This is a static selection assumption, not a proof of semantic equivalence or exhaustive coverage.</p>
    </section>
    <section aria-label="Intention pair sequences" className="space-y-4">
      <h4 className="font-semibold">Stimulation / observation sequences</h4>
      <p className="text-xs text-gray-600">Write one {'{ method(parameter=value) with gate(value) // gate(value) }'} pair per line. A dot separates successive pairs. Observations here describe tokens produced by the call; unmentioned public outputs produce none. Use “none” for no produced tokens from an accepted call, or “refused” for a final call that must be blocked with the marking unchanged.</p>
      {cases.map((c, index) => <div key={`${index}:${c.name}`} className="border rounded p-3 bg-blue-50 space-y-2">
        <p className="font-mono text-xs break-words">{c.header[0].replace(/^case /, '').replace(/:$/, '')}</p>
        <SequenceCase label={`Sequence: ${c.name}`} value={c.pairs.join(' .\n')} onValidityChange={sequenceValidity} onChange={text => {
          const protocolSource = replaceProtocolSequence(s.protocolSource, index, text);
          compileSymbolicIntention({ ...intention, symbolic: { ...s, protocolSource } });
          update('protocolSource', protocolSource);
        }} />
        <details className="text-xs"><summary>How this sequence binds selection values</summary><pre className="whitespace-pre-wrap break-words">{c.header.join('\n')}</pre><p>These input and result patterns bind the case variables before its pairs are instantiated. Edit them in Advanced selection settings.</p></details>
      </div>)}
      {!cases.length && <p>No pair sequence yet. Define a protocol in Advanced selection settings to turn class analysis into executable tests.</p>}
    </section>
    <section className="border rounded p-3 space-y-2">
      <h4 className="font-semibold">Additional branching requirements</h4>
      <p className="text-xs text-gray-600">The sequence and this property jointly select one shared assignment to the goal variables. Both start from the initial marking. Use $name to refer to a goal variable. Joint selection supports Nat, Int, Bool, String, List and Pair. List and Pair operations use bounded equation unfolding; an exhausted search remains unresolved. Concrete reference replay checks the complete selected test.</p>
      {intention.branchingProperty ? <>
        <label className="block">Expected additional property truth<select aria-label="Expected additional property truth" className="border rounded p-2 ml-2" value={String(intention.branchingExpectedTruth ?? true)} onChange={e => onChange({ ...intention, branchingExpectedTruth: e.target.value === 'true' })}><option value="true">Must hold</option><option value="false">Must not hold</option></select></label>
        <HmlPropertyEditor formula={intention.branchingProperty} elements={elements} onValidityChange={setPropertyInvalid} onChange={branchingProperty => onChange({ ...intention, branchingProperty })} />
        <button className="border rounded p-2" onClick={() => { const next = { ...intention }; delete next.branchingProperty; delete next.branchingExpectedTruth; setPropertyInvalid(false); onChange(next); }}>Remove branching requirements</button>
      </> : <button className="border rounded p-2" onClick={() => onChange({ ...intention, branchingProperty: { op: 'true' } })}>Add branching requirements</button>}
    </section>
    <details className="border rounded p-3 space-y-4"><summary className="cursor-pointer font-semibold">Advanced selection settings</summary>
      <p>The saved definitions below drive selection. Changing an APN guard does not automatically change them. When a pair sequence is present, selection propagates the APN marking and solves for values satisfying the whole sequence. Concrete reference replay then checks the selected test.</p>
    <label className="block">ADT constructors and operation equations
      <textarea aria-label="ADT constructors and operation equations" spellCheck={false} className="block w-full border p-2 rounded font-mono text-xs" rows={16} value={s.source} onChange={e => update('source', e.target.value)} />
    </label>
    <button className="border rounded p-2" onClick={() => {
      try { update('source', importSymbolicADTXml(elements.adtDefinitions || registry.exportCustomADTXml())); } catch (e) { setError(e.message); }
    }}>Import custom editor ADT XML</button>
    {error && <p role="alert" className="text-red-800">{error}</p>}
    <details className="border rounded p-2"><summary>Equation notation and supported scope</summary>
      <p>Declare constructor Name(Sort, …) : Sort and operation name(Sort, …) : Sort. Each rule is on one line:</p>
      <pre className="text-xs whitespace-pre-wrap">{'rule head(x: Nat, y: Nat, ys: NatList): member(x, Cons(y, ys)) = true if x == y'}</pre>
      <p>Conditions support comparisons, and, or, not, xor, implies and iff (also &amp;&amp;, ||, !, ^, → as -&gt;, and &lt;-&gt;). Parenthesize compound expressions. Each variable has one shared value throughout the guard. Numeric expressions support +, − and multiplication. Constructors are free and equality is structural. Nat is nonnegative; Int is signed. No quotient axioms or implicit evaluation of JavaScript.</p>
      <p>Built-in Int, Nat, Bool, String, Pair and List operations are available without declarations: length, concat, substring, isSubstringOf, fst, snd, head, tail, append, sublist and isSublistOf. Use [1, true] for lists and (1, false) for pairs. Heterogeneous elements have sort Any; use asInt/asBool/asString/asList/asPair when a projection is needed. Equality is structural. Division is not part of this library.</p>
      <p>Custom XML imports require explicit constructors, typed parameters and oriented operation equations. Unsupported or overloaded axioms are reported.</p>
    </details>
    <label className="block">Derive classes from<select aria-label="Symbolic goal kind" className="block w-full border rounded p-2" value={s.goalKind || 'operation'} onChange={e => update('goalKind', e.target.value)}><option value="operation">Operation equations</option><option value="guard">Guard — true and false regions</option></select></label>
    {s.goalKind === 'guard' ? <>
      <label className="block">Guard expression<textarea aria-label="Symbolic guard" className="block w-full border rounded p-2" rows={3} value={s.guardText || ''} onChange={e => update('guardText', e.target.value)} /></label>
      <label className="block">Copy a transition guard<select aria-label="Import transition guard" value="" className="block w-full border rounded p-2" onChange={e => {
        try { const imported = guardFromTransition(elements, e.target.value, s.source); setError(''); onChange({ ...intention, symbolic: { ...s, ...imported, protocolSource: '' } }); } catch (e) { setError(e.message); }
      }}><option value="">Choose transition…</option>{(elements.transitions || []).filter(t => t.guard?.trim()).map(t => <option key={t.id} value={t.id}>{t.label || t.id}</option>)}</select></label>
      <p className="text-xs text-gray-600">Copies the guard and its variable sorts into this intention. Later transition edits do not change this saved definition. Import clears the protocol so you can define a matching pair sequence. True/false classes describe the guard, not reachability from the APN initial marking.</p>
    </> : <label className="block">Operation<input aria-label="Symbolic operation" className="block w-full border rounded p-2" value={s.operation || ''} onChange={e => update('operation', e.target.value)} /></label>}
    {s.goalKind !== 'guard' && <label className="block">Operation arguments<input aria-label="Symbolic goal arguments" className="block w-full border rounded p-2" value={s.argsText || ''} onChange={e => update('argsText', e.target.value)} /></label>}
    <label className="block">Unfolding budget<input aria-label="Unfolding budget" type="number" min="1" max="32" className="block w-full border rounded p-2" value={s.maxDepth} onChange={e => update('maxDepth', Number(e.target.value))} /></label>
    <p className="text-xs text-gray-600">Maximum equation applications along a branch. Unfinished branches stay visible; this is not a bound on the list or tree values represented by a class.</p>
    <label className="block">Stimulation/observation protocol (optional)
      <textarea aria-label="Symbolic pair protocol" spellCheck={false} className="block w-full border rounded p-2 font-mono text-xs" rows={12} value={s.protocolSource || ''} onChange={e => update('protocolSource', e.target.value)} />
    </label>
    <p className="text-xs text-gray-600">Each case matches operation inputs and its equation result, then lists pairs such as “pair withdraw(n=amount) =&gt; ack(1), paidAmount(amount)”. Use “pair withdraw(n=amount) =&gt; refused” for a forbidden final call. Outputs are tokens produced by an accepted call; unmentioned public outputs produce none. Leave blank for class derivation only. Public APN methods support Nat, Int, Bool, String, Pair and List parameters and observations. Strings use quotes; lists and pairs may be nested.</p>
    </details>
    {invalid && <p role="status" className="text-amber-900 bg-amber-50 p-2 rounded">{invalid}</p>}
    <div className="flex gap-2"><button disabled={!!invalid || propertyInvalid || Object.values(sequenceErrors).some(Boolean)} onClick={onSave} className="bg-blue-700 text-white rounded p-2 disabled:opacity-50">Save Intention</button><button className="border rounded p-2" onClick={onCancel}>Cancel</button></div>
  </div>;
}
