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

  const [isExpanded, setIsExpanded] = useState(false);

  const isAnySimulationRunning = isContinuousSimulating || isRunning;
  const canSimulate = isSimulatorReady && enabledTransitionIds.length > 0;
  
  // For mobile: greyed out and transparent when simulation is not possible
  const mobileOpacity = canSimulate ? 'opacity-100' : 'opacity-50';
  const mobileBg = canSimulate ? 'bg-gray-200' : 'bg-gray-100';

  // Auto-expand when simulation starts
  useEffect(() => {
    if (isAnySimulationRunning) {
      setIsExpanded(true);
    }
  }, [isAnySimulationRunning]);

  if (isMobile) {
    // Show error as a toast-style notification if present
    const showErrorToast = simulationError && (
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full mb-2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg text-xs whitespace-nowrap z-50">
        {simulationError}
      </div>
    );

    // Drag handle component (reusable)
    const DragHandle = ({ onClick, className = "" }) => (
      <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center cursor-pointer transition-all hover:opacity-70 ${className}`}
        title="Tap to expand/collapse"
      >
        <div className="flex flex-col gap-1">
          <div className="w-8 h-0.5 bg-gray-400 rounded-full"></div>
          <div className="w-8 h-0.5 bg-gray-400 rounded-full"></div>
          <div className="w-8 h-0.5 bg-gray-400 rounded-full"></div>
        </div>
      </button>
    );

    // Collapsed state: show drag handle
    if (!isExpanded) {
      return (
        <>
          <div 
            data-testid="simulation-manager-mobile" 
            className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40 transition-all duration-300 ease-in-out ${mobileOpacity}`}
          >
            {showErrorToast}
            <div className={`bg-white/95 backdrop-blur-md rounded-full px-4 py-2 shadow-2xl border border-gray-200/50 flex items-center justify-center ${!canSimulate ? 'opacity-60' : ''}`}>
              <DragHandle onClick={() => setIsExpanded(true)} />
            </div>
          </div>
          <CompletionDialog
            stats={completionStats}
            onDismiss={dismissCompletionDialog}
          />
        </>
      );
    }

    // Expanded state: show full controls
    // When running, show only Stop button
    if (isAnySimulationRunning) {
      return (
        <>
          <div 
            data-testid="simulation-manager-mobile" 
            className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40 transition-all duration-300 ease-in-out`}
          >
            {showErrorToast}
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/50 flex flex-col items-center">
              {/* Drag handle at top */}
              <div className="w-full flex justify-center pt-2 pb-1">
                <DragHandle onClick={() => setIsExpanded(false)} />
              </div>
              {/* Controls */}
              <div className="flex items-center gap-3 px-4 pb-2">
                {isRunning && (
                  <div className="flex items-center gap-2 text-green-600">
                    <span className="w-2 h-2 bg-green-500 rounded-full sim-pulse-strong" />
                    <span className="text-xs font-medium">Running</span>
                  </div>
                )}
                <button
                  data-testid="sim-stop-mobile"
                  className="bg-red-600 text-white rounded-full p-3 hover:bg-red-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => { try { window.__PETRI_NET_CANCEL_RUN__ = true; } catch (_) {}; stopAllSimulations(); }}
                  disabled={!isAnySimulationRunning}
                  title="Stop simulation"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="7" y="7" width="10" height="10" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <CompletionDialog
            stats={completionStats}
            onDismiss={dismissCompletionDialog}
          />
        </>
      );
    }

    // When not running, show control buttons
    return (
      <>
        <div 
          data-testid="simulation-manager-mobile" 
          className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40 transition-all duration-300 ease-in-out ${mobileOpacity}`}
        >
          {showErrorToast}
          <div className={`bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/50 flex flex-col items-center ${!canSimulate ? 'opacity-60' : ''}`}>
            {/* Drag handle at top */}
            <div className="w-full flex justify-center pt-2 pb-1">
              <DragHandle onClick={() => setIsExpanded(false)} />
            </div>
            {/* Controls */}
            <div className="flex items-center gap-2 px-3 pb-2">
              <button
                data-testid="sim-step-mobile"
                className="bg-blue-600 text-white rounded-full p-3 hover:bg-blue-700 disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                onClick={stepSimulation}
                disabled={!isSimulatorReady || enabledTransitionIds.length === 0}
                title="Step forward"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </button>

              <button
                data-testid="sim-simulate-mobile"
                className="bg-green-600 text-white rounded-full p-3 hover:bg-green-700 disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                onClick={startContinuousSimulation}
                disabled={!isSimulatorReady || enabledTransitionIds.length === 0}
                title="Simulate with animation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18V6l8 6-8 6z" clipRule="evenodd" />
                </svg>
              </button>

              <button
                data-testid="sim-run-mobile"
                className="bg-yellow-600 text-white rounded-full p-3 hover:bg-yellow-700 disabled:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                onClick={() => { try { window.__PETRI_NET_CANCEL_RUN__ = false; } catch (_) {}; startRunSimulation(); }}
                disabled={!isSimulatorReady || enabledTransitionIds.length === 0}
                title="Run to completion"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <CompletionDialog
          stats={completionStats}
          onDismiss={dismissCompletionDialog}
        />
      </>
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
