import React from 'react';
import { useAdtRegistry } from '../contexts/AdtContext';

function AdtManager() {
  const { listTypes, getType, baseReadOnly } = useAdtRegistry();
  const types = listTypes();

  return (
    <div className="p-4 border-t border-gray-300">
      <h3 className="text-lg font-medium mb-3">ADT Manager</h3>
      <div className="text-sm text-gray-700">
        {types.length === 0 && <div>No ADTs loaded.</div>}
        {types.map((name) => {
          const t = getType(name);
          const readonly = t.__readonly;
          return (
            <div key={name} className="mb-3 p-2 border rounded bg-white">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{name}</div>
                {readonly && <span className="text-xs px-2 py-0.5 bg-gray-200 rounded">read-only</span>}
              </div>
              <div className="mt-2">
                <div className="font-semibold text-xs text-gray-500">Operations</div>
                <ul className="list-disc ml-5">
                  {(t.operations || []).map((op, idx) => (
                    <li key={idx} className="text-xs">{op.name} / arity {op.arity} : {op.result}</li>
                  ))}
                </ul>
              </div>
              {(t.axioms && t.axioms.length > 0) && (
                <div className="mt-2">
                  <div className="font-semibold text-xs text-gray-500">Axioms</div>
                  <ul className="list-disc ml-5">
                    {t.axioms.map((ax, idx) => (
                      <li key={idx} className="text-xs">{ax.name ? ax.name + ': ' : ''}{ax.equation}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AdtManager;


