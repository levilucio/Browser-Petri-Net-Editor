import React, { useMemo, useState } from 'react';
import { useAdtRegistry } from '../contexts/AdtContext';
import { generateADT, parseADT, validateADT } from '../utils/adt-parser';

const sectionTitle = 'text-xs font-semibold text-gray-600 uppercase tracking-wider';

export default function AdtDialog({ isOpen, onClose }) {
  const reg = useAdtRegistry();
  const types = reg.listTypes();
  const [editorXml, setEditorXml] = useState('');
  const [editorError, setEditorError] = useState(null);
  const [editorSuccess, setEditorSuccess] = useState(null);

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
          </div>
        </div>
      </div>
    </div>
  );
}


