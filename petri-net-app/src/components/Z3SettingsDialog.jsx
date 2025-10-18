import React, { useEffect, useState } from 'react';
// setZ3WorkerConfig imported lazily in save handler to avoid Jest requiring worker module
import { usePetriNet } from '../contexts/PetriNetContext';

const Z3SettingsDialog = ({ isOpen, onClose }) => {
  const { z3Settings, setZ3Settings } = usePetriNet();
  const [minWorkers, setMinWorkers] = useState(1);
  const [maxWorkers, setMaxWorkers] = useState(2);
  const [idleTimeoutMs, setIdleTimeoutMs] = useState(300000);
  const [prewarmOnAlgebraicMode, setPrewarm] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setMinWorkers(Number(z3Settings?.minWorkers ?? 0));
    setMaxWorkers(Number(z3Settings?.maxWorkers ?? 2));
    setIdleTimeoutMs(Number(z3Settings?.idleTimeoutMs ?? 300000));
    setPrewarm(Boolean(z3Settings?.prewarmOnAlgebraicMode ?? true));
  }, [isOpen, z3Settings]);

  const onSave = () => {
    const cfg = {
      minWorkers: Math.max(0, Number(minWorkers) || 0),
      maxWorkers: Math.max(1, Number(maxWorkers) || 2),
      idleTimeoutMs: Math.max(1000, Number(idleTimeoutMs) || 300000),
      prewarmOnAlgebraicMode: Boolean(prewarmOnAlgebraicMode),
    };
    try {
      if (typeof window !== 'undefined') {
        import('../utils/z3-remote').then(mod => mod.setZ3WorkerConfig(cfg)).catch(() => {});
      }
    } catch (_) {}
    try { setZ3Settings(cfg); } catch (_) {}
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Z3 Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Worker Pool</label>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm">minWorkers (0 lazy)</div>
                <input type="number" min={0} max={8} value={minWorkers} onChange={(e) => setMinWorkers(e.target.value)} className="w-24 border rounded px-2 py-1 text-sm" />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm">maxWorkers</div>
                <input type="number" min={1} max={16} value={maxWorkers} onChange={(e) => setMaxWorkers(e.target.value)} className="w-24 border rounded px-2 py-1 text-sm" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Lifecycle</label>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm">idleTimeoutMs</div>
                <input type="number" min={1000} max={3600000} step={1000} value={idleTimeoutMs} onChange={(e) => setIdleTimeoutMs(e.target.value)} className="w-28 border rounded px-2 py-1 text-sm" />
              </div>
              <label className="flex items-center text-sm">
                <input type="checkbox" checked={prewarmOnAlgebraicMode} onChange={(e) => setPrewarm(e.target.checked)} className="mr-2" />
                Pre-warm when switching to Algebraic mode
              </label>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded p-3">
            <h3 className="text-sm font-medium text-purple-800 mb-1">Notes</h3>
            <ul className="text-xs text-purple-700 space-y-1">
              <li>• minWorkers ≥ 1 pre-creates workers on load</li>
              <li>• Idle timeout trims the pool down to minWorkers</li>
              <li>• Pre-warm hides first-use latency after switching to algebraic-int</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors mr-2">Cancel</button>
          <button onClick={onSave} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors">Save</button>
        </div>
      </div>
    </div>
  );
};

export default Z3SettingsDialog;


