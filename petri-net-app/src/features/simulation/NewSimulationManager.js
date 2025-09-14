/**
 * New Simulation Manager - Simplified architecture using the new simulator core
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import debounce from 'lodash.debounce';
import { newSimulatorCore } from './NewSimulatorCore.js';
import { simulationEventBus } from './SimulationEventBus.js';
import { ConflictResolver } from './conflict-resolver.js';
import { getSimulationStats } from './simulation-utils.js';

const useNewSimulationManager = (elements, setElements, updateHistory) => {
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
    newSimulatorCore.setEventBus(simulationEventBus);
  }, []);

  // Single effect to manage simulator initialization and updates
  useEffect(() => {
    latestElementsRef.current = elements;
    const manageSimulator = async () => {
      
      // Only initialize simulator when the PN is structurally complete
      if (elements && elements.places && elements.transitions && elements.arcs && 
          elements.places.length > 0 && elements.transitions.length > 0 && elements.arcs.length > 0) {
        
        // Always try to initialize simulator if not ready
        if (!newSimulatorCore.isReady || !(await newSimulatorCore.isReady())) {
          try {
            await newSimulatorCore.initialize(elements, { maxTokens: 20, netMode: elements.netMode });
          } catch (error) {
            console.error('Failed to initialize simulator:', error);
          }
        } else {
          // If simulator is ready but the mode changed, re-initialize to switch simulators
          try {
            const currentType = newSimulatorCore.getSimulatorType ? newSimulatorCore.getSimulatorType() : 'none';
            const expectedType = (elements && elements.netMode === 'algebraic') ? 'algebraic' : (elements && elements.netMode === 'pt') ? 'pt' : currentType;
            if (currentType !== expectedType) {
              await newSimulatorCore.initialize(elements, { maxTokens: 20, netMode: expectedType });
            }
          } catch (error) {
            console.error('Failed to ensure simulator mode:', error);
          }
        }

        // Always update simulator with latest elements
        try {
          await newSimulatorCore.update(latestElementsRef.current);
          
          // After update, check if transitions are enabled and update UI state
          if (newSimulatorCore.isReady && await newSimulatorCore.isReady()) {
            const enabled = await newSimulatorCore.getEnabledTransitions();
            setEnabledTransitionIds(enabled || []);
            setIsSimulatorReady(enabled && enabled.length > 0);
          } else {
            // Simulator not ready, use fallback JavaScript calculation
            console.log('Simulator not ready, using fallback enabled transitions calculation');
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
        // No valid Petri net yet, reset state
        setIsSimulatorReady(false);
        setEnabledTransitionIds([]);
        setSimulationError(null); // Clear error when no Petri net
      }
    };

    manageSimulator();
  }, [elements]);

  // Listen to simulation events
  useEffect(() => {
    const handleTransitionsChanged = (eventData) => {
      console.log('Transition state changed event received:', eventData);
      setEnabledTransitionIds(eventData.enabled || []);
      setIsSimulatorReady(eventData.hasEnabled);
    };

    const handleTransitionFired = (eventData) => {
      console.log('Transition fired event received:', eventData);
      // Update elements with the new Petri net
      if (eventData.newPetriNet) {
        setElements(eventData.newPetriNet);
        latestElementsRef.current = eventData.newPetriNet;
        
        if (updateHistory) {
          updateHistory(eventData.newPetriNet, true);
        }
      }
    };

    // Add event listeners
    simulationEventBus.on('transitionsChanged', handleTransitionsChanged);
    simulationEventBus.on('transitionFired', handleTransitionFired);

    // Cleanup
    return () => {
      simulationEventBus.off('transitionsChanged', handleTransitionsChanged);
      simulationEventBus.off('transitionFired', handleTransitionFired);
    };
  }, [setElements, updateHistory]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      newSimulatorCore.deactivateSimulation();
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
    
    newSimulatorCore.deactivateSimulation();
    clearError();
    setEnabledTransitionIds([]);
  }, [clearError]);

  // Refresh enabled transitions using simulator
  const refreshEnabledTransitions = useCallback(async () => {
    try {
      if (newSimulatorCore.isReady && await newSimulatorCore.isReady()) {
        const enabled = await newSimulatorCore.getEnabledTransitions();
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
      newSimulatorCore.activateSimulation();
      refreshEnabledTransitions();
    } else {
      newSimulatorCore.deactivateSimulation();
      // Do NOT clear enabled transitions; recompute instead so panel stays active
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
      // Check if simulator is properly initialized
      if (newSimulatorCore.getSimulatorType() === 'none') {
        throw new Error('Simulator not initialized. Please wait for initialization to complete.');
      }
      
      await newSimulatorCore.activateSimulation(false);
      
      const newElements = await newSimulatorCore.fireTransition(transitionId);
      
      // Validate the returned Petri net structure
      if (!newElements || typeof newElements !== 'object') {
        throw new Error('Invalid Petri net returned from simulator');
      }
      
      if (!newElements.places || !Array.isArray(newElements.places) ||
          !newElements.transitions || !Array.isArray(newElements.transitions) ||
          !newElements.arcs || !Array.isArray(newElements.arcs)) {
        throw new Error('Incomplete Petri net structure returned from simulator');
      }
      
      // Create a deep copy for React state update
      const elementsCopy = JSON.parse(JSON.stringify(newElements));
      
      // Update the Petri net state and keep the ref in sync
      setElements(elementsCopy);
      latestElementsRef.current = elementsCopy;
      
      // Update history for undo/redo
      if (updateHistory) {
        updateHistory(elementsCopy, true);
      }
      
      clearError();
      
      // Refresh enabled transitions
      await refreshEnabledTransitions();
      
      // Ensure simulator state is synchronized
      setTimeout(() => {
        newSimulatorCore.activateSimulation();
      }, 50);
      
      // Expose last fired transition for E2E tests
      try {
        if (typeof window !== 'undefined') {
          window.__LAST_FIRED_TRANSITION_ID__ = transitionId;
          const log = Array.isArray(window.__FIRED_TRANSITIONS__) ? window.__FIRED_TRANSITIONS__ : [];
          window.__FIRED_TRANSITIONS__ = [...log, transitionId];
        }
      } catch (_) {}
    } catch (error) {
      console.error(`Error firing transition ${transitionId}:`, error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        simulatorStatus: newSimulatorCore.getSimulatorStatus()
      });
      setSimulationError(error.message || `Failed to fire transition ${transitionId}.`);
    }
  }, [setElements, clearError, refreshEnabledTransitions, updateHistory]);
  
  // Execute one simulation step
  const stepSimulation = useCallback(async () => {
    try {
      // Check if simulator is properly initialized
      if (newSimulatorCore.getSimulatorType() === 'none') {
        throw new Error('Simulator not initialized. Please wait for initialization to complete.');
      }

      // Decide behavior based on simulation mode
      let mode = 'single';
      try {
        mode = newSimulatorCore.getSimulationMode();
      } catch (_) {}

      // If maximal concurrent, fire a maximal non-conflicting set in this step
      if (mode === 'maximal') {
        const enabled = await newSimulatorCore.getEnabledTransitions();
        if (!enabled || enabled.length === 0) {
          return;
        }
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

      await newSimulatorCore.activateSimulation(false);
      // Single mode: delegate to simulator step
      const newElements = await newSimulatorCore.stepSimulation();
      
      if (newElements) {
        // Create a deep copy for React state update
        const elementsCopy = JSON.parse(JSON.stringify(newElements));
        
        // Update the Petri net state and keep the ref in sync
        setElements(elementsCopy);
        latestElementsRef.current = elementsCopy;
        
        // Update history for undo/redo
        if (updateHistory) {
          updateHistory(elementsCopy, true);
        }
        
        clearError();
        
        // Refresh enabled transitions
        await refreshEnabledTransitions();
      }
      
    } catch (error) {
      console.error('Error in step simulation:', error);
      console.error('Step simulation error details:', {
        message: error.message,
        stack: error.stack,
        simulatorStatus: newSimulatorCore.getSimulatorStatus()
      });
      setSimulationError('Error during simulation step: ' + (error.message || 'Unknown error'));
      stopAllSimulations();
    }
  }, [setElements, updateHistory, clearError, refreshEnabledTransitions, stopAllSimulations]);

  // Start continuous simulation
  const startContinuousSimulation = useCallback(async () => {
    if (isContinuousSimulating || isRunningRef.current) return;
    try {
      await newSimulatorCore.activateSimulation();
      const enabled = await newSimulatorCore.getEnabledTransitions();
      if (!enabled || enabled.length === 0) {
        return;
      }
      setIsContinuousSimulating(true);
      isAnimatingRef.current = true;
      setEnabledTransitionIds(enabled.map(t => (t && typeof t === 'object') ? (t.id ?? (t.get ? t.get('id') : undefined)) : String(t)).filter(Boolean));
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
      try { newSimulatorCore.deactivateSimulation(); } catch (_) {}
    }
  }, [isContinuousSimulating, stepSimulation]);

  // Start run simulation (to completion)
  const startRunSimulation = useCallback(async () => {
    if (isContinuousSimulating || isRunningRef.current) return;

    try {
      await newSimulatorCore.activateSimulation(false);
      setIsRunning(true);
      setIsContinuousSimulating(false);
      isRunningRef.current = true;
      await refreshEnabledTransitions();

      const runStep = async () => {
        if (!isRunningRef.current) {
          setIsRunning(false);
          return;
        }

        try {
          const enabled = await newSimulatorCore.getEnabledTransitions();
          
          if (!enabled || enabled.length === 0) {
            isRunningRef.current = false;
            setIsRunning(false);
            return;
          }

          // Maximal concurrent set: choose a largest non-conflicting subset, resolving conflicts nondeterministically
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
            elements.places || [],
            elements.arcs || []
          );

          // Pick one of the maximal sets randomly
          const setsArray = Array.isArray(nonConflictingSets) ? nonConflictingSets : Array.from(nonConflictingSets || []);
          const candidate = setsArray.length ? setsArray[Math.floor(Math.random() * setsArray.length)] : [];
          const chosenSet = Array.isArray(candidate) ? candidate : (candidate ? [candidate] : []);

          // Fire all transitions in the chosen set sequentially (equivalent to concurrent for conflict-free set)
          for (const t of (Array.isArray(chosenSet) ? chosenSet : [])) {
            await handleFireTransition(t.id);
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

export default useNewSimulationManager;
