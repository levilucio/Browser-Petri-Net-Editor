import React, { useEffect, useState } from 'react';
import { usePetriNet } from '../../contexts/PetriNetContext';
import './SimulationManager.css';

// Completion Dialog Component
const CompletionDialog = ({ stats, onDismiss }) => {
  if (!stats) return null;

  const formatTime = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Simulation Complete</h3>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Duration:</span>
            <span className="font-medium text-gray-900">{formatTime(stats.elapsedMs)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Transitions Fired:</span>
            <span className="font-medium text-gray-900">{stats.transitionsFired}</span>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onDismiss}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

const SimulationManager = ({ isMobile = false }) => {
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
    completionStats,
    dismissCompletionDialog,
  } = usePetriNet();

  const isAnySimulationRunning = isContinuousSimulating || isRunning;
  const canSimulate = isSimulatorReady && enabledTransitionIds.length > 0;
  
  // For mobile: greyed out and transparent when simulation is not possible
  const mobileOpacity = canSimulate ? 'opacity-100' : 'opacity-50';
  const mobileBg = canSimulate ? 'bg-gray-200' : 'bg-gray-100';

  if (isMobile) {
    return (
      <div 
        data-testid="simulation-manager-mobile" 
        className={`${mobileBg} ${mobileOpacity} transition-opacity duration-300 border-t-2 border-gray-300 shadow-lg`}
      >
        <div className="px-3 py-2">
          <h3 className="text-sm font-semibold mb-2 text-gray-700">Simulation</h3>
          
          {simulationError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-xs">
              {simulationError}
            </div>
          )}

          <div className="bg-white bg-opacity-80 p-2 rounded-lg shadow border border-gray-200">
            <div className="flex items-center justify-between space-x-2 mb-2">
              <button
                data-testid="sim-step-mobile"
                className="flex-1 h-10 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:opacity-50 flex flex-col items-center justify-center transition-all shadow-sm text-xs"
                onClick={stepSimulation}
                disabled={!isSimulatorReady || isAnySimulationRunning || enabledTransitionIds.length === 0}
                title="Execute one step forward"
              >
                <div style={{ height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </div>
                <span className="text-xs font-bold">Step</span>
              </button>

              <button
                data-testid="sim-simulate-mobile"
                className="flex-1 h-10 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:opacity-50 flex flex-col items-center justify-center transition-all shadow-sm text-xs"
                onClick={startContinuousSimulation}
                disabled={!isSimulatorReady || isAnySimulationRunning || enabledTransitionIds.length === 0}
                title="Simulate with animation"
              >
                <div style={{ height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18V6l8 6-8 6z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-xs font-bold">Simulate</span>
              </button>

              <button
                data-testid="sim-run-mobile"
                className="flex-1 h-10 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:bg-gray-400 disabled:opacity-50 flex flex-col items-center justify-center transition-all shadow-sm text-xs"
                onClick={() => { try { window.__PETRI_NET_CANCEL_RUN__ = false; } catch (_) {}; startRunSimulation(); }}
                disabled={!isSimulatorReady || isAnySimulationRunning || enabledTransitionIds.length === 0}
                title="Run to completion"
              >
                <div style={{ height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7" />
                  </svg>
                </div>
                <span className="text-xs font-bold">Run</span>
              </button>
            </div>

            <button
              data-testid="sim-stop-mobile"
              className="w-full h-9 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:opacity-50 flex items-center justify-center space-x-2 transition-all shadow-sm text-xs"
              onClick={() => { try { window.__PETRI_NET_CANCEL_RUN__ = true; } catch (_) {}; stopAllSimulations(); }}
              disabled={!isAnySimulationRunning}
              title="Stop simulation or run"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <rect x="7" y="7" width="10" height="10" />
              </svg>
              <span className="text-xs font-bold">STOP</span>
            </button>

            {isRunning && (
              <div className="mt-2 flex items-center justify-center">
                <span className="inline-flex items-center space-x-1 text-green-600 text-xs">
                  <span className="w-3 h-3 bg-green-500 rounded-full sim-pulse-strong" />
                  <span className="font-medium">Running...</span>
                </span>
              </div>
            )}
          </div>
        </div>

        <CompletionDialog
          stats={completionStats}
          onDismiss={dismissCompletionDialog}
        />
      </div>
    );
  }

  // Desktop version (original)
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
            onClick={() => { try { window.__PETRI_NET_CANCEL_RUN__ = false; } catch (_) {}; startRunSimulation(); }}
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
            onClick={() => { try { window.__PETRI_NET_CANCEL_RUN__ = true; } catch (_) {}; stopAllSimulations(); }}
            disabled={!isAnySimulationRunning}
            title="Stop simulation or run"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <rect x="7" y="7" width="10" height="10" />
            </svg>
            <span className="text-sm font-bold">STOP</span>
          </button>
        </div>

        {isRunning && (
          <div className="mt-2 flex items-center justify-center">
            <span className="inline-flex items-center space-x-1 text-green-600">
              <span className="w-4 h-4 bg-green-500 rounded-full sim-pulse-strong" />
              <span className="font-medium text-sm">Simulation running...</span>
            </span>
          </div>
        )}
      </div>

      <CompletionDialog
        stats={completionStats}
        onDismiss={dismissCompletionDialog}
      />
    </div>
  );
};

export default SimulationManager;
