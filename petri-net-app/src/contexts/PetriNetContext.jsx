import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { HistoryManager } from '../utils/historyManager';
import { getEnabledTransitions } from '../utils/simulator'; // Assuming historyManager.js is in utils

const PetriNetContext = createContext();

export const PetriNetProvider = ({ children }) => {
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 3.0;
  const [elements, setElements] = useState({
    places: [],
    transitions: [],
    arcs: []
  });
  const [selectedElement, setSelectedElement] = useState(null);
  const [mode, setMode] = useState('select'); // select, place, transition, arc
  const [arcStart, setArcStart] = useState(null); // For arc creation
  const [tempArcEnd, setTempArcEnd] = useState(null); // For visual feedback during arc creation
  
  // Simulation state
  const [simulationMode, setSimulationMode] = useState('step'); // step, quick, full
  const [isSimulating, setIsSimulating] = useState(false);
  const [enabledTransitionIds, setEnabledTransitionIds] = useState([]);
  const [simulationError, setSimulationError] = useState(null);
  const [visualAnimationInterval, setVisualAnimationInterval] = useState(null);
  const [isVisualAnimationRunning, setIsVisualAnimationRunning] = useState(false);
  
  // Settings dialog state
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [simulationSettings, setSimulationSettings] = useState({
    maxIterations: 100,
    maxTokens: 20
  });

  const [stageDimensions, setStageDimensions] = useState({ width: 800, height: 600 });
  const [virtualCanvasDimensions, setVirtualCanvasDimensions] = useState({ width: 10000, height: 7500 });
  const [canvasScroll, setCanvasScroll] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [gridSnappingEnabled, setGridSnappingEnabled] = useState(true);
  const gridSize = 20;

  const historyManagerRef = useRef(new HistoryManager({ places: [], transitions: [], arcs: [] }));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const appRef = useRef(null);
  const [containerRefValue, setContainerRefValue] = useState(null); // Changed from useRef to useState
  const stageRef = useRef(null);

  // Update history when elements change
  useEffect(() => {
    const historyStatus = historyManagerRef.current.addState(elements);
    setCanUndo(historyStatus.canUndo);
    setCanRedo(historyStatus.canRedo);
  }, [elements]);

  const updateHistory = (newState) => {
    const historyStatus = historyManagerRef.current.addState(newState);
    setCanUndo(historyStatus.canUndo);
    setCanRedo(historyStatus.canRedo);
  };

  const handleUndo = () => {
    if (!canUndo) return;
    const result = historyManagerRef.current.undo();
    if (result) {
      setElements(result.state);
      setCanUndo(result.canUndo);
      setCanRedo(result.canRedo);
    }
  };

  const handleRedo = () => {
    if (!canRedo) return;
    const result = historyManagerRef.current.redo();
    if (result) {
      setElements(result.state);
      setCanUndo(result.canUndo);
      setCanRedo(result.canRedo);
    }
  };

  const snapToGrid = (x, y) => {
    if (gridSnappingEnabled) {
      return {
        x: Math.round(x / gridSize) * gridSize,
        y: Math.round(y / gridSize) * gridSize
      };
    }
    return { x, y };
  };

  const toggleGridSnapping = () => {
    setGridSnappingEnabled(prev => !prev);
  };

  const refreshEnabledTransitions = () => {
    if (!elements || (!elements.places && !elements.transitions)) {
      setEnabledTransitionIds([]);
      return;
    }
    try {
      // Ensure elements has the expected structure for getEnabledTransitions
      const currentElements = JSON.parse(JSON.stringify(elements)); // Deep copy to be safe
      const ids = getEnabledTransitions(currentElements, simulationMode);
      setEnabledTransitionIds(ids || []); // Ensure it's always an array
      setSimulationError(null); // Clear previous errors
    } catch (error) {
      console.error("Error calculating enabled transitions:", error);
      setSimulationError(error.message || "Failed to update enabled transitions.");
      setEnabledTransitionIds([]);
    }
  };

  // Automatically update enabled transitions when elements or simulation mode changes
  useEffect(() => {
    refreshEnabledTransitions();
  }, [elements, simulationMode]);

  const handleSaveSettings = (newSettings) => {
    setSimulationSettings(newSettings);
    setIsSettingsDialogOpen(false); // Also close the dialog on save
  };

  return (
    <PetriNetContext.Provider value={{
      elements, setElements,
      selectedElement, setSelectedElement,
      mode, setMode,
      arcStart, setArcStart,
      tempArcEnd, setTempArcEnd,
      simulationMode, setSimulationMode,
      isSimulating, setIsSimulating,
      enabledTransitionIds, setEnabledTransitionIds,
      simulationError, setSimulationError,
      visualAnimationInterval, setVisualAnimationInterval,
      isVisualAnimationRunning, setIsVisualAnimationRunning,
      isSettingsDialogOpen, setIsSettingsDialogOpen,
      simulationSettings, setSimulationSettings,
      stageDimensions, setStageDimensions,
      virtualCanvasDimensions, setVirtualCanvasDimensions,
      canvasScroll, setCanvasScroll,
      zoomLevel, setZoomLevel,
      gridSnappingEnabled,
      toggleGridSnapping,
      gridSize,
      historyManagerRef, // Expose ref for direct manipulation if needed, though prefer actions
      canUndo,
      setCanUndo, // Expose setters if direct manipulation is needed, else remove
      canRedo,
      setCanRedo, // Expose setters if direct manipulation is needed, else remove
      handleUndo,
      handleRedo,
      updateHistory, // Expose for components that modify elements directly
      snapToGrid,
      appRef,
      containerRef: containerRefValue, // Expose the state value
      setContainerRef: setContainerRefValue, // Expose the setter
      stageRef,
      refreshEnabledTransitions, // Expose the new function
      handleSaveSettings, // Expose settings save handler
      MIN_ZOOM, // Expose MIN_ZOOM
      MAX_ZOOM  // Expose MAX_ZOOM
    }}>
      {children}
    </PetriNetContext.Provider>
  );
};

export const usePetriNet = () => {
  const context = useContext(PetriNetContext);
  if (context === undefined) {
    throw new Error('usePetriNet must be used within a PetriNetProvider');
  }
  return context;
};
