import React, { useState, useEffect } from 'react';
import { usePetriNet } from '../contexts/PetriNetContext';
import Z3SettingsDialog from './Z3SettingsDialog.jsx';

const SettingsDialog = ({ isOpen, onClose }) => {
  const { simulatorCore, simulationSettings, handleSaveSettings, elements } = usePetriNet();
  const [simulationMode, setSimulationMode] = useState('single');
  const [isLoading, setIsLoading] = useState(false);
  const [maxTokens, setMaxTokens] = useState(20);
  const [maxIterations, setMaxIterations] = useState(100);
  const [unlimitedIterations, setUnlimitedIterations] = useState(false);
  const [netMode, setNetMode] = useState('pt');
  const [netModeLocked, setNetModeLocked] = useState(false);
  const [z3Open, setZ3Open] = useState(false);
  const [useNonVisualRun, setUseNonVisualRun] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Get current simulation mode
      try {
        if (simulatorCore) {
          const currentMode = simulatorCore.getSimulationMode ? simulatorCore.getSimulationMode() : 'single';
          setSimulationMode(currentMode);
        }
      } catch (error) {
        console.log('Could not get current simulation mode:', error.message);
      }

      // Initialize settings from context
      const ctxMaxTokens = Number(simulationSettings?.maxTokens ?? 20);
      const ctxMaxIterations = simulationSettings?.maxIterations;
      setMaxTokens(Number.isFinite(ctxMaxTokens) && ctxMaxTokens > 0 ? ctxMaxTokens : 20);
      if (ctxMaxIterations === Infinity) {
        setUnlimitedIterations(true);
        setMaxIterations(100); // default UI value when toggling off unlimited
      } else {
        setUnlimitedIterations(false);
        setMaxIterations(Number.isFinite(Number(ctxMaxIterations)) ? Number(ctxMaxIterations) : 100);
      }
      const currentNetMode = simulationSettings?.netMode || 'pt';
      setNetMode(currentNetMode);
      setUseNonVisualRun(Boolean(simulationSettings?.useNonVisualRun));
      // Lock switching if canvas is not empty
      try {
        const hasContent = (elements?.places?.length || 0) > 0 || (elements?.transitions?.length || 0) > 0 || (elements?.arcs?.length || 0) > 0;
        setNetModeLocked(Boolean(hasContent));
      } catch (_) {
        setNetModeLocked(false);
      }
    }
  }, [isOpen, simulatorCore, simulationSettings]);

  const handleModeChange = async (newMode) => {
    if (!simulatorCore || !simulatorCore.setSimulationMode) {
      setSimulationMode(newMode);
      return;
    }

    setIsLoading(true);
    try {
      await simulatorCore.setSimulationMode(newMode);
      setSimulationMode(newMode);
      console.log('Simulation mode changed to:', newMode);
    } catch (error) {
      console.error('Failed to change simulation mode:', error);
      // Revert to previous mode
      setSimulationMode(simulationMode);
    } finally {
      setIsLoading(false);
    }
  };

  const onSave = () => {
    const tokens = Math.max(1, Math.min(9999, Number(maxTokens) || 20));
    const iterations = unlimitedIterations ? Infinity : Math.max(1, Math.min(1000000, Number(maxIterations) || 100));
    handleSaveSettings({
      ...simulationSettings,
      maxTokens: tokens,
      maxIterations: iterations,
      netMode,
      useNonVisualRun
    });
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Simulation Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
            data-testid="settings-close"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {/* Limits */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Limits</label>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm">Max tokens (also caps arc weights)</div>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                  className="w-24 border rounded px-2 py-1 text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm">Max iterations</div>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min={1}
                    max={1000000}
                    value={unlimitedIterations ? '' : maxIterations}
                    onChange={(e) => setMaxIterations(e.target.value)}
                    disabled={unlimitedIterations}
                    className="w-24 border rounded px-2 py-1 text-sm disabled:bg-gray-100"
                  />
                  <label className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={unlimitedIterations}
                      onChange={(e) => setUnlimitedIterations(e.target.checked)}
                      className="mr-1"
                    />
                    Unlimited
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Non-visual run toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Run Options</label>
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={useNonVisualRun}
                onChange={(e) => setUseNonVisualRun(e.target.checked)}
                className="mr-2"
              />
              Use non-visual execution for Run (no per-step animations)
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Simulation Mode
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="simulationMode"
                  value="single"
                  checked={simulationMode === 'single'}
                  onChange={(e) => handleModeChange(e.target.value)}
                  disabled={isLoading}
                  className="mr-2"
                />
                <span className="text-sm">
                  <strong>Single Transition</strong> - Fire one enabled transition at random
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="simulationMode"
                  value="maximal"
                  checked={simulationMode === 'maximal'}
                  onChange={(e) => handleModeChange(e.target.value)}
                  disabled={isLoading}
                  className="mr-2"
                />
                <span className="text-sm">
                  <strong>Maximal Concurrent</strong> - Fire all non-conflicting enabled transitions simultaneously
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Net Type
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="netMode"
                  value="pt"
                  checked={netMode === 'pt'}
                  onChange={(e) => setNetMode(e.target.value)}
                  disabled={netModeLocked}
                  className="mr-2"
                />
                <span className="text-sm">
                  <strong>P/T Net</strong> - Classic place/transition nets with counts
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="netMode"
                  value="algebraic-int"
                  checked={netMode === 'algebraic-int'}
                  onChange={(e) => setNetMode(e.target.value)}
                  disabled={netModeLocked}
                  className="mr-2"
                />
                <span className="text-sm">
                  <strong>Algebraic (Integer)</strong> - Integer tokens with guard and term labels
                </span>
              </label>
              {netModeLocked && (
                <div className="text-xs text-gray-600">
                  Net type is locked while the canvas has elements. Clear the canvas to switch.
                </div>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <h3 className="text-sm font-medium text-blue-800 mb-1">How it works:</h3>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• <strong>Single:</strong> Randomly chooses one enabled transition to fire</li>
              <li>• <strong>Maximal:</strong> Finds the largest set of non-conflicting transitions and fires them all</li>
              <li>• <strong>Conflict Resolution:</strong> When transitions share input places, one is chosen randomly</li>
            </ul>
          </div>

          {isLoading && (
            <div className="text-center text-sm text-gray-600">
              Updating simulation mode...
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setZ3Open(true)}
            className="px-3 py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors mr-auto"
          >
            Z3 Settings
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors mr-2"
            data-testid="settings-cancel"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            data-testid="settings-save"
          >
            Save
          </button>
        </div>
      </div>
      {z3Open && (
        <Z3SettingsDialog isOpen={z3Open} onClose={() => setZ3Open(false)} />
      )}
    </div>
  );
};

export default SettingsDialog;
