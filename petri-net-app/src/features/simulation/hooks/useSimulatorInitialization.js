import { useCallback, useEffect, useMemo } from 'react';
import debounce from 'lodash.debounce';
import { simulationEventBus, SimulationEvents } from '../SimulationEventBus.js';
import { getSimulationStats } from '../simulation-utils.js';

export const useSimulatorInitialization = ({
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
}) => {
  useEffect(() => {
    latestElementsRef.current = elements;
  }, [elements, latestElementsRef]);

  useEffect(() => {
    try {
      simulatorCore.setEventBus(simulationEventBus);
    } catch (_) {}
  }, [simulatorCore]);

  useEffect(() => {
    const manageSimulator = async () => {
      const hasElements =
        elements &&
        elements.places &&
        elements.transitions &&
        elements.arcs &&
        elements.places.length > 0 &&
        elements.transitions.length > 0 &&
        elements.arcs.length > 0;

      if (!hasElements) {
        try {
          await simulatorCore.deactivateSimulation?.();
          await simulatorCore.reset?.();
          setEnabledTransitionIds([]);
          setIsSimulatorReady(false);
          setSimulationError(null);
        } catch (error) {
          console.error('Failed to reset simulator:', error);
        }
        return;
      }

      try {
        console.log('Simulator force reset counter:', forceResetCounter);
        console.log('Initializing/updating simulator with:');
        console.log('- elements:', elements);
        console.log('- netMode parameter:', netMode);

        await simulatorCore.initialize(elements, { netMode });
      } catch (error) {
        console.error('Failed to initialize simulator:', error);
        setEnabledTransitionIds([]);
        setIsSimulatorReady(false);
        return;
      }

      try {
        await simulatorCore.update(latestElementsRef.current);
      } catch (error) {
        console.error('Failed to update simulator:', error);
        setEnabledTransitionIds([]);
        setIsSimulatorReady(false);
        setSimulationError('Failed to update simulator');
        return;
      }

      try {
        if (simulatorCore.isReady && (await simulatorCore.isReady())) {
          const enabled = await simulatorCore.getEnabledTransitions();
          setEnabledTransitionIds(enabled || []);
          setIsSimulatorReady(enabled && enabled.length > 0);
        } else {
          const stats = getSimulationStats(latestElementsRef.current);
          const enabled = stats?.enabledTransitions || [];
          setEnabledTransitionIds(enabled);
          setIsSimulatorReady(enabled.length > 0);
        }
        setSimulationError((prev) =>
          prev === 'Failed to update simulator' ? null : prev
        );
      } catch (error) {
        console.error('Failed to compute enabled transitions:', error);
        setEnabledTransitionIds([]);
        setIsSimulatorReady(false);
        setSimulationError('Failed to update simulator');
      }
    };

    manageSimulator();
  }, [
    elements,
    netMode,
    simulatorCore,
    forceResetCounter,
    setEnabledTransitionIds,
    setIsSimulatorReady,
    setSimulationError,
    latestElementsRef,
  ]);

  useEffect(() => {
    const handleTransitionsChanged = (eventData) => {
      setEnabledTransitionIds(eventData.enabled || []);
      setIsSimulatorReady(eventData.hasEnabled);
      try {
        if (typeof window !== 'undefined') {
          window.__ENABLED_TRANSITIONS__ = Array.isArray(eventData.enabled)
            ? eventData.enabled
            : [];
        }
      } catch (_) {}
    };

    const handleTransitionFired = (eventData) => {
      try {
        if (typeof window !== 'undefined') {
          window.__LAST_FIRED_TRANSITION_ID__ = eventData.transitionId || null;
        }
      } catch (_) {}
      if (eventData.newPetriNet) {
        setElements(eventData.newPetriNet);
        latestElementsRef.current = eventData.newPetriNet;
        if (updateHistory) updateHistory(eventData.newPetriNet, true);
      }
    };

    simulationEventBus.on(
      SimulationEvents.transitionsChanged,
      handleTransitionsChanged
    );
    simulationEventBus.on(
      SimulationEvents.transitionFired,
      handleTransitionFired
    );

    return () => {
      simulationEventBus.off(
        SimulationEvents.transitionsChanged,
        handleTransitionsChanged
      );
      simulationEventBus.off(
        SimulationEvents.transitionFired,
        handleTransitionFired
      );
    };
  }, [setElements, updateHistory, setEnabledTransitionIds, setIsSimulatorReady, latestElementsRef]);

  useEffect(() => {
    return () => {
      try {
        simulatorCore.deactivateSimulation();
      } catch (_) {}
    };
  }, [simulatorCore]);

  const refreshEnabledTransitions = useCallback(async () => {
    try {
      if (simulatorCore.isReady && (await simulatorCore.isReady())) {
        const enabled = await simulatorCore.getEnabledTransitions();
        setEnabledTransitionIds(enabled || []);
        const hasEnabled = Array.isArray(enabled) && enabled.length > 0;
        setIsSimulatorReady(hasEnabled);
        return enabled || [];
      }
      setEnabledTransitionIds([]);
      setIsSimulatorReady(false);
      return [];
    } catch (error) {
      console.error('Error refreshing enabled transitions:', error);
      setSimulationError('Failed to refresh enabled transitions');
      return [];
    }
  }, [simulatorCore, setEnabledTransitionIds, setIsSimulatorReady, setSimulationError]);

  const debouncedRefresh = useMemo(
    () => debounce(refreshEnabledTransitions, 100),
    [refreshEnabledTransitions]
  );

  useEffect(() => {
    return () => {
      debouncedRefresh.cancel();
    };
  }, [debouncedRefresh]);

  return { refreshEnabledTransitions, debouncedRefresh };
};

