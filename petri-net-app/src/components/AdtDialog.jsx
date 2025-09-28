import React, { useMemo, useState } from 'react';
import { useAdtRegistry } from '../contexts/AdtContext';
import { parseArithmetic } from '../utils/arith-parser';
import { evaluateTermWithBindings, solveEquation } from '../utils/z3-arith';

const sectionTitle = 'text-xs font-semibold text-gray-600 uppercase tracking-wider';

export default function AdtDialog({ isOpen, onClose }) {
  const reg = useAdtRegistry();
  const types = reg.listTypes();
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

  // Helper function to format operation signature
  const formatOperationSignature = (op) => {
    if (!op.params || op.params.length === 0) {
      return `${op.name}() : ${op.result}`;
    }
    const paramTypes = op.params.map(p => p.type).join(', ');
    return `${op.name}(${paramTypes}) : ${op.result}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded shadow-lg w-[1000px] max-h-[85vh] overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">ADT Manager - Available Types and Operations</h3>
          <button className="px-2 py-1 bg-gray-200 rounded" onClick={onClose}>Close</button>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className={sectionTitle}>Available Data Types</div>
            {preview.map((t) => (
              <div key={t.name} className="mt-3 p-3 border rounded bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold text-lg">{t.name}</div>
                  {t.__readonly && <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">Built-in</span>}
                </div>
                
                <div className="mb-3">
                  <div className="text-sm font-semibold mb-2 text-gray-700">Operations</div>
                  <div className="space-y-1">
                    {(t.operations || []).map((op, idx) => (
                      <div key={idx} className="text-sm font-mono bg-white p-2 rounded border">
                        <span className="text-blue-600 font-semibold">{op.name}</span>
                        <span className="text-gray-600">({op.params ? op.params.map((p, i) => `${p.type} ${String.fromCharCode(97 + i)}`).join(', ') : 'no params'})</span>
                        <span className="text-gray-500"> → </span>
                        <span className="text-green-600 font-semibold">{op.result}</span>
                      </div>
                    ))}
                    {(!t.operations || t.operations.length === 0) && (
                      <div className="text-sm text-gray-500 italic">(no operations)</div>
                    )}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm font-semibold mb-2 text-gray-700">Axioms</div>
                  <div className="space-y-1">
                    {(t.axioms || []).map((ax, idx) => (
                      <div key={idx} className="text-sm font-mono bg-white p-2 rounded border">
                        <span className="text-purple-600 font-semibold">{ax.name ? ax.name + ': ' : ''}</span>
                        <span className="text-gray-800">{ax.equation}</span>
                      </div>
                    ))}
                    {(!t.axioms || t.axioms.length === 0) && (
                      <div className="text-sm text-gray-500 italic">(no axioms)</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div>
            <div className={sectionTitle}>Interactive Tools</div>
            
            <div className="mt-3 p-3 border rounded bg-gray-50">
              <div className="text-sm font-semibold mb-3 text-gray-700">Term Evaluator</div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Arithmetic Expression</label>
                  <input
                    className="w-full border rounded p-2 text-sm font-mono"
                    placeholder="e.g., x + 2 * y, (a, b) == (c, d)"
                    value={termInput}
                    onChange={(e) => setTermInput(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Variable Bindings</label>
                  <input
                    className="w-full border rounded p-2 text-sm font-mono"
                    placeholder='{"x":3, "y":4} or x=3, y=4'
                    value={bindingsInput}
                    onChange={(e) => setBindingsInput(e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm" onClick={handleEvaluateTerm}>Evaluate</button>
                  {termResult !== null && (
                    <span className="text-sm">Result: <span className="font-mono bg-green-100 px-2 py-1 rounded">{String(termResult)}</span></span>
                  )}
                </div>
                {termError && (
                  <div className="p-2 text-red-700 bg-red-100 border border-red-200 rounded text-sm whitespace-pre-wrap">{termError}</div>
                )}
              </div>
            </div>

            <div className="mt-4 p-3 border rounded bg-gray-50">
              <div className="text-sm font-semibold mb-3 text-gray-700">Equation Solver</div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Equation</label>
                  <input
                    className="w-full border rounded p-2 text-sm font-mono"
                    placeholder="e.g., x + y = 7, x * 2 = 10"
                    value={equationInput}
                    onChange={(e) => setEquationInput(e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm" onClick={handleSolveEquation}>Solve</button>
                </div>
                {equationError && (
                  <div className="p-2 text-red-700 bg-red-100 border border-red-200 rounded text-sm whitespace-pre-wrap">{equationError}</div>
                )}
                {solutions && solutions.length > 0 && (
                  <div className="text-sm">
                    <div className="font-semibold mb-2 text-gray-700">Solutions (up to 5):</div>
                    <div className="space-y-1">
                      {solutions.map((s, idx) => (
                        <div key={idx} className="font-mono bg-white p-2 rounded border">{JSON.stringify(s)}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-4 p-3 border rounded bg-blue-50">
              <div className="text-sm font-semibold mb-2 text-blue-800">Usage Notes</div>
              <div className="text-xs text-blue-700 space-y-1">
                <div>• Integer operations: +(Integer a, Integer b), *(Integer a, Integer b), ==(Integer a, Integer b), etc.</div>
                <div>• Boolean operations: and(Boolean a, Boolean b), or(Boolean a, Boolean b), not(Boolean a)</div>
                <div>• Pair operations: fst(Pair p), snd(Pair p), ==(Pair a, Pair b)</div>
                <div>• Pair literals: (value1, value2)</div>
                <div>• All operations support pattern matching and deconstruction</div>
                <div>• Parameter names (a, b, c, ...) are automatically assigned for display</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


