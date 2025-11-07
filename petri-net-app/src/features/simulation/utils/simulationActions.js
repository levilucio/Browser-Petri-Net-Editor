import { ConflictResolver } from '../conflict-resolver.js';

const DEFAULT_DELAY_MS = 1000;

const normalizeTransitionIds = (items) => (
  (items || [])
    .map((t) => {
      if (typeof t === 'string') return t;
      if (t && typeof t === 'object') {
        const id = t.id ?? (t.get ? t.get('id') : undefined);
        return id;
      }
      return String(t);
    })
    .filter(Boolean)
);

const ensureConflictResolver = (conflictResolverRef) => {
  if (!conflictResolverRef.current) {
    conflictResolverRef.current = new ConflictResolver();
  }
  return conflictResolverRef.current;
};

export const createHandleFireTransition = ({
  simulatorCore,
  setElements,
  updateHistory,
  clearError,
  refreshEnabledTransitions,
  setSimulationError,
  latestElementsRef,
}) => async (transitionId) => {
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
};

export const createStepSimulation = ({
  simulatorCore,
  handleFireTransition,
  conflictResolverRef,
  latestElementsRef,
  refreshEnabledTransitions,
  setSimulationError,
  stopAllSimulations,
}) => async () => {
  try {
    if (simulatorCore.getSimulatorType && simulatorCore.getSimulatorType() === 'none') {
      throw new Error('Simulator not initialized. Please wait for initialization to complete.');
    }

    let mode = 'single';
    try { mode = simulatorCore.getSimulationMode ? simulatorCore.getSimulationMode() : 'single'; } catch (_) {}

    if (mode === 'maximal') {
      const enabled = await simulatorCore.getEnabledTransitions();
      if (!enabled || enabled.length === 0) return;

      const resolver = ensureConflictResolver(conflictResolverRef);
      const enabledObjs = normalizeTransitionIds(enabled).map((id) => ({ id }));
      const nonConflictingSets = resolver.findNonConflictingTransitions(
        enabledObjs,
        (latestElementsRef.current?.places) || [],
        (latestElementsRef.current?.arcs) || []
      );
      const setsArray = Array.isArray(nonConflictingSets)
        ? nonConflictingSets
        : Array.from(nonConflictingSets || []);
      const candidate = setsArray.length ? setsArray[Math.floor(Math.random() * setsArray.length)] : [];
      const chosenSet = Array.isArray(candidate) ? candidate : (candidate ? [candidate] : []);

      for (const t of chosenSet) {
        await handleFireTransition(t.id);
      }
      await refreshEnabledTransitions();
      return;
    }

    const enabled = await simulatorCore.getEnabledTransitions();
    if (!enabled || enabled.length === 0) return;

    const enabledIds = normalizeTransitionIds(enabled);
    const pick = enabledIds[Math.floor(Math.random() * enabledIds.length)];
    await handleFireTransition(pick);
  } catch (error) {
    console.error('Error in step simulation:', error);
    setSimulationError('Error during simulation step: ' + (error.message || 'Unknown error'));
    stopAllSimulations();
  }
};

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

export const createStartContinuousSimulation = ({
  simulatorCore,
  isContinuousSimulatingRef,
  isRunningRef,
  setIsContinuousSimulating,
  setEnabledTransitionIds,
  stepSimulation,
  refreshEnabledTransitions,
  setSimulationError,
}) => async () => {
  if (isContinuousSimulatingRef.current || isRunningRef.current) return;
  try {
    await simulatorCore.activateSimulation();
    const enabled = await simulatorCore.getEnabledTransitions();
    if (!enabled || enabled.length === 0) return;

    setIsContinuousSimulating(true);
    isContinuousSimulatingRef.current = true;
    const ids = normalizeTransitionIds(enabled);
    setEnabledTransitionIds(ids);

    while (isContinuousSimulatingRef.current) {
      await stepSimulation();
      const stillEnabled = await refreshEnabledTransitions();
      if (!stillEnabled || stillEnabled.length === 0) break;
      await delay(DEFAULT_DELAY_MS);
    }
  } catch (error) {
    console.error('Error starting continuous simulation:', error);
    setSimulationError('Failed to start continuous simulation');
  } finally {
    isContinuousSimulatingRef.current = false;
    setIsContinuousSimulating(false);
    try { simulatorCore.deactivateSimulation(); } catch (_) {}
  }
};

const sanitizeIterations = (value, cap) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.max(1, Math.min(cap, Math.floor(num)));
};

const captureZ3Settings = () => {
  try {
    const current = window.__Z3_SETTINGS__ || {};
    return {
      poolSize: Number.isFinite(Number(current.poolSize)) ? Number(current.poolSize) : 0,
      idleTimeoutMs: current.idleTimeoutMs,
      prewarmOnAlgebraicMode: current.prewarmOnAlgebraicMode,
      solverTimeoutMs: current.solverTimeoutMs,
    };
  } catch (_) {
    return { poolSize: 0 };
  }
};

