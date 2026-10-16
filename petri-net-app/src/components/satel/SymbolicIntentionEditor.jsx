import React, { useState } from 'react';
import { compileSymbolicIntention, importSymbolicADTXml, guardFromTransition } from '../../satel/core/SymbolicSource.js';
import { useAdtRegistry } from '../../contexts/AdtContext';

export default function SymbolicIntentionEditor({ intention, onChange, onSave, onCancel, elements }) {
  const [error, setError] = useState('');
  const registry = useAdtRegistry();
  const s = intention.symbolic;
  const update = (field, value) => { setError(''); onChange({ ...intention, symbolic: { ...s, [field]: value } }); };
  let invalid = '';
  try { compileSymbolicIntention(intention); } catch (e) { invalid = e.message; }
  return <div className="p-4 space-y-4 text-sm">
    <h3 className="text-lg font-semibold">Symbolic test intention</h3>
    <p>Classes are derived from the typed equations and goal below, before APN execution. These definitions are saved with this intention.</p>
    <label className="block">Name<input aria-label="Symbolic intention name" className="block w-full border p-2 rounded" value={intention.name} onChange={e => onChange({ ...intention, name: e.target.value })} /></label>
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
    <label className="block">Goal variables<input aria-label="Symbolic goal variables" className="block w-full border rounded p-2" placeholder="x: Nat, xs: NatList" value={s.variablesText || ''} onChange={e => update('variablesText', e.target.value)} /></label>
    {s.goalKind !== 'guard' && <label className="block">Operation arguments<input aria-label="Symbolic goal arguments" className="block w-full border rounded p-2" value={s.argsText || ''} onChange={e => update('argsText', e.target.value)} /></label>}
    <label className="block">Goal constraints (optional)<input aria-label="Symbolic goal constraints" className="block w-full border rounded p-2" placeholder="amount <= balance and balance > 0" value={s.conditionsText || ''} onChange={e => update('conditionsText', e.target.value)} /></label>
    <p className="text-xs text-gray-600">Every free goal variable participates in the symbolic domain. Fix an argument to a concrete term to keep it constant. Constraints here are explicit selection assumptions. Guard goals use the declared variables, in declaration order, as protocol inputs.</p>
    <label className="block">Unfolding budget<input aria-label="Unfolding budget" type="number" min="1" max="32" className="block w-full border rounded p-2" value={s.maxDepth} onChange={e => update('maxDepth', Number(e.target.value))} /></label>
    <p className="text-xs text-gray-600">Maximum equation applications along a branch. Unfinished branches stay visible; this is not a bound on the list or tree values represented by a class.</p>
    <label className="block">Stimulation/observation protocol (optional)
      <textarea aria-label="Symbolic pair protocol" spellCheck={false} className="block w-full border rounded p-2 font-mono text-xs" rows={12} value={s.protocolSource || ''} onChange={e => update('protocolSource', e.target.value)} />
    </label>
    <p className="text-xs text-gray-600">Each case matches operation inputs and its equation result, then lists pairs such as “pair withdraw(n=amount) =&gt; ack(1), paidAmount(amount)”. Outputs are tokens produced by that call; unmentioned public places produce none. Leave blank for class derivation only. Public APN methods support Nat, Int, Bool, String, Pair and List parameters and observations. Strings use quotes; lists and pairs may be nested.</p>
    {invalid && <p role="status" className="text-amber-900 bg-amber-50 p-2 rounded">{invalid}</p>}
    <div className="flex gap-2"><button disabled={!!invalid} onClick={onSave} className="bg-blue-700 text-white rounded p-2 disabled:opacity-50">Save Intention</button><button className="border rounded p-2" onClick={onCancel}>Cancel</button></div>
  </div>;
}
