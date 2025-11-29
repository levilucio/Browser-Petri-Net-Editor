import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { logger } from '../../utils/logger.js';
import defaultSimulatorCore from './simulator-core.js';
import { createSimulationWorker } from '../../workers/worker-factory';
import { useSimulatorInitialization } from './hooks/useSimulatorInitialization.js';
import {
  createHandleFireTransition,
  createStepSimulation,
  createStartContinuousSimulation,
  createStartRunSimulation,
} from './utils/simulationActions.js';

const useSimulationManager = (
  elements,
  setElements,
  updateHistory,
  netMode,
  simulationSettings = {},
  injectedSimCore
) => {
  // Core simulation state
  const [isContinuousSimulating, setIsContinuousSimulating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [enabledTransitionIds, setEnabledTransitionIds] = useState([]);
  const [simulationError, setSimulationError] = useState(null);
  const [isSimulatorReady, setIsSimulatorReady] = useState(false);
  const [forceResetCounter, setForceResetCounter] = useState(0);

  // Completion dialog state
  const [completionStats, setCompletionStats] = useState(null);

  // Refs for managing intervals and state
  const isContinuousSimulatingRef = useRef(false);
  const isRunningRef = useRef(false);
  const latestElementsRef = useRef(elements);
  const conflictResolverRef = useRef(null);
  const simWorkerRef = useRef(null);

  // Resolve simulator core (allow DI)
  const simulatorCore = injectedSimCore || defaultSimulatorCore;

  const ensureWorker = useCallback(async () => {
    if (simWorkerRef.current) return simWorkerRef.current;
    try {
      const w = createSimulationWorker();
      simWorkerRef.current = w;
      return w;
    } catch (err) {
      console.error('Failed to create simulation worker:', err);
      return null;
    }
  }, []);

  const { refreshEnabledTransitions, debouncedRefresh } = useSimulatorInitialization({
    elements,
    netMode,
    simulatorCore,
    setElements,
    updateHistory,
    setEnabledTransitionIds,
    setIsSimulatorReady,
    setSimulationError,
    latestElementsRef,
    forceResetCounter,
  });

  useEffect(() => {
    latestElementsRef.current = elements;
  }, [elements]);

  // Clear error when it's resolved
  const clearError = useCallback(() => {
    setSimulationError(null);
  }, []);

  const forceSimulatorReset = useCallback(() => {
    logger.debug('Forcing simulator reset');
    setForceResetCounter((prev) => prev + 1);
  }, []);

  // Stop all simulations and reset state
  const stopAllSimulations = useCallback(() => {
    setIsContinuousSimulating(false);
    setIsRunning(false);
    isContinuousSimulatingRef.current = false;
    isRunningRef.current = false;

    try { simulatorCore.deactivateSimulation(); } catch (_) {}
    clearError();
    setEnabledTransitionIds([]);
    try { simWorkerRef.current?.postMessage?.({ op: 'cancel' }); } catch (_) {}
  }, [clearError, simulatorCore]);

  // Manage simulation mode activation/deactivation
  useEffect(() => {
    if (isContinuousSimulating || isRunning) {
      simulatorCore.activateSimulation();
      refreshEnabledTransitions();
    } else {
      simulatorCore.deactivateSimulation();
      // Recompute instead of clearing so panel stays active
      refreshEnabledTransitions();
    }
  }, [isContinuousSimulating, isRunning, refreshEnabledTransitions]);

  // Refresh enabled transitions when simulation is running
  useEffect(() => {
    if (isRunning || isContinuousSimulating) {
      debouncedRefresh();
    }
    return () => debouncedRefresh.cancel();
  }, [isRunning, isContinuousSimulating, debouncedRefresh]);

  // Fire a single transition
  const handleFireTransition = useMemo(
    () => createHandleFireTransition({
      simulatorCore,
      setElements,
      updateHistory,
      clearError,
      refreshEnabledTransitions,
      setSimulationError,
      latestElementsRef,
    }),
    [simulatorCore, setElements, updateHistory, clearError, refreshEnabledTransitions, setSimulationError]
  );

  const stepSimulation = useMemo(
    () => createStepSimulation({
      simulatorCore,
      handleFireTransition,
      conflictResolverRef,
      latestElementsRef,
      refreshEnabledTransitions,
      setSimulationError,
      stopAllSimulations,
    }),
    [
      simulatorCore,
      handleFireTransition,
      conflictResolverRef,
      refreshEnabledTransitions,
      setSimulationError,
      stopAllSimulations,
    ]
  );

  const startContinuousSimulation = useMemo(
    () => createStartContinuousSimulation({
      simulatorCore,
      isContinuousSimulatingRef,
      isRunningRef,
      setIsContinuousSimulating,
      setEnabledTransitionIds,
      stepSimulation,
      refreshEnabledTransitions,
      setSimulationError,
      simulationSettings,
    }),
    [
      simulatorCore,
      isContinuousSimulatingRef,
      isRunningRef,
      setIsContinuousSimulating,
      setEnabledTransitionIds,
      stepSimulation,
      refreshEnabledTransitions,
      setSimulationError,
      simulationSettings,
    ]
  );

  const startRunSimulation = useMemo(
    () => createStartRunSimulation({
      simulatorCore,
      isContinuousSimulatingRef,
      isRunningRef,
      setIsRunning,
      setIsContinuousSimulating,
      refreshEnabledTransitions,
      simulationSettings,
      ensureWorker,
      setElements,
      latestElementsRef,
      updateHistory,
      setSimulationError,
      conflictResolverRef,
      elements,
      handleFireTransition,
      setCompletionStats,
      netMode,
    }),
    [
      simulatorCore,
      isContinuousSimulatingRef,
      isRunningRef,
      setIsRunning,
      setIsContinuousSimulating,
      refreshEnabledTransitions,
      simulationSettings?.limitIterations,
      simulationSettings?.maxIterations,
      simulationSettings?.batchMode,
      simulationSettings?.useNonVisualRun,
      ensureWorker,
      setElements,
      latestElementsRef,
      updateHistory,
      setSimulationError,
      conflictResolverRef,
      elements,
      handleFireTransition,
      setCompletionStats,
      netMode,
    ]
  );

  const dismissCompletionDialog = useCallback(() => {
    setCompletionStats(null);
  }, []);

  return {
    isContinuousSimulating,
    isRunning,
    enabledTransitionIds,
    simulationError,
    isSimulatorReady,
    handleFireTransition,
    stepSimulation,
    startContinuousSimulation,
    startRunSimulation,
    stopAllSimulations,
    clearError,
    forceSimulatorReset,
    completionStats,
    dismissCompletionDialog,
  };
};

export default useSimulationManager;
