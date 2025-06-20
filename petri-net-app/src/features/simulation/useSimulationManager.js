import { useState, useEffect, useCallback, useRef } from 'react';
import debounce from 'lodash.debounce';
import {
  getEnabledTransitions,
  fireTransition,
  initializeSimulator,
  updateSimulator,
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
    initializeSimulator(elements);
  }, []);

  useEffect(() => {
    updateSimulator(elements);
  }, [elements]);

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

  const debouncedRefresh = useCallback(debounce(refreshEnabledTransitions, 300), [
    refreshEnabledTransitions,
  ]);

  useEffect(() => {
    debouncedRefresh();
    return () => debouncedRefresh.cancel();
  }, [elements, debouncedRefresh]);

  const handleFireTransition = useCallback(
    async (transitionId) => {
      try {
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
    animationIntervalRef.current = setInterval(() => {
      if (isAnimatingRef.current) {
        stepSimulation();
      }
    }, 1000);
  }, [isContinuousSimulating, isRunning, stepSimulation]);

  const startRunSimulation = useCallback(async () => {
    if (isContinuousSimulating || isRunningRef.current) return;

    setIsRunning(true);
    isRunningRef.current = true;

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
  }, [isContinuousSimulating, setElements]);

  const stopAllSimulations = useCallback(() => {
    setIsContinuousSimulating(false);
    isAnimatingRef.current = false;
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }

    isRunningRef.current = false;
    setIsRunning(false);

    setSimulationError(null);
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
