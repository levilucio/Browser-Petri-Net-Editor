import { useState, useEffect, useCallback, useRef } from 'react';
import debounce from 'lodash.debounce';
import simulatorCore from './simulator-core.js';
import { simulationEventBus, SimulationEvents } from './SimulationEventBus.js';
import { ConflictResolver } from './conflict-resolver.js';
import { getSimulationStats } from './simulation-utils.js';

const useSimulationManager = (elements, setElements, updateHistory) => {
  // Core simulation state
  const [isContinuousSimulating, setIsContinuousSimulating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [enabledTransitionIds, setEnabledTransitionIds] = useState([]);
  const [simulationError, setSimulationError] = useState(null);
  const [isSimulatorReady, setIsSimulatorReady] = useState(false);

  // Refs for managing intervals and state
  const animationIntervalRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const isRunningRef = useRef(false);
  const latestElementsRef = useRef(elements);
  const conflictResolverRef = useRef(new ConflictResolver());

  // Set up event bus
  useEffect(() => {
    try { simulatorCore.setEventBus(simulationEventBus); } catch (_) {}
  }, []);

  // Single effect to manage simulator initialization and updates
  useEffect(() => {
    latestElementsRef.current = elements;
    const manageSimulator = async () => {
      if (
        elements && elements.places && elements.transitions && elements.arcs &&
        elements.places.length > 0 && elements.transitions.length > 0 && elements.arcs.length > 0
      ) {
        if (!simulatorCore.isReady || !(await simulatorCore.isReady())) {
          try {
            await simulatorCore.initialize(elements, { maxTokens: 20, netMode: elements.netMode });
          } catch (error) {
            console.error('Failed to initialize simulator:', error);
          }
        }

        try {
          await simulatorCore.update(latestElementsRef.current);

          if (simulatorCore.isReady && await simulatorCore.isReady()) {
            const enabled = await simulatorCore.getEnabledTransitions();
            setEnabledTransitionIds(enabled || []);
            setIsSimulatorReady(enabled && enabled.length > 0);
          } else {
            const stats = getSimulationStats(latestElementsRef.current);
            const enabled = stats?.enabledTransitions || [];
            setEnabledTransitionIds(enabled);
            setIsSimulatorReady(enabled.length > 0);
          }
        } catch (error) {
          console.error('Error updating simulator:', error);
          setEnabledTransitionIds([]);
          setIsSimulatorReady(false);
          setSimulationError('Failed to update simulator');
        }
      } else {
        setIsSimulatorReady(false);
        setEnabledTransitionIds([]);
        setSimulationError(null);
      }
    };

    manageSimulator();
  }, [elements]);

  // Listen to simulation events
  useEffect(() => {
    const handleTransitionsChanged = (eventData) => {
      setEnabledTransitionIds(eventData.enabled || []);
      setIsSimulatorReady(eventData.hasEnabled);
      try { if (typeof window !== 'undefined') { window.__ENABLED_TRANSITIONS__ = Array.isArray(eventData.enabled) ? eventData.enabled : []; } } catch (_) {}
    };

    const handleTransitionFired = (eventData) => {
      try { if (typeof window !== 'undefined') { window.__LAST_FIRED_TRANSITION_ID__ = eventData.transitionId || null; } } catch (_) {}
      if (eventData.newPetriNet) {
        setElements(eventData.newPetriNet);
        latestElementsRef.current = eventData.newPetriNet;
        if (updateHistory) updateHistory(eventData.newPetriNet, true);
      }
    };

    simulationEventBus.on(SimulationEvents.transitionsChanged, handleTransitionsChanged);
    simulationEventBus.on(SimulationEvents.transitionFired, handleTransitionFired);

    return () => {
      simulationEventBus.off(SimulationEvents.transitionsChanged, handleTransitionsChanged);
      simulationEventBus.off(SimulationEvents.transitionFired, handleTransitionFired);
    };
  }, [setElements, updateHistory]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { simulatorCore.deactivateSimulation(); } catch (_) {}
    };
  }, []);

  // Clear error when it's resolved
  const clearError = useCallback(() => {
    setSimulationError(null);
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
  }, [clearError]);

  // Refresh enabled transitions using simulator
  const refreshEnabledTransitions = useCallback(async () => {
    try {
      if (simulatorCore.isReady && await simulatorCore.isReady()) {
        const enabled = await simulatorCore.getEnabledTransitions();
        setEnabledTransitionIds(enabled || []);
        const hasEnabled = Array.isArray(enabled) && enabled.length > 0;
        setIsSimulatorReady(hasEnabled);
        return enabled || [];
      } else {
        setEnabledTransitionIds([]);
        setIsSimulatorReady(false);
        return [];
      }
    } catch (error) {
      console.error('Error refreshing enabled transitions:', error);
      setSimulationError('Failed to refresh enabled transitions');
      return [];
    }
  }, []);

  // Debounced refresh for performance
  const debouncedRefresh = useCallback(
    debounce(refreshEnabledTransitions, 100),
    [refreshEnabledTransitions]
  );

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

      const runStep = async () => {
        if (!isRunningRef.current) { setIsRunning(false); return; }
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
          for (const t of (Array.isArray(chosenSet) ? chosenSet : [])) { await handleFireTransition(t.id); }
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
  }, [isContinuousSimulating, refreshEnabledTransitions, handleFireTransition, elements]);

  return {
    isContinuousSimulating,
    isRunning,
    enabledTransitionIds,
    simulationError,
    isSimulatorReady,
    stepSimulation,
    startContinuousSimulation,
    startRunSimulation,
    stopAllSimulations,
    clearError,
  };
};

export default useSimulationManager;