const collectSimulationSettings = ({ simulationSettings }) => {
  let useNonVisual = false;
  try { useNonVisual = Boolean(window.__PETRI_NET_NON_VISUAL_RUN__); } catch (_) {}

  const settings = (typeof window !== 'undefined' && window.__PETRI_NET_SETTINGS__)
    ? window.__PETRI_NET_SETTINGS__
    : {};

  if (!useNonVisual && simulationSettings?.useNonVisualRun) {
    useNonVisual = true;
  }

  const batchModeSetting = simulationSettings?.batchMode;
  const batchMode = batchModeSetting !== undefined
    ? Boolean(batchModeSetting)
    : Boolean(settings?.batchMode);

  if (batchMode) {
    useNonVisual = true;
  }

  const limitIterationsFlag = Boolean(simulationSettings?.limitIterations ?? settings?.limitIterations);
  const maxIterations = sanitizeIterations(
    simulationSettings?.maxIterations ?? settings?.maxIterations,
    1000000
  );

  return {
    useNonVisual,
    batchMode,
    limitIterationsFlag,
    maxIterations,
  };
};

export const createStartRunSimulation = ({
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
}) => async () => {
  if (isContinuousSimulatingRef.current || isRunningRef.current) return;
  try {
    await simulatorCore.activateSimulation(false);
    setIsRunning(true);
    setIsContinuousSimulating(false);
    isRunningRef.current = true;
    await refreshEnabledTransitions();

    const {
      useNonVisual,
      batchMode,
      limitIterationsFlag,
      maxIterations,
    } = collectSimulationSettings({ simulationSettings });

    const DEFAULT_MAX_STEPS = 200000;
    const effectiveMaxSteps = limitIterationsFlag
      ? (maxIterations ?? DEFAULT_MAX_STEPS)
      : DEFAULT_MAX_STEPS;

    let prevZ3Settings = null;
    let z3PoolBoosted = false;

    const boostZ3PoolTo = async (targetSize) => {
      try {
        if (!prevZ3Settings) {
          prevZ3Settings = captureZ3Settings();
        }
        const currentSize = Number(prevZ3Settings.poolSize || 0);
        if (currentSize >= targetSize) return;
        const mod = await import('../../../utils/z3-remote');
        mod.setZ3WorkerConfig({ ...prevZ3Settings, poolSize: targetSize });
        z3PoolBoosted = true;
      } catch (_) {}
    };

    const restoreZ3Pool = async () => {
      if (!z3PoolBoosted) return;
      try {
        const mod = await import('../../../utils/z3-remote');
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
              if (pl?.stats) {
                setCompletionStats({
                  elapsedMs: pl.stats.elapsedMs,
                  transitionsFired: pl.stats.steps ? pl.stats.steps.toLocaleString() : '0',
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
              run: {
                mode,
                batchMax: mode === 'maximal' ? 0 : 0,
                maxSteps: effectiveMaxSteps,
                timeBudgetMs: 0,
                yieldEvery: 5000,
                progressEveryMs: 0,
                yieldEveryMs: 0,
              },
              z3: (typeof window !== 'undefined' ? (window.__Z3_SETTINGS__ || {}) : {}),
            },
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
      let mode = 'single';
      try { mode = simulatorCore.getSimulationMode ? simulatorCore.getSimulationMode() : 'single'; } catch (_) {}
      const shouldCancel = () => {
        try { return Boolean(window.__PETRI_NET_CANCEL_RUN__); } catch (_) { return false; }
      };

      const startTime = performance.now ? performance.now() : Date.now();
      try {
        const result = await simulatorCore.runToCompletion({
          mode,
          maxSteps: effectiveMaxSteps,
          timeBudgetMs: 0,
          yieldEvery: 5000,
          progressEveryMs: 0,
          yieldEveryMs: 0,
          onProgress: () => {},
          shouldCancel,
          batchMax: mode === 'maximal' ? 0 : 0,
        });

        const endTime = performance.now ? performance.now() : Date.now();
        const elapsedMs = Math.round(endTime - startTime);

        if (result && result.petriNet && typeof result.petriNet === 'object') {
          setElements(result.petriNet);
          latestElementsRef.current = result.petriNet;
          if (updateHistory) updateHistory(result.petriNet, true);
        }

        setCompletionStats({
          elapsedMs,
          transitionsFired: result?.steps ? result.steps.toLocaleString() : '0',
        });
      } finally {
        await restoreZ3Pool();
        await refreshEnabledTransitions();
        isRunningRef.current = false;
        setIsRunning(false);
        try { simulatorCore.deactivateSimulation(); } catch (_) {}
      }
      return;
    }

    let remainingSteps = effectiveMaxSteps;
    const resolver = ensureConflictResolver(conflictResolverRef);

    const runStep = async () => {
      if (!isRunningRef.current) { setIsRunning(false); return; }
      if (remainingSteps <= 0) { isRunningRef.current = false; setIsRunning(false); return; }
      try {
        const enabled = await simulatorCore.getEnabledTransitions();
        if (!enabled || enabled.length === 0) { isRunningRef.current = false; setIsRunning(false); return; }

        const enabledObjs = normalizeTransitionIds(enabled).map((id) => ({ id }));
        const nonConflictingSets = resolver.findNonConflictingTransitions(
          enabledObjs,
          elements.places || [],
          elements.arcs || []
        );
        const setsArray = Array.isArray(nonConflictingSets)
          ? nonConflictingSets
          : Array.from(nonConflictingSets || []);
        const candidate = setsArray.length ? setsArray[Math.floor(Math.random() * setsArray.length)] : [];
        const chosenSet = Array.isArray(candidate) ? candidate : (candidate ? [candidate] : []);
        for (const t of chosenSet) {
          if (remainingSteps <= 0) break;
          await handleFireTransition(t.id);
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
};


