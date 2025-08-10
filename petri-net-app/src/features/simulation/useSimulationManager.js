import { useState, useEffect, useCallback, useRef } from 'react';
import debounce from 'lodash.debounce';
import { 
  initializeSimulator, 
  updateSimulator, 
  getEnabledTransitions, 
  fireTransition, 
  activateSimulation, 
  deactivateSimulation 
} from '../../utils/simulator';

const useSimulationManager = (elements, setElements, updateHistory) => {
  const [isContinuousSimulating, setIsContinuousSimulating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSimulationActive, setIsSimulationActive] = useState(false);
  const [enabledTransitionIds, setEnabledTransitionIds] = useState([]);
  const [simulationError, setSimulationError] = useState(null);

  const animationIntervalRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const isRunningRef = useRef(false);

  useEffect(() => {
    const initSimulator = async () => {
      try {
        // Initialize with JS fallback for better performance during editing
        await initializeSimulator(elements, { maxTokens: 20 });
      } catch (error) {
        console.error('Error initializing simulator:', error);
        setSimulationError('Failed to initialize simulator');
      }
    };

    initSimulator();
    
    // Cleanup - make sure simulation is deactivated when component unmounts
    return () => {
      deactivateSimulation();
    };
  }, []);

  // Define stopAllSimulations function first to avoid circular dependency
  const stopAllSimulations = useCallback(() => {
    // Reset state flags
    setIsContinuousSimulating(false);
    setIsRunning(false);
    setIsSimulationActive(false);
    isAnimatingRef.current = false;
    isRunningRef.current = false;
    
    // Clear any running intervals
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
    
    // Deactivate simulation mode
    deactivateSimulation();
    
    // Clear error and enabled transitions
    setSimulationError(null);
    setEnabledTransitionIds([]);
    
    console.log('All simulations stopped');
  }, [deactivateSimulation, clearInterval, setIsContinuousSimulating, setIsRunning, setIsSimulationActive]);

  // Define refreshEnabledTransitions before using it
  const refreshEnabledTransitions = useCallback(async () => {
    try {
      const enabled = await getEnabledTransitions();
      if (enabled && Array.isArray(enabled)) {
        setEnabledTransitionIds(enabled.map(t => t instanceof Map ? t.get('id') : t.id));
      } else {
        console.warn('No enabled transitions found or invalid format');
        setEnabledTransitionIds([]);
      }
    } catch (error) {
      console.error('Error refreshing enabled transitions:', error);
      setSimulationError('Failed to refresh enabled transitions');
    }
  }, [setEnabledTransitionIds, setSimulationError]);

  const debouncedRefresh = useCallback(debounce(refreshEnabledTransitions, 100), [
    refreshEnabledTransitions,
  ]);
  
  useEffect(() => {
    if (isContinuousSimulating || isRunning) {
      // Activate simulation mode when starting simulation
      activateSimulation();
      refreshEnabledTransitions();
    } else {
      // Deactivate simulation mode when stopping simulation
      deactivateSimulation();
      // Clear enabled transitions when simulation stops
      setEnabledTransitionIds([]);
    }
  }, [isContinuousSimulating, isRunning, refreshEnabledTransitions, deactivateSimulation, activateSimulation]);

  useEffect(() => {
    if (isRunning || isContinuousSimulating) {
      debouncedRefresh();
    }
    return () => debouncedRefresh.cancel();
  }, [isRunning, isContinuousSimulating, debouncedRefresh]);

  // Update simulator and refresh enabled transitions when elements change
  useEffect(() => {
    const updateAndRefresh = async () => {
      try {
        // Update the simulator with the current elements
        await updateSimulator(elements);
        
        // Only refresh enabled transitions if we're not already simulating
        // This prevents auto-starting simulation
        if (!isContinuousSimulating && !isRunning) {
          const enabled = await getEnabledTransitions();
          if (enabled && Array.isArray(enabled)) {
            setEnabledTransitionIds(enabled.map(t => t instanceof Map ? t.get('id') : t.id));
          } else {
            console.warn('No enabled transitions found or invalid format');
            setEnabledTransitionIds([]);
          }
        }
      } catch (error) {
        console.error('Error updating simulator:', error);
        setSimulationError('Failed to update simulator');
      }
    };
    
    updateAndRefresh();
  }, [elements, isContinuousSimulating, isRunning, setEnabledTransitionIds, setSimulationError]);

  const handleFireTransition = useCallback(
    async (transitionId) => {
      try {
        // Activate simulation mode before firing transition
        await activateSimulation(false);
        setIsSimulationActive(true);
        
        console.log(`Firing transition ${transitionId}`);
        const newElements = await fireTransition(transitionId);
        
        // Validate the returned Petri net structure before updating state
        if (!newElements || typeof newElements !== 'object') {
          console.error('Invalid Petri net returned from fireTransition:', newElements);
          setSimulationError('Invalid Petri net structure returned from simulator');
          return;
        }
        
        // Ensure we have all required properties
        if (!newElements.places || !Array.isArray(newElements.places) ||
            !newElements.transitions || !Array.isArray(newElements.transitions) ||
            !newElements.arcs || !Array.isArray(newElements.arcs)) {
          console.error('Incomplete Petri net structure returned from fireTransition:', newElements);
          setSimulationError('Incomplete Petri net structure returned from simulator');
          return;
        }
        
        console.log('Setting new elements after firing transition:', 
          `Places: ${newElements.places.length}, ` +
          `Transitions: ${newElements.transitions.length}, ` +
          `Arcs: ${newElements.arcs.length}`);
        
        // Create a deep copy to ensure React recognizes state changes
        // This is crucial for token updates to be detected and reflected in the UI
        const elementsCopy = JSON.parse(JSON.stringify(newElements));
        
        // Debug token state
        console.log('Token state before update:');
        elements.places?.forEach(p => console.log(`${p.id}: ${p.tokens}`));
        console.log('Token state after update:');
        elementsCopy.places?.forEach(p => console.log(`${p.id}: ${p.tokens}`));
        
        // Update the Petri net state with the new elements
        setElements(elementsCopy);
        
        // Update history to record this simulation step for undo/redo
        if (updateHistory) {
          console.log('Recording simulation step in history:', elementsCopy);
          updateHistory(elementsCopy, true); // true indicates this is a simulation step
        }
        
        setSimulationError(null);
        
        // Immediately refresh enabled transitions to reflect the new state
        refreshEnabledTransitions();
        
        // Force a simulator update to ensure Python simulator state is synchronized
        setTimeout(() => {
          activateSimulation();
        }, 50);
      } catch (error) {
        console.error(`Error firing transition ${transitionId}:`, error);
        setSimulationError(error.message || `Failed to fire transition ${transitionId}.`);
      } finally {
        setIsSimulationActive(false);
      }
    },
    [setElements, setSimulationError, setIsSimulationActive, activateSimulation]
  );
  
  const stepSimulation = useCallback(async () => {
    try {
      // Set simulation active state
      setIsSimulationActive(true);

      // Activate simulation mode but avoid reinitializing if simulator already exists
      await activateSimulation(false);
      
      // Get enabled transitions
      const enabledTransitions = await getEnabledTransitions();
      console.log('Step simulation - enabled transitions:', enabledTransitions);

      // If no transitions are enabled, stop the simulation
      if (!enabledTransitions || enabledTransitions.length === 0) {
        console.log('No enabled transitions available, stopping simulation');
        stopAllSimulations();
        return;
      }

      // Select a transition to fire (for now, just pick the first one)
      // In the future, this could be more sophisticated
      const transitionToFire = enabledTransitions[0];
      
      // Check if the transition is a plain object or a Map
      let transitionId;
      if (transitionToFire instanceof Map) {
        transitionId = transitionToFire.get('id');
        console.log('Using Map transition with id:', transitionId);
      } else {
        transitionId = transitionToFire.id;
        console.log('Using plain object transition with id:', transitionId);
      }

      // Ensure we have a valid transition ID before firing
      if (!transitionId) {
        console.error('Attempted to fire a transition without an ID:', transitionToFire);
        setSimulationError('Invalid transition selected for firing');
        return;
      }

      console.log(`Step simulation - firing transition: ${transitionId}`);
      
      // Fire the transition without reinitializing the simulator
      await handleFireTransition(transitionId);
    } catch (error) {
      console.error('Error in step simulation:', error);
      setSimulationError('Error during simulation step: ' + (error.message || 'Unknown error'));
      stopAllSimulations();
    }
  }, [handleFireTransition, stopAllSimulations, setSimulationError, setIsSimulationActive, activateSimulation, getEnabledTransitions]);

  const startContinuousSimulation = useCallback(async () => {
    if (isContinuousSimulating || isRunning) return;
    
    // Set simulation active
    setIsSimulationActive(true);
    
    // Activate simulation mode
    activateSimulation();
    
    // Check if there are any enabled transitions before starting
    const enabled = await getEnabledTransitions();
    if (!enabled || enabled.length === 0) {
      console.log('No enabled transitions available, cannot start simulation');
      return;
    }
    
    setIsContinuousSimulating(true);
    isAnimatingRef.current = true;
    setEnabledTransitionIds(enabled.map(t => t instanceof Map ? t.get('id') : t.id));
    
    animationIntervalRef.current = setInterval(() => {
      if (isAnimatingRef.current) {
        stepSimulation();
      }
    }, 1000);
  }, [animationIntervalRef, clearInterval, deactivateSimulation, setIsContinuousSimulating, setIsRunning, setIsSimulationActive, activateSimulation, getEnabledTransitions, stepSimulation]);

  const startRunSimulation = useCallback(async () => {
    if (isContinuousSimulating || isRunningRef.current) return;

    // Activate simulation mode but avoid reinitializing if simulator already exists
    await activateSimulation(false);
    setIsRunning(true);
    setIsContinuousSimulating(false);
    setIsSimulationActive(true);
    isRunningRef.current = true;
    refreshEnabledTransitions();

    const runStep = async () => {
      if (!isRunningRef.current) {
        setIsRunning(false);
        return;
      }

      try {
        const enabled = await getEnabledTransitions();
        console.log('Run simulation - enabled transitions:', enabled);
        
        if (!enabled || enabled.length === 0) {
          console.log('No enabled transitions available, stopping run');
          isRunningRef.current = false;
          setIsRunning(false);
          return;
        }

        const randomIndex = Math.floor(Math.random() * enabled.length);
        
        // Handle both Map objects from Pyodide and regular JS objects
        let transitionToFire;
        const transition = enabled[randomIndex];
        
        // Check if it's a Map (from Pyodide) or a plain object
        if (transition instanceof Map) {
          transitionToFire = transition.get('id');
          console.log('Run: Using Map transition with id:', transitionToFire);
        } else {
          transitionToFire = transition.id;
          console.log('Run: Using plain object transition with id:', transitionToFire);
        }
        
        // Ensure we have a valid transition ID before firing
        if (!transitionToFire) {
          console.error('Attempted to fire a transition without an ID:', transition);
          setSimulationError('Invalid transition selected for firing');
          isRunningRef.current = false;
          setIsRunning(false);
          return;
        }
        
        console.log(`Run simulation - firing transition: ${transitionToFire}`);
        await handleFireTransition(transitionToFire);
        setTimeout(runStep, 50);
      } catch (error) {
        console.error('Error in run simulation:', error);
        setSimulationError(error.message || 'Error during simulation run');
        isRunningRef.current = false;
        setIsRunning(false);
      }
    };

    runStep();
  }, [isContinuousSimulating, setIsRunning, setIsContinuousSimulating, setIsSimulationActive, refreshEnabledTransitions, getEnabledTransitions, handleFireTransition, setSimulationError, activateSimulation]);

  return {
    isContinuousSimulating,
    isRunning,
    isSimulationActive,
    enabledTransitionIds,
    simulationError,
    stepSimulation,
    startContinuousSimulation,
    startRunSimulation,
    stopAllSimulations,
  };
};

export default useSimulationManager;
