import React from 'react';
import { usePetriNet } from '../../contexts/PetriNetContext';
import './SimulationManager.css';

const SimulationManager = () => {
  const {
    isContinuousSimulating,
    isRunning,
    enabledTransitionIds,
    simulationError,
    isSimulatorReady,
    stepSimulation,
    startContinuousSimulation,
    startRunSimulation,
    stopAllSimulations,
  } = usePetriNet();

  const isAnySimulationRunning = isContinuousSimulating || isRunning;

  return (
    <div data-testid="simulation-manager" className="simulation-manager w-full px-4 py-2 mx-0">
      <h2 className="text-lg font-semibold mb-2">Simulation</h2>

      {simulationError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">
          {simulationError}
        </div>
      )}

      <div className="bg-gray-200 p-3 rounded-lg shadow-lg border border-gray-300">
        {/* Status messages removed intentionally to keep panel minimal */}

        <div className="flex items-center justify-between space-x-3 mb-3">
          <button
            data-testid="sim-step"
            className="flex-1 h-12 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex flex-col items-center justify-center transition-all shadow-md"
            onClick={stepSimulation}
            disabled={!isSimulatorReady || isAnySimulationRunning || enabledTransitionIds.length === 0}
            title="Execute one step forward"
          >
            <div style={{ height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </div>
            <span className="text-xs font-bold">Step</span>
          </button>

          <button
            data-testid="sim-simulate"
            className="flex-1 h-12 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 flex flex-col items-center justify-center transition-all shadow-md"
            onClick={startContinuousSimulation}
            disabled={!isSimulatorReady || isAnySimulationRunning || enabledTransitionIds.length === 0}
            title="Simulate with animation"
          >
            <div style={{ height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M10 18V6l8 6-8 6z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-xs font-bold">Simulate</span>
          </button>

          <button
            data-testid="sim-run"
            className="flex-1 h-12 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:bg-gray-400 flex flex-col items-center justify-center transition-all shadow-md"
            onClick={startRunSimulation}
            disabled={!isSimulatorReady || isAnySimulationRunning || enabledTransitionIds.length === 0}
            title="Run to completion"
          >
            <div style={{ height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7" />
              </svg>
            </div>
            <span className="text-xs font-bold">Run</span>
          </button>
        </div>

        <div>
          <button
            data-testid="sim-stop"
            className="w-full h-10 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 flex items-center justify-center space-x-2 transition-all shadow-md"
            onClick={stopAllSimulations}
            disabled={!isAnySimulationRunning}
            title="Stop simulation or run"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="7" y="7" width="10" height="10" />
            </svg>
            <span className="text-sm font-bold">STOP</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SimulationManager;
