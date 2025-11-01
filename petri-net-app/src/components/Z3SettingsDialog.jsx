import React, { useEffect, useState } from 'react';
// setZ3WorkerConfig imported lazily in save handler to avoid Jest requiring worker module
import { usePetriNet } from '../contexts/PetriNetContext';

const Z3SettingsDialog = ({ isOpen, onClose }) => {
  const { z3Settings, setZ3Settings } = usePetriNet();
  const [poolSize, setPoolSize] = useState(0);
  const [idleTimeoutMs, setIdleTimeoutMs] = useState(300000);
  const [prewarmOnAlgebraicMode, setPrewarm] = useState(true);
  const [solverTimeoutMs, setSolverTimeoutMs] = useState(10000);

  useEffect(() => {
    if (!isOpen) return;
    setPoolSize(Number(z3Settings?.poolSize ?? 0));
    setIdleTimeoutMs(Number(z3Settings?.idleTimeoutMs ?? 300000));
    setPrewarm(Boolean(z3Settings?.prewarmOnAlgebraicMode ?? true));
    setSolverTimeoutMs(Number(z3Settings?.solverTimeoutMs ?? 10000));
  }, [isOpen, z3Settings]);

  const onSave = () => {
    const cfg = {
      poolSize: Math.max(0, Number(poolSize) || 0),
      idleTimeoutMs: Math.max(1000, Number(idleTimeoutMs) || 300000),
      prewarmOnAlgebraicMode: Boolean(prewarmOnAlgebraicMode),
      solverTimeoutMs: Math.max(100, Number(solverTimeoutMs) || 10000),
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
                <div className="text-sm">Pool size (0 = on-demand)</div>
                <input
                  type="number"
                  min={0}
                  max={8}
                  value={poolSize}
                  onChange={(e) => setPoolSize(e.target.value)}
                  className="w-24 border rounded px-2 py-1 text-sm"
                />
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
              <div className="flex items-center justify-between">
                <div className="text-sm">Solver timeout (ms)</div>
                <input type="number" min={100} max={60000} step={100} value={solverTimeoutMs} onChange={(e) => setSolverTimeoutMs(e.target.value)} className="w-28 border rounded px-2 py-1 text-sm" />
              </div>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded p-3">
            <h3 className="text-sm font-medium text-purple-800 mb-1">Notes</h3>
            <ul className="text-xs text-purple-700 space-y-1">
              <li>• Pool size 0 keeps workers off until a batch run forces 8 workers</li>
              <li>• Idle timeout trims the pool back to the configured size after bursts</li>
              <li>• Pre-warm hides first-use latency when switching to algebraic-int</li>
              <li>• Solver timeout applies to boolean predicate checks (headless runs benefit from a shorter timeout)</li>
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


