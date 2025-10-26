/* @refresh reload */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { simulatorCore, useSimulationManager } from '../features/simulation';
import { collectSelection, remapIdsForPaste } from '../features/selection/clipboard-utils';
import { deleteNodesAndIncidentArcs } from '../features/net/net-ops';
import { useKeyboardShortcuts } from '../features/keymap/useKeyboardShortcuts';
// setZ3WorkerConfig is only available in browser; guard dynamic import
import debounce from 'lodash/debounce';
import { HistoryManager } from '../features/history/historyManager';

export const PetriNetContext = createContext();

export const PetriNetProvider = ({ children }) => {
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 3.0;
  const [elements, setElements] = useState({
    places: [],
    transitions: [],
    arcs: []
  });
  const [selectedElement, setSelectedElement] = useState(null);
  const [selectedElements, setSelectedElements] = useState([]); // array of { id, type }
  const [mode, setMode] = useState('select'); // select, place, transition, arc
  const [arcStart, setArcStart] = useState(null); // For arc creation
  const [tempArcEnd, setTempArcEnd] = useState(null); // For visual feedback during arc creation
  
  // Settings dialog state
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [simulationSettings, setSimulationSettings] = useState({
    maxIterations: 100,
    maxTokens: 20,
    netMode: 'pt',
    useNonVisualRun: false,
    useWorkerRun: false,
    prewarmSimulationWorker: false
  });
  const [z3Settings, setZ3Settings] = useState({
    minWorkers: 1,
    maxWorkers: 2,
    idleTimeoutMs: 300000,
    prewarmOnAlgebraicMode: true,
    solverTimeoutMs: 10000,
  });

  const [stageDimensions, setStageDimensions] = useState({ width: 800, height: 600 });
  const [virtualCanvasDimensions, setVirtualCanvasDimensions] = useState({ width: 10000, height: 7500 });
  const [canvasScroll, setCanvasScroll] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [gridSnappingEnabled, setGridSnappingEnabled] = useState(true);
  const gridSize = 20;

  // Track native file handle for Save/Save As semantics (File System Access API)
  const [saveFileHandle, setSaveFileHandle] = useState(null);

  const historyManagerRef = useRef(new HistoryManager({ places: [], transitions: [], arcs: [] }));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const appRef = useRef(null);
  const [containerRefValue, setContainerRefValue] = useState(null); // Changed from useRef to useState
  const stageRef = useRef(null);

  // More aggressive debounce for history updates to improve responsiveness
  const debouncedAddStateRef = useRef(
    debounce((state) => {
      const historyStatus = historyManagerRef.current.addState(state);
      setCanUndo(historyStatus.canUndo);
      setCanRedo(historyStatus.canRedo);
    }, 500) // Increased debounce time for better performance
  );

  // Track if we're currently dragging or changing modes to avoid expensive operations
  const [isDragging, setIsDragging] = useState(false);
  const [snapIndicator, setSnapIndicator] = useState({ visible: false, position: null, elementType: null });
  const prevModeRef = useRef(mode);
  const multiDragRef = useRef(null); // holds { baseId, startPositions: Map(id -> { type, x, y }) }
  const clipboardRef = useRef(null); // holds last copied selection payload
  const isShiftPressedRef = useRef(false);
  
  // Define updateHistory function after all refs and state are initialized
  const updateHistory = (newState, isSimulationStep = false) => {
    if (isSimulationStep) {
      // For simulation steps, update history immediately without debouncing
      const historyStatus = historyManagerRef.current.addState(newState);
      setCanUndo(historyStatus.canUndo);
      setCanRedo(historyStatus.canRedo);
    } else {
      // For regular edits, use debounced update
      debouncedAddStateRef.current(newState);
    }
  };
  
  const {
    isContinuousSimulating,
    isRunning,
    enabledTransitionIds,
    simulationError,
    isSimulatorReady,
    handleFireTransition,
    stepSimulation,
    startContinuousSimulation,
    startRunSimulation,
    stopAllSimulations,
  } = useSimulationManager(elements, setElements, updateHistory, simulationSettings?.netMode || 'pt');
  
  // Only update history when not dragging and not just changing modes
  useEffect(() => {
    // Skip history updates for mode changes or during dragging
    if (!isDragging && prevModeRef.current === mode) {
      updateHistory(elements);
    }
    
    // Update the previous mode reference
    prevModeRef.current = mode;
    
    return () => debouncedAddStateRef.current.cancel();
  }, [elements, isDragging, mode]);

  const handleUndo = () => {
    if (!canUndo) return;
    console.log('Undoing to previous state...');
    const result = historyManagerRef.current.undo();
    if (result) {
      console.log('Undo result:', result.state);
      setElements(result.state);
      setCanUndo(result.canUndo);
      setCanRedo(result.canRedo);
    }
  };

  const handleRedo = () => {
    if (!canRedo) return;
    console.log('Redoing to next state...');
    const result = historyManagerRef.current.redo();
    if (result) {
      console.log('Redo result:', result.state);
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



  const handleSaveSettings = (newSettings) => {
    setSimulationSettings(newSettings);
    setIsSettingsDialogOpen(false); // Also close the dialog on save
  };

  // Expose Z3 settings via context setter (used by Z3SettingsDialog through z3-remote)
  useEffect(() => {
    const run = async () => {
      if (typeof window === 'undefined') return;
      try {
        const { setZ3WorkerConfig } = await import('../utils/z3-remote');
        setZ3WorkerConfig(z3Settings);
      } catch (_) {}
    };
    run();
  }, [z3Settings]);

  // Complete reset function for editor and simulator
  const resetEditor = () => {
    // Reset elements to empty state
    const emptyState = {
      places: [],
      transitions: [],
      arcs: []
    };
    setElements(emptyState);
    
    // Reset selected element
    setSelectedElement(null);
    setSelectedElements([]);
    
    // Reset mode to select
    setMode('select');
    
    // Reset arc creation state
    setArcStart(null);
    setTempArcEnd(null);
    
    // Reset simulation settings to default
    setSimulationSettings({
      maxIterations: 100,
      maxTokens: 20,
      netMode: 'pt',
      useNonVisualRun: false,
      useWorkerRun: false,
      prewarmSimulationWorker: false
    });
    
    // Reset canvas state
    setCanvasScroll({ x: 0, y: 0 });
    setZoomLevel(1.0);
    
    // Reset history
    historyManagerRef.current = new HistoryManager(emptyState);
    setCanUndo(false);
    setCanRedo(false);
    
    console.log('Editor completely reset');
  };

  // Selection helpers
  const isIdSelected = (id, type) => {
    if (!id) return false;
    return selectedElements.some(se => se.id === id && se.type === type);
  };

  const clearSelection = () => {
    setSelectedElement(null);
    setSelectedElements([]);
  };

  const setSelection = (list) => {
    setSelectedElements(Array.isArray(list) ? list : []);
    // maintain last-focused element for properties panel
    if (Array.isArray(list) && list.length > 0) {
      // prefer last added as focused
      const last = list[list.length - 1];
      const found =
        (last.type === 'place' ? elements.places.find(p => p.id === last.id)
        : last.type === 'transition' ? elements.transitions.find(t => t.id === last.id)
        : elements.arcs.find(a => a.id === last.id));
      if (found) setSelectedElement({ ...found, type: last.type });
    } else {
      setSelectedElement(null);
    }
  };

  // Keyboard shortcuts delegated to hook
  useKeyboardShortcuts({
    elements,
    setElements,
    selectedElement,
    selectedElements,
    clearSelection,
    setSelection,
    clipboardRef,
    isShiftPressedRef,
  });

  return (
    <PetriNetContext.Provider value={{
      elements, setElements,
      selectedElement, setSelectedElement,
      mode, setMode,
      arcStart, setArcStart,
      tempArcEnd, setTempArcEnd,
      isDragging, setIsDragging, // Expose dragging state to optimize performance
      isContinuousSimulating,
      isRunning,
      isSimulatorReady,
      enabledTransitionIds,
      simulationError,
      stepSimulation,
      handleFireTransition,
      startContinuousSimulation,
      startRunSimulation,
      stopAllSimulations,
      isSettingsDialogOpen, setIsSettingsDialogOpen,
      simulationSettings, setSimulationSettings,
      netMode: (simulationSettings?.netMode || 'pt'),
      stageDimensions, setStageDimensions,
      virtualCanvasDimensions, setVirtualCanvasDimensions,
      canvasScroll, setCanvasScroll,
      zoomLevel, setZoomLevel,
      gridSnappingEnabled,
      toggleGridSnapping,
      gridSize,
      snapIndicator,
      setSnapIndicator,
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
      handleSaveSettings, // Expose settings save handler
      z3Settings, setZ3Settings,
      resetEditor, // Expose complete editor reset function
      MIN_ZOOM, // Expose MIN_ZOOM
      MAX_ZOOM  // Expose MAX_ZOOM
      ,
      simulatorCore, // Expose simulator core so Settings can change mode
      // Multi-select and clipboard
      selectedElements, setSelectedElements,
      isIdSelected, clearSelection, setSelection,
      multiDragRef,
      clipboardRef,
      isShiftPressedRef,
      // Save/Save As state
      saveFileHandle, setSaveFileHandle
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
