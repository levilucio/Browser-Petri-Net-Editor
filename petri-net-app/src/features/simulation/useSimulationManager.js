import { useState, useEffect, useCallback, useRef } from 'react';
import debounce from 'lodash.debounce';
import { simulatorCore } from './index';
import { ConflictResolver } from './conflict-resolver';
import { getSimulationStats } from './simulation-utils';

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

  // Single effect to manage simulator initialization and updates
  useEffect(() => {
    latestElementsRef.current = elements;
    const manageSimulator = async () => {
      
      // Only initialize simulator when the PN is structurally complete
      // Require at least one place, one transition, and at least one arc
      if (elements && elements.places && elements.transitions && elements.arcs && 
          elements.places.length > 0 && elements.transitions.length > 0 && elements.arcs.length > 0) {
        
        // Always try to initialize simulator if not ready
        if (!simulatorCore.isReady || !(await simulatorCore.isReady())) {
          try {
            await simulatorCore.initialize(elements, { maxTokens: 20 });
          } catch (error) {
            console.error('Failed to initialize simulator:', error);
          }
        }

        // Always update simulator with latest elements (keeps it in sync)
        try {
          await simulatorCore.update(latestElementsRef.current);
          
          // After update, check if transitions are enabled and update UI state
          if (simulatorCore.isReady && await simulatorCore.isReady()) {
            const enabled = await simulatorCore.getEnabledTransitions();
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
          // On error, reset state
          setEnabledTransitionIds([]);
          setIsSimulatorReady(false);
        }
      } else {
        // No valid Petri net yet, reset state
        setIsSimulatorReady(false);
        setEnabledTransitionIds([]);
      }
    };

    manageSimulator();
  }, [elements.places.length, elements.transitions.length, elements.arcs.length]);

  // Additional effect to periodically check simulator state for consistency
  useEffect(() => {
    const checkSimulatorState = async () => {
      if (elements && elements.places && elements.transitions && elements.arcs && 
          elements.places.length > 0 && elements.transitions.length > 0 && elements.arcs.length > 0) {
        
        try {
          if (simulatorCore.isReady && await simulatorCore.isReady()) {
            const enabled = await simulatorCore.getEnabledTransitions();
            const hasEnabled = enabled && enabled.length > 0;
            
            // Update state if it's different from current state
            if (JSON.stringify(enabled) !== JSON.stringify(enabledTransitionIds) || 
                hasEnabled !== isSimulatorReady) {
              setEnabledTransitionIds(enabled || []);
              setIsSimulatorReady(hasEnabled);
            }
          } else {
            // Simulator not ready, use fallback JavaScript calculation
            const stats = getSimulationStats(elements);
            const enabled = stats?.enabledTransitions || [];
            const hasEnabled = enabled.length > 0;
            
            // Update state if it's different from current state
            if (JSON.stringify(enabled) !== JSON.stringify(enabledTransitionIds) || 
                hasEnabled !== isSimulatorReady) {
              setEnabledTransitionIds(enabled);
              setIsSimulatorReady(hasEnabled);
            }
          }
        } catch (error) {
          console.error('Error checking simulator state:', error);
          // On error, use fallback
          const stats = getSimulationStats(elements);
          const enabled = stats?.enabledTransitions || [];
          setEnabledTransitionIds(enabled);
          setIsSimulatorReady(enabled.length > 0);
        }
      }
    };

    // Check immediately
    checkSimulatorState();
    
    // Set up periodic check every 500ms to ensure consistency
    const interval = setInterval(checkSimulatorState, 500);
    
    return () => clearInterval(interval);
  }, [elements, enabledTransitionIds, isSimulatorReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      simulatorCore.deactivateSimulation();
    };
  }, []);



  // Listen to simulator events for transition state changes
  useEffect(() => {
    let simulator = null;
    let cleanupFn = null;
    
    const setupSimulatorListener = async () => {
      try {
        // Get the simulator instance from simulatorCore
        const status = simulatorCore.getSimulatorStatus();
        if (status?.simulatorStatus?.simulator) {
          simulator = status.simulatorStatus.simulator;
          
          // Listen for transition state changes
          const handleTransitionsChanged = (eventData) => {
            console.log('Transition state changed event received:', eventData);
            
            // Update enabled transitions
            setEnabledTransitionIds(eventData.enabled || []);
            
            // Update simulation ready state based on whether there are enabled transitions
            setIsSimulatorReady(eventData.hasEnabled);
          };
          
          try {
            simulator.addEventListener('transitionsChanged', handleTransitionsChanged);
          } catch (e) {
            console.error('Failed to add transitionsChanged listener directly; queuing until simulator exists.', e);
          }
          
          // Check initial state
          try { await simulator.checkTransitionStateChanges(); } catch (_) {}
          
          cleanupFn = () => {
            if (simulator) {
              simulator.removeEventListener('transitionsChanged', handleTransitionsChanged);
            }
          };
          
          return cleanupFn;
        }

        // If simulator not yet present, register a pending listener via core so it attaches on init
        const coreAny = simulatorCore;
        if (coreAny && typeof coreAny.__queueListener === 'function') {
          coreAny.__queueListener('transitionsChanged', (eventData) => {
            setEnabledTransitionIds(eventData.enabled || []);
            setIsSimulatorReady(eventData.hasEnabled);
          });
        }
      } catch (error) {
        console.error('Error setting up simulator listener:', error);
      }
    };
    
    // Set up listener immediately
    setupSimulatorListener();
    
    // Remove previous polling: rely on immediate setup and queued listeners
    
    return () => {
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, []); // No dependencies - always run



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
    
    simulatorCore.deactivateSimulation();
    clearError();
    setEnabledTransitionIds([]);
    
  }, [clearError]);

  // Refresh enabled transitions using simulator
  const refreshEnabledTransitions = useCallback(async () => {
    try {
      if (simulatorCore.isReady && await simulatorCore.isReady()) {
        const enabled = await simulatorCore.getEnabledTransitions();
        setEnabledTransitionIds(enabled || []);
        return enabled || [];
      } else {
        setEnabledTransitionIds([]);
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
      setEnabledTransitionIds([]);
    }
  }, [isContinuousSimulating, isRunning, refreshEnabledTransitions]);

  // Refresh enabled transitions when simulation is running
  useEffect(() => {
    if (isRunning || isContinuousSimulating) {
      debouncedRefresh();
    }
    return () => debouncedRefresh.cancel();
  }, [isRunning, isContinuousSimulating, debouncedRefresh]);

  // Update simulator when elements change
  useEffect(() => {
    const updateAndRefresh = async () => {
      try {
        // Always update simulator with latest elements
        await simulatorCore.update(elements);
        
        // Get enabled transitions from simulator
        if (simulatorCore.isReady && await simulatorCore.isReady()) {
          const enabled = await simulatorCore.getEnabledTransitions();
          setEnabledTransitionIds(enabled || []);
        } else {
          setEnabledTransitionIds([]);
        }
      } catch (error) {
        console.error('Error updating simulator:', error);
        setSimulationError('Failed to update simulator');
      }
    };
    
    updateAndRefresh();
  }, [elements, isContinuousSimulating, isRunning]);

  // Fire a single transition
  const handleFireTransition = useCallback(async (transitionId) => {
    try {
      
      // Check if simulator is properly initialized
      if (simulatorCore.getSimulatorType && simulatorCore.getSimulatorType() === 'none') {
        throw new Error('Simulator not initialized. Please wait for initialization to complete.');
      }
      
      await simulatorCore.activateSimulation(false);
      
      const newElements = await simulatorCore.fireTransition(transitionId);
      
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
        simulatorCore.activateSimulation();
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
        simulatorStatus: simulatorCore.getSimulatorStatus ? simulatorCore.getSimulatorStatus() : 'No status method'
      });
      setSimulationError(error.message || `Failed to fire transition ${transitionId}.`);
    }
  }, [setElements, clearError, refreshEnabledTransitions, updateHistory]);
  
  // Execute one simulation step
  const stepSimulation = useCallback(async () => {
    try {
      
      // Check if simulator is properly initialized
      if (simulatorCore.getSimulatorType && simulatorCore.getSimulatorType() === 'none') {
        throw new Error('Simulator not initialized. Please wait for initialization to complete.');
      }
      
      // Avoid forcing a simulator update here; structural updates are handled by effects.
      // Calling update here with a stale snapshot can reset tokens. Rely on prior updates instead.

      // Decide behavior based on simulation mode
      let mode = 'single';
      try {
        mode = simulatorCore.getSimulationMode ? simulatorCore.getSimulationMode() : 'single';
      } catch (_) {}

      // If maximal concurrent, fire a maximal non-conflicting set in this step
      if (mode === 'maximal') {
        const enabled = await simulatorCore.getEnabledTransitions();
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

      await simulatorCore.activateSimulation(false);
      // Single mode: delegate to simulator step
      const newElements = await simulatorCore.stepSimulation();
      
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
        simulatorStatus: simulatorCore.getSimulatorStatus ? simulatorCore.getSimulatorStatus() : 'No status method'
      });
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
        if (!isRunningRef.current) {
          setIsRunning(false);
          return;
        }

        try {
          const enabled = await simulatorCore.getEnabledTransitions();
          
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

export default useSimulationManager;
