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

const useSimulationManager = (elements, setElements) => {
  const [isContinuousSimulating, setIsContinuousSimulating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
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

  // Define refreshEnabledTransitions before using it
  const refreshEnabledTransitions = useCallback(async () => {
    try {
      const enabled = await getEnabledTransitions();
      const ids = (enabled || []).map((t) => t.id);
      setEnabledTransitionIds(ids);
      setSimulationError(null);
    } catch (error) {
      console.error('Error calculating enabled transitions:', error);
      setSimulationError(error.message || 'Failed to update enabled transitions.');
      setEnabledTransitionIds([]);
    }
  }, []);

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
  }, [isContinuousSimulating, isRunning, refreshEnabledTransitions]);

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
          const ids = (enabled || []).map((t) => t.id);
          setEnabledTransitionIds(ids);
        }
      } catch (error) {
        console.error('Error updating simulator:', error);
        setSimulationError('Failed to update simulator');
      }
    };
    
    updateAndRefresh();
  }, [elements, isContinuousSimulating, isRunning]);

  const handleFireTransition = useCallback(
    async (transitionId) => {
      try {
        // Activate simulation mode before firing transition
        activateSimulation();
        const newElements = await fireTransition(transitionId);
        setElements(newElements);
        setSimulationError(null);
      } catch (error) {
        console.error(`Error firing transition ${transitionId}:`, error);
        setSimulationError(error.message || `Failed to fire transition ${transitionId}.`);
      }
    },
    [setElements]
  );

  const stepSimulation = useCallback(() => {
    if (enabledTransitionIds.length > 0) {
      const randomIndex = Math.floor(Math.random() * enabledTransitionIds.length);
      const transitionToFire = enabledTransitionIds[randomIndex];
      handleFireTransition(transitionToFire);
    }
  }, [enabledTransitionIds, handleFireTransition]);

  const startContinuousSimulation = useCallback(() => {
    if (isContinuousSimulating || isRunning) return;
    setIsContinuousSimulating(true);
    isAnimatingRef.current = true;
    refreshEnabledTransitions();
    animationIntervalRef.current = setInterval(() => {
      if (isAnimatingRef.current) {
        stepSimulation();
      }
    }, 1000);
  }, [isContinuousSimulating, isRunning, stepSimulation, refreshEnabledTransitions]);

  const startRunSimulation = useCallback(async () => {
    if (isContinuousSimulating || isRunningRef.current) return;

    activateSimulation(); // Activate simulation mode
    setIsRunning(true);
    setIsContinuousSimulating(false);
    isRunningRef.current = true;
    refreshEnabledTransitions();

    const runStep = async () => {
      if (!isRunningRef.current) {
        setIsRunning(false);
        return;
      }

      const enabled = await getEnabledTransitions();
      if (enabled.length === 0) {
        isRunningRef.current = false;
        setIsRunning(false);
        return;
      }

      const randomIndex = Math.floor(Math.random() * enabled.length);
      const transitionToFire = enabled[randomIndex].id;

      try {
        const newElements = await fireTransition(transitionToFire);
        setElements(newElements);
        setTimeout(runStep, 50);
      } catch (error) {
        setSimulationError(error.message);
        isRunningRef.current = false;
        setIsRunning(false);
      }
    };

    runStep();
  }, [isContinuousSimulating, setElements, refreshEnabledTransitions]);

  const stopAllSimulations = useCallback(() => {
    // Reset state flags
    setIsContinuousSimulating(false);
    setIsRunning(false);
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
  }, []);

  return {
    isContinuousSimulating,
    isRunning,
    enabledTransitionIds,
    simulationError,
    stepSimulation,
    startContinuousSimulation,
    startRunSimulation,
    stopAllSimulations,
  };
};

export default useSimulationManager;
