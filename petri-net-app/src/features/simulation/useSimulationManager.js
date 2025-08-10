import { useState, useEffect, useCallback, useRef } from 'react';
import debounce from 'lodash.debounce';
import { 
  simulatorCore,
  JsPetriNetSimulator
} from './index';

const useSimulationManager = (elements, setElements, updateHistory) => {
  // Core simulation state
  const [isContinuousSimulating, setIsContinuousSimulating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [enabledTransitionIds, setEnabledTransitionIds] = useState([]);
  const [simulationError, setSimulationError] = useState(null);

  // Refs for managing intervals and state
  const animationIntervalRef = useRef(null);
  const isAnimatingRef = useRef(false);
  const isRunningRef = useRef(false);

  // Initialize simulator when component mounts
  useEffect(() => {
    if (!elements || !elements.places || !elements.transitions) {
      console.log('No elements available for simulator initialization, skipping...');
      return;
    }

    const initSimulator = async () => {
      try {
        console.log('Initializing simulator with elements:', elements.places.length, 'places,', elements.transitions.length, 'transitions');
        await simulatorCore.initialize(elements, { maxTokens: 20 });
      } catch (error) {
        console.error('Error initializing simulator:', error);
        setSimulationError('Failed to initialize simulator');
      }
    };

    initSimulator();
    
    return () => {
      simulatorCore.deactivateSimulation();
    };
  }, []); // Only run once on mount, not on every elements change

  // Update simulator when elements change (without re-initializing)
  useEffect(() => {
    if (!elements || !elements.places || !elements.transitions) {
      return;
    }

    const updateSimulator = async () => {
      try {
        // Only update if simulator is already initialized
        if (simulatorCore.getSimulatorType && simulatorCore.getSimulatorType() !== 'none') {
          console.log('Updating simulator with new elements (no re-initialization)');
          await simulatorCore.update(elements);
        } else {
          console.log('Simulator not initialized, skipping update');
        }
      } catch (error) {
        console.error('Error updating simulator:', error);
        // Don't set error here as it's not critical
      }
    };

    updateSimulator();
  }, [elements]); // Run when elements change, but only update, don't re-initialize

  // Debug function to check simulator status
  const debugSimulatorStatus = useCallback(() => {
    if (simulatorCore.getSimulatorStatus) {
      const status = simulatorCore.getSimulatorStatus();
      console.log('Simulator status:', status);
      return status;
    } else {
      console.log('Simulator status method not available');
      return null;
    }
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
    
    simulatorCore.deactivateSimulation();
    clearError();
    setEnabledTransitionIds([]);
    
    console.log('All simulations stopped');
  }, [clearError]);

  // Refresh enabled transitions
  const refreshEnabledTransitions = useCallback(async () => {
    try {
      const enabled = await simulatorCore.getEnabledTransitions();
      if (enabled && Array.isArray(enabled)) {
        const transitionIds = enabled.map(t => t instanceof Map ? t.get('id') : t.id);
        setEnabledTransitionIds(transitionIds);
        return transitionIds;
      } else {
        console.warn('No enabled transitions found or invalid format');
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
        await simulatorCore.update(elements);
        
        // Only refresh enabled transitions if not simulating
        if (!isContinuousSimulating && !isRunning) {
          await refreshEnabledTransitions();
        }
      } catch (error) {
        console.error('Error updating simulator:', error);
        setSimulationError('Failed to update simulator');
      }
    };
    
    updateAndRefresh();
  }, [elements, isContinuousSimulating, isRunning, refreshEnabledTransitions]);

  // Fire a single transition
  const handleFireTransition = useCallback(async (transitionId) => {
    try {
      console.log(`=== Starting to fire transition ${transitionId} ===`);
      
      await simulatorCore.activateSimulation(false);
      
      console.log(`Firing transition ${transitionId}`);
      const newElements = await simulatorCore.fireTransition(transitionId);
      
      console.log('Received new elements from simulator:', {
        hasNewElements: !!newElements,
        type: typeof newElements,
        isArray: Array.isArray(newElements),
        keys: newElements ? Object.keys(newElements) : null
      });
      
      // Validate the returned Petri net structure
      if (!newElements || typeof newElements !== 'object') {
        throw new Error('Invalid Petri net returned from simulator');
      }
      
      if (!newElements.places || !Array.isArray(newElements.places) ||
          !newElements.transitions || !Array.isArray(newElements.transitions) ||
          !newElements.arcs || !Array.isArray(newElements.arcs)) {
        throw new Error('Incomplete Petri net structure returned from simulator');
      }
      
      console.log('Setting new elements after firing transition:', 
        `Places: ${newElements.places.length}, ` +
        `Transitions: ${newElements.transitions.length}, ` +
        `Arcs: ${newElements.arcs.length}`);
      
      // Create a deep copy for React state update
      const elementsCopy = JSON.parse(JSON.stringify(newElements));
      
      // Update the Petri net state
      setElements(elementsCopy);
      
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
      
      console.log(`=== Successfully fired transition ${transitionId} ===`);
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
      console.log('=== Starting step simulation ===');
      
      await simulatorCore.activateSimulation(false);
      
      const enabledTransitions = await simulatorCore.getEnabledTransitions();
      console.log('Step simulation - enabled transitions:', enabledTransitions);

      if (!enabledTransitions || enabledTransitions.length === 0) {
        console.log('No enabled transitions available, stopping simulation');
        stopAllSimulations();
        return;
      }

      const transitionToFire = enabledTransitions[0];
      const transitionId = transitionToFire instanceof Map ? 
        transitionToFire.get('id') : transitionToFire.id;

      if (!transitionId) {
        throw new Error('Invalid transition selected for firing');
      }

      console.log(`Step simulation - firing transition: ${transitionId}`);
      await handleFireTransition(transitionId);
      
      console.log('=== Step simulation completed ===');
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
  }, [handleFireTransition, stopAllSimulations]);

  // Start continuous simulation
  const startContinuousSimulation = useCallback(async () => {
    if (isContinuousSimulating || isRunning) return;
    
    try {
      simulatorCore.activateSimulation();
      
      const enabled = await simulatorCore.getEnabledTransitions();
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
    } catch (error) {
      console.error('Error starting continuous simulation:', error);
      setSimulationError('Failed to start continuous simulation');
    }
  }, [isContinuousSimulating, isRunning, stepSimulation]);

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
          console.log('Run simulation - enabled transitions:', enabled);
          
          if (!enabled || enabled.length === 0) {
            console.log('No enabled transitions available, stopping run');
            isRunningRef.current = false;
            setIsRunning(false);
            return;
          }

          const randomIndex = Math.floor(Math.random() * enabled.length);
          const transition = enabled[randomIndex];
          const transitionToFire = transition instanceof Map ? 
            transition.get('id') : transition.id;
          
          if (!transitionToFire) {
            throw new Error('Invalid transition selected for firing');
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
    } catch (error) {
      console.error('Error starting run simulation:', error);
      setSimulationError('Failed to start run simulation');
    }
  }, [isContinuousSimulating, refreshEnabledTransitions, handleFireTransition]);

  return {
    isContinuousSimulating,
    isRunning,
    enabledTransitionIds,
    simulationError,
    stepSimulation,
    startContinuousSimulation,
    startRunSimulation,
    stopAllSimulations,
    clearError,
    debugSimulatorStatus,
  };
};

export default useSimulationManager;
