import React, { useState, useEffect } from 'react';
import { usePetriNet } from '../contexts/PetriNetContext';

const SettingsDialog = ({ isOpen, onClose }) => {
  const { simulatorCore } = usePetriNet();
  const [simulationMode, setSimulationMode] = useState('single');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && simulatorCore) {
      // Get current simulation mode
      try {
        const currentMode = simulatorCore.getSimulationMode ? simulatorCore.getSimulationMode() : 'single';
        setSimulationMode(currentMode);
      } catch (error) {
        console.log('Could not get current simulation mode:', error.message);
      }
    }
  }, [isOpen, simulatorCore]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Simulation Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
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
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsDialog;
