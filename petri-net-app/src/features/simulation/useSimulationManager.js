import { useState, useEffect, useCallback, useRef } from 'react';
import defaultSimulatorCore from './simulator-core.js';
import { createSimulationWorker } from '../../workers/worker-factory';
import { ConflictResolver } from './conflict-resolver.js';
import { useSimulatorInitialization } from './hooks/useSimulatorInitialization.js';

const DEFAULT_MAX_STEPS = 200000;
const MAX_ITERATIONS_CAP = 1000000;

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
  const animationIntervalRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const isRunningRef = useRef(false);
  const latestElementsRef = useRef(elements);
  const conflictResolverRef = useRef(new ConflictResolver());
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

  // Clear error when it's resolved
  const clearError = useCallback(() => {
    setSimulationError(null);
  }, []);

  const forceSimulatorReset = useCallback(() => {
    console.log('Forcing simulator reset');
    setForceResetCounter(prev => prev + 1);
  }, []);

  // Stop all simulations and reset state
  const stopAllSimulations = useCallback(() => {
    setIsContinuousSimulating(false);
    setIsRunning(false);
    isAnimatingRef.current = false;
    isRunningRef.current = false;

    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }

    try { simulatorCore.deactivateSimulation(); } catch (_) {}
    clearError();
    setEnabledTransitionIds([]);
    try { simWorkerRef.current?.postMessage?.({ op: 'cancel' }); } catch (_) {}
  }, [clearError]);

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
  const handleFireTransition = useCallback(async (transitionId) => {
    try {
      if (simulatorCore.getSimulatorType && simulatorCore.getSimulatorType() === 'none') {
        throw new Error('Simulator not initialized. Please wait for initialization to complete.');
      }

      await simulatorCore.activateSimulation(false);

      const newElements = await simulatorCore.fireTransition(transitionId);

      if (!newElements || typeof newElements !== 'object') {
        throw new Error('Invalid Petri net returned from simulator');
      }
      if (!newElements.places || !Array.isArray(newElements.places) ||
          !newElements.transitions || !Array.isArray(newElements.transitions) ||
          !newElements.arcs || !Array.isArray(newElements.arcs)) {
        throw new Error('Incomplete Petri net structure returned from simulator');
      }

      const elementsCopy = JSON.parse(JSON.stringify(newElements));
      setElements(elementsCopy);
      latestElementsRef.current = elementsCopy;
      if (updateHistory) updateHistory(elementsCopy, true);
      clearError();
      await refreshEnabledTransitions();
      setTimeout(() => { try { simulatorCore.activateSimulation(); } catch (_) {} }, 50);
    } catch (error) {
      console.error(`Error firing transition ${transitionId}:`, error);
      setSimulationError(error.message || `Failed to fire transition ${transitionId}.`);
    }
  }, [setElements, clearError, refreshEnabledTransitions, updateHistory]);

  // Execute one simulation step
  const stepSimulation = useCallback(async () => {
    try {
      if (simulatorCore.getSimulatorType && simulatorCore.getSimulatorType() === 'none') {
        throw new Error('Simulator not initialized. Please wait for initialization to complete.');
      }

      let mode = 'single';
      try { mode = simulatorCore.getSimulationMode ? simulatorCore.getSimulationMode() : 'single'; } catch (_) {}

      if (mode === 'maximal') {
        const enabled = await simulatorCore.getEnabledTransitions();
        if (!enabled || enabled.length === 0) return;
        const enabledObjs = (enabled || []).map((t) => {
          if (typeof t === 'string') return { id: t };
          if (t && typeof t === 'object') {
            const id = t.id ?? (t.get ? t.get('id') : undefined);
            return { id };
          }
          return { id: String(t) };
        }).filter((t) => t.id);

        const nonConflictingSets = conflictResolverRef.current.findNonConflictingTransitions(
          enabledObjs,
          (latestElementsRef.current?.places) || [],
          (latestElementsRef.current?.arcs) || []
        );
        const setsArray = Array.isArray(nonConflictingSets) ? nonConflictingSets : Array.from(nonConflictingSets || []);
        const candidate = setsArray.length ? setsArray[Math.floor(Math.random() * setsArray.length)] : [];
        const chosenSet = Array.isArray(candidate) ? candidate : (candidate ? [candidate] : []);
        for (const t of (Array.isArray(chosenSet) ? chosenSet : [])) {
          await handleFireTransition(t.id);
        }
        await refreshEnabledTransitions();
        return;
      }

      // Single-step semantics handled here: choose one enabled transition and fire it
      const enabled = await simulatorCore.getEnabledTransitions();
      if (!enabled || enabled.length === 0) return;
      const enabledIds = (enabled || []).map((t) => {
        if (typeof t === 'string') return t;
        if (t && typeof t === 'object') { return t.id ?? (t.get ? t.get('id') : undefined); }
        return String(t);
      }).filter(Boolean);
      const pick = enabledIds[Math.floor(Math.random() * enabledIds.length)];
      await handleFireTransition(pick);
    } catch (error) {
      console.error('Error in step simulation:', error);
      setSimulationError('Error during simulation step: ' + (error.message || 'Unknown error'));
      stopAllSimulations();
    }
  }, [setElements, updateHistory, clearError, refreshEnabledTransitions, stopAllSimulations]);

  // Start continuous simulation
  const startContinuousSimulation = useCallback(async () => {
    if (isContinuousSimulating || isRunningRef.current) return;
    try {
      await simulatorCore.activateSimulation();
      const enabled = await simulatorCore.getEnabledTransitions();
      if (!enabled || enabled.length === 0) return;
      setIsContinuousSimulating(true);
      isAnimatingRef.current = true;
      setEnabledTransitionIds(
        enabled
          .map(t => (t && typeof t === 'object') ? (t.id ?? (t.get ? t.get('id') : undefined)) : String(t))
          .filter(Boolean)
      );
      const delay = (ms) => new Promise(res => setTimeout(res, ms));
      while (isAnimatingRef.current) {
        await stepSimulation();
        const stillEnabled = await refreshEnabledTransitions();
        if (!stillEnabled || stillEnabled.length === 0) break;
        await delay(1000);
      }
    } catch (error) {
      console.error('Error starting continuous simulation:', error);
      setSimulationError('Failed to start continuous simulation');
    } finally {
      isAnimatingRef.current = false;
      setIsContinuousSimulating(false);
      try { simulatorCore.deactivateSimulation(); } catch (_) {}
    }
  }, [isContinuousSimulating, stepSimulation]);

  // Start run simulation (to completion)
  const startRunSimulation = useCallback(async () => {
    if (isContinuousSimulating || isRunningRef.current) return;
    try {
      await simulatorCore.activateSimulation(false);
      setIsRunning(true);
      setIsContinuousSimulating(false);
      isRunningRef.current = true;
      await refreshEnabledTransitions();
      
      // Check for non-visual run setting exposed on window (wired via context)
      let useNonVisual = false;
      try { useNonVisual = Boolean(window.__PETRI_NET_NON_VISUAL_RUN__); } catch (_) {}
      if (!useNonVisual && simulationSettings?.useNonVisualRun) {
        useNonVisual = true;
      }
      const settings = (typeof window !== 'undefined' && window.__PETRI_NET_SETTINGS__) ? window.__PETRI_NET_SETTINGS__ : {};
      const batchModeSetting = simulationSettings?.batchMode;
      const batchMode =
        batchModeSetting !== undefined
          ? Boolean(batchModeSetting)
          : Boolean(settings?.batchMode);
      if (batchMode) {
        useNonVisual = true;
      }

      const limitIterationsFlag = Boolean(simulationSettings?.limitIterations ?? settings?.limitIterations);
      const rawIterations = Number(simulationSettings?.maxIterations ?? settings?.maxIterations);
      const sanitizedIterations = Number.isFinite(rawIterations) && rawIterations > 0
        ? Math.max(1, Math.min(MAX_ITERATIONS_CAP, Math.floor(rawIterations)))
        : DEFAULT_MAX_STEPS;
      const effectiveMaxSteps = limitIterationsFlag ? sanitizedIterations : DEFAULT_MAX_STEPS;

      let prevZ3Settings = null;
      let z3PoolBoosted = false;
      const captureZ3Settings = () => {
        if (prevZ3Settings !== null) return prevZ3Settings;
        try {
          const current = window.__Z3_SETTINGS__ || {};
          prevZ3Settings = {
            poolSize: Number.isFinite(Number(current.poolSize)) ? Number(current.poolSize) : 0,
            idleTimeoutMs: current.idleTimeoutMs,
            prewarmOnAlgebraicMode: current.prewarmOnAlgebraicMode,
            solverTimeoutMs: current.solverTimeoutMs,
          };
        } catch (_) {
          prevZ3Settings = { poolSize: 0 };
        }
        return prevZ3Settings;
      };
      const boostZ3PoolTo = async (targetSize) => {
        try {
          const current = captureZ3Settings();
          const currentSize = Number(current.poolSize || 0);
          if (currentSize >= targetSize) return;
          const mod = await import('../../utils/z3-remote');
          mod.setZ3WorkerConfig({ ...current, poolSize: targetSize });
          z3PoolBoosted = true;
        } catch (_) {}
      };
      const restoreZ3Pool = async () => {
        if (!z3PoolBoosted) return;
        try {
          const mod = await import('../../utils/z3-remote');
          mod.setZ3WorkerConfig(prevZ3Settings || {});
        } catch (_) {}
        z3PoolBoosted = false;
      };

      let workerStarted = false;

      if (batchMode) {
        await boostZ3PoolTo(8);
        const worker = await ensureWorker();
        if (worker) {
          try {
            let mode = 'single';
            try { mode = simulatorCore.getSimulationMode ? simulatorCore.getSimulationMode() : 'single'; } catch (_) {}
            const onMessage = async (ev) => {
              const { op, payload: pl } = ev.data || {};
              if (op === 'done') {
                worker.removeEventListener('message', onMessage);
                if (pl && pl.elements && typeof pl.elements === 'object') {
                  setElements(pl.elements);
                  latestElementsRef.current = pl.elements;
                  if (updateHistory) updateHistory(pl.elements, true);
                }
                await restoreZ3Pool();
                await refreshEnabledTransitions();
                isRunningRef.current = false;
                setIsRunning(false);
                try { simulatorCore.deactivateSimulation(); } catch (_) {}

                // Show completion stats dialog
                if (pl?.stats) {
                  setCompletionStats({
                    elapsedMs: pl.stats.elapsedMs,
                    transitionsFired: pl.stats.steps ? pl.stats.steps.toLocaleString() : '0'
                  });
                }
              } else if (op === 'error') {
                worker.removeEventListener('message', onMessage);
                setSimulationError(pl?.message || 'Worker error');
                await restoreZ3Pool();
                isRunningRef.current = false;
                setIsRunning(false);
              }
            };
            worker.addEventListener('message', onMessage);
            worker.postMessage({
              op: 'start',
              payload: {
                elements: latestElementsRef.current,
                simOptions: { netMode },
                run: { mode, batchMax: (mode === 'maximal' ? 0 : 0), maxSteps: effectiveMaxSteps, timeBudgetMs: 0, yieldEvery: 5000, progressEveryMs: 0, yieldEveryMs: 0 },
                z3: (typeof window !== 'undefined' ? (window.__Z3_SETTINGS__ || {}) : {}),
              }
            });
            workerStarted = true;
          } catch (err) {
            console.error('Worker run failed, falling back to in-thread run:', err);
            await restoreZ3Pool();
          }
        }
      }

      if (workerStarted) {
        return;
      }

      if (useNonVisual && typeof simulatorCore.runToCompletion === 'function') {
        try {
          let mode = 'single';
          try { mode = simulatorCore.getSimulationMode ? simulatorCore.getSimulationMode() : 'single'; } catch (_) {}
          const shouldCancel = () => { try { return Boolean(window.__PETRI_NET_CANCEL_RUN__); } catch (_) { return false; } };
          const onProgress = () => {
            // Silent - no progress reporting to frontend
          };
          const batchMax = (mode === 'maximal') ? 0 : 0;

          // Track timing for completion stats
          const startTime = performance.now ? performance.now() : Date.now();

          const result = await simulatorCore.runToCompletion({
            mode,
            maxSteps: effectiveMaxSteps,
            timeBudgetMs: 0,
            yieldEvery: 5000,
            // Silent - no progress reporting
            progressEveryMs: 0,
            yieldEveryMs: 0,
            onProgress,
            shouldCancel,
            batchMax,
          });

          const endTime = performance.now ? performance.now() : Date.now();
          const elapsedMs = Math.round(endTime - startTime);

          if (result && result.petriNet && typeof result.petriNet === 'object') {
            setElements(result.petriNet);
            latestElementsRef.current = result.petriNet;
            if (updateHistory) updateHistory(result.petriNet, true);
          }

          // Show completion stats dialog
          setCompletionStats({
            elapsedMs,
            transitionsFired: result?.steps ? result.steps.toLocaleString() : '0'
          });
        } finally {
          // Restore Z3 worker config
          await restoreZ3Pool();
          await refreshEnabledTransitions();
          isRunningRef.current = false;
          setIsRunning(false);
          try { simulatorCore.deactivateSimulation(); } catch (_) {}
        }
        return;
      }

      let remainingSteps = effectiveMaxSteps;

      const runStep = async () => {
        if (!isRunningRef.current) { setIsRunning(false); return; }
        if (remainingSteps <= 0) { isRunningRef.current = false; setIsRunning(false); return; }
        try {
          const enabled = await simulatorCore.getEnabledTransitions();
          if (!enabled || enabled.length === 0) { isRunningRef.current = false; setIsRunning(false); return; }

          const enabledObjs = (enabled || []).map((t) => {
            if (typeof t === 'string') return { id: t };
            if (t && typeof t === 'object') { const id = t.id ?? (t.get ? t.get('id') : undefined); return { id }; }
            return { id: String(t) };
          }).filter((t) => t.id);

          const nonConflictingSets = conflictResolverRef.current.findNonConflictingTransitions(
            enabledObjs,
            elements.places || [],
            elements.arcs || []
          );
          const setsArray = Array.isArray(nonConflictingSets) ? nonConflictingSets : Array.from(nonConflictingSets || []);
          const candidate = setsArray.length ? setsArray[Math.floor(Math.random() * setsArray.length)] : [];
          const chosenSet = Array.isArray(candidate) ? candidate : (candidate ? [candidate] : []);
          let firedCount = 0;
          for (const t of (Array.isArray(chosenSet) ? chosenSet : [])) {
            if (remainingSteps <= 0) break;
            await handleFireTransition(t.id);
            firedCount += 1;
            remainingSteps -= 1;
          }
          if (remainingSteps <= 0) {
            isRunningRef.current = false;
            setIsRunning(false);
            return;
          }
          setTimeout(runStep, 50);
        } catch (error) {
          console.error('Error in run simulation:', error);
          setSimulationError(error.message || 'Error during simulation run');
          isRunningRef.current = false;
          setIsRunning(false);
        }
      };
      runStep();
    } catch (error) {
      console.error('Error starting run simulation:', error);
      setSimulationError('Failed to start run simulation');
    }
  }, [
    isContinuousSimulating,
    refreshEnabledTransitions,
    handleFireTransition,
    elements,
    simulationSettings?.limitIterations,
    simulationSettings?.maxIterations,
    simulationSettings?.batchMode,
    simulationSettings?.useNonVisualRun,
  ]);

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
