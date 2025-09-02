import React, { useMemo, useState } from 'react';
import { useAdtRegistry } from '../contexts/AdtContext';
import { generateADT, parseADT, validateADT } from '../utils/adt-parser';
import { parseArithmetic } from '../utils/arith-parser';
import { evaluateTermWithBindings, solveEquation } from '../utils/z3-arith';

const sectionTitle = 'text-xs font-semibold text-gray-600 uppercase tracking-wider';

export default function AdtDialog({ isOpen, onClose }) {
  const reg = useAdtRegistry();
  const types = reg.listTypes();
  const [editorXml, setEditorXml] = useState('');
  const [editorError, setEditorError] = useState(null);
  const [editorSuccess, setEditorSuccess] = useState(null);
  // Term/equation evaluator state
  const [termInput, setTermInput] = useState('x + 2 * y');
  const [bindingsInput, setBindingsInput] = useState('x=3, y=4');
  const [termResult, setTermResult] = useState(null);
  const [termError, setTermError] = useState(null);
  const [equationInput, setEquationInput] = useState('x + y = 7');
  const [solutions, setSolutions] = useState([]);
  const [equationError, setEquationError] = useState(null);

  const preview = useMemo(() => {
    const arr = types.map((name) => reg.getType(name));
    return arr;
  }, [types, reg]);

  if (!isOpen) return null;

  const handleAdd = () => {
    setEditorError(null);
    setEditorSuccess(null);
    try {
      const parsed = parseADT(editorXml);
      const res = validateADT(parsed);
      if (!res.valid) {
        setEditorError(res.errors.join('\n'));
        return;
      }
      const xml = generateADT(parsed); // normalize
      const r = reg.addOrReplaceCustomADT(xml);
      if (!r.ok) {
        setEditorError((r.errors || []).join('\n'));
        return;
      }
      setEditorSuccess('Custom ADT added successfully');
      setEditorXml('');
    } catch (e) {
      setEditorError(String(e.message || e));
    }
  };

  function parseBindings(text) {
    const src = String(text || '').trim();
    if (!src) return {};
    // Try JSON first
    try {
      const asObj = JSON.parse(src);
      if (asObj && typeof asObj === 'object' && !Array.isArray(asObj)) return asObj;
    } catch (_) {}
    // Fallback: comma-separated assignments: x=1, y = 2
    const out = {};
    for (const part of src.split(',')) {
      const p = part.trim();
      if (!p) continue;
      const eq = p.indexOf('=');
      if (eq === -1) continue;
      const name = p.slice(0, eq).trim();
      const val = p.slice(eq + 1).trim();
      const n = Number.parseInt(val, 10);
      if (name) out[name] = Number.isFinite(n) ? n : 0;
    }
    return out;
  }

  const handleEvaluateTerm = async () => {
    setTermError(null);
    setTermResult(null);
    try {
      const ast = parseArithmetic(String(termInput || ''));
      const bindings = parseBindings(bindingsInput);
      const value = await evaluateTermWithBindings(ast, bindings);
      setTermResult(value);
    } catch (e) {
      setTermError(String(e.message || e));
    }
  };

  const handleSolveEquation = async () => {
    setEquationError(null);
    setSolutions([]);
    try {
      const txt = String(equationInput || '').trim();
      const eqIdx = txt.indexOf('=');
      if (eqIdx === -1) throw new Error("Equation must contain '='");
      const lhs = parseArithmetic(txt.slice(0, eqIdx));
      const rhs = parseArithmetic(txt.slice(eqIdx + 1));
      const { solutions: sols } = await solveEquation(lhs, rhs, 5);
      setSolutions(sols || []);
    } catch (e) {
      setEquationError(String(e.message || e));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded shadow-lg w-[900px] max-h-[80vh] overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">ADT Manager</h3>
          <button className="px-2 py-1 bg-gray-200 rounded" onClick={onClose}>Close</button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className={sectionTitle}>Definitions</div>
            {preview.map((t) => (
              <div key={t.name} className="mt-3 p-2 border rounded">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{t.name}</div>
                  {t.__readonly && <span className="text-xs px-2 py-0.5 bg-gray-200 rounded">read-only</span>}
                </div>
                <div className="mt-2">
                  <div className="text-xs font-semibold">Operations</div>
                  <div className="mt-1">
                    {(t.operations || []).map((op, idx) => (
                      <div key={idx} className="text-xs font-mono pl-3">- {op.name} / {op.arity} : {op.result}</div>
                    ))}
                    {(!t.operations || t.operations.length === 0) && (
                      <div className="text-xs text-gray-500 pl-3">(none)</div>
                    )}
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-xs font-semibold">Axioms</div>
                  <div className="mt-1">
                    {(t.axioms || []).map((ax, idx) => (
                      <div key={idx} className="text-xs font-mono pl-3">- {(ax.name ? ax.name + ': ' : '')}{ax.equation}</div>
                    ))}
                    {(!t.axioms || t.axioms.length === 0) && (
                      <div className="text-xs text-gray-500 pl-3">(none)</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className={sectionTitle}>Add/Edit Custom ADT (XML)</div>
            <textarea
              className="w-full h-64 border rounded p-2 font-mono text-xs"
              placeholder="Paste ADT XML here (custom types only). Base types are read-only."
              value={editorXml}
              onChange={(e) => { setEditorXml(e.target.value); setEditorError(null); setEditorSuccess(null); }}
            />
            <div className="mt-2 flex items-center space-x-2">
              <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={handleAdd}>Add / Update</button>
              <button className="px-3 py-1 bg-gray-200 rounded" onClick={() => setEditorXml('')}>Clear</button>
            </div>
            {editorError && <div className="mt-2 p-2 text-red-700 bg-red-100 border border-red-200 rounded text-xs whitespace-pre-wrap">{editorError}</div>}
            {editorSuccess && <div className="mt-2 p-2 text-green-700 bg-green-100 border border-green-200 rounded text-xs">{editorSuccess}</div>}
            <div className="mt-3 text-xs text-gray-600">
              Each operation and axiom is shown on its own line in the preview. Types are grouped into separate boxes.
            </div>

            <div className="mt-5 border-t pt-4">
              <div className={sectionTitle}>Term Evaluator (Integers)</div>
              <div className="mt-2 space-y-2">
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Term</label>
                  <input
                    className="w-full border rounded p-2 text-xs font-mono"
                    placeholder="e.g., x + 2 * y"
                    value={termInput}
                    onChange={(e) => setTermInput(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Bindings (JSON or x=1, y=2)</label>
                  <input
                    className="w-full border rounded p-2 text-xs font-mono"
                    placeholder='{"x":3, "y":4} or x=3, y=4'
                    value={bindingsInput}
                    onChange={(e) => setBindingsInput(e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={handleEvaluateTerm}>Evaluate</button>
                  {termResult !== null && (
                    <span className="text-xs">Result: <span className="font-mono">{String(termResult)}</span></span>
                  )}
                </div>
                {termError && (
                  <div className="p-2 text-red-700 bg-red-100 border border-red-200 rounded text-xs whitespace-pre-wrap">{termError}</div>
                )}
              </div>
            </div>

            <div className="mt-5">
              <div className={sectionTitle}>Equation Solver (Integers)</div>
              <div className="mt-2 space-y-2">
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Equation</label>
                  <input
                    className="w-full border rounded p-2 text-xs font-mono"
                    placeholder="e.g., x + y = 7"
                    value={equationInput}
                    onChange={(e) => setEquationInput(e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={handleSolveEquation}>Solve</button>
                </div>
                {equationError && (
                  <div className="p-2 text-red-700 bg-red-100 border border-red-200 rounded text-xs whitespace-pre-wrap">{equationError}</div>
                )}
                {solutions && solutions.length > 0 && (
                  <div className="text-xs">
                    <div className="font-semibold mb-1">Solutions (up to 5):</div>
                    <ul className="list-disc ml-5 space-y-1">
                      {solutions.map((s, idx) => (
                        <li key={idx} className="font-mono">{JSON.stringify(s)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


