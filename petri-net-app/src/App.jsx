import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Rect, Text } from 'react-konva';
import Toolbar from './components/Toolbar';
import PropertiesPanel from './components/PropertiesPanel';
import ExecutionPanel from './components/ExecutionPanel';
// ImportExportPanel removed as requested
import Place from './components/Place';
import Transition from './components/Transition';
import Arc from './components/Arc';
import Grid from './components/Grid';
import SettingsDialog from './components/SettingsDialog';
import { HistoryManager } from './utils/historyManager';
// Import the simulator functions
import { initializeSimulator, getEnabledTransitions } from './utils/simulator';
import { applyAutoLayout } from './utils/autoLayout';

function App() {
  const [elements, setElements] = useState({
    places: [],
    transitions: [],
    arcs: []
  });
  const [selectedElement, setSelectedElement] = useState(null);
  const [mode, setMode] = useState('select'); // select, place, transition, arc
  const [arcStart, setArcStart] = useState(null); // For arc creation
  const [tempArcEnd, setTempArcEnd] = useState(null); // For visual feedback during arc creation
  const stageRef = useRef(null);
  const appRef = useRef(null); // Reference to the app container for keyboard events
  
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
    maxIterations: 100, // Default value, can be set to Infinity
    maxTokens: 20      // Default max tokens per place
  });

  // Use state for stage dimensions to allow for resizing
  const [stageDimensions, setStageDimensions] = useState({
    width: 800,
    height: 600
  });
  const gridSize = 20;
  
  // Reference to the container div
  const containerRef = useRef(null);
  
  // Virtual canvas dimensions (can be larger than visible area)
  const [virtualCanvasDimensions, setVirtualCanvasDimensions] = useState({
    width: 10000,  // Initial width of virtual canvas
    height: 7500   // Initial height of virtual canvas
  });
  
  // Scroll position for the canvas
  const [canvasScroll, setCanvasScroll] = useState({
    x: 0,
    y: 0
  });
  
  // Zoom level for the canvas (1.0 = 100%)
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const MIN_ZOOM = 0.1;  // 10% zoom
  const MAX_ZOOM = 3.0;  // 300% zoom
  const ZOOM_STEP = 0.1; // 10% per step
  
  // Constants for canvas expansion
  const expansionThreshold = 100; // px from edge to trigger expansion
  const expansionAmount = 500;    // px to expand in each direction

  // State to track elements being dragged for visual feedback
  const [draggedElement, setDraggedElement] = useState(null);
  
  // State to control grid snapping
  const [gridSnappingEnabled, setGridSnappingEnabled] = useState(true);
  
  // History manager for undo/redo functionality
  const [historyManager] = useState(() => {
    const manager = new HistoryManager(elements);
    return manager;
  });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    const historyStatus = historyManager.addState(elements);
    setCanUndo(historyStatus.canUndo);
    setCanRedo(historyStatus.canRedo);
  }, [elements, historyManager]);

  // Function to snap position to grid
  const snapToGrid = (x, y) => {
    // Only snap if grid snapping is enabled
    if (gridSnappingEnabled) {
      return {
        x: Math.round(x / gridSize) * gridSize,
        y: Math.round(y / gridSize) * gridSize
      };
    }
    // Otherwise return the original position
    return { x, y };
  };
  
  // Function to toggle grid snapping
  const toggleGridSnapping = () => {
    setGridSnappingEnabled(prev => !prev);
  };
  
  // Function to handle adding an angle point to an arc
  const handleAddAnglePoint = (arcId, anglePoint) => {
    setElements(prev => {
      // Find the arc to update
      const updatedArcs = prev.arcs.map(arc => {
        if (arc.id === arcId) {
          // Apply snap to grid if enabled
          const point = gridSnappingEnabled ? 
            snapToGrid(anglePoint.x, anglePoint.y) : 
            anglePoint;
          
          // Create or update the anglePoints array
          const anglePoints = arc.anglePoints ? [...arc.anglePoints] : [];
          anglePoints.push(point);
          
          // Return updated arc with new angle point
          return {
            ...arc,
            anglePoints
          };
        }
        return arc;
      });
      
      // Create new state with updated arcs
      const newState = {
        ...prev,
        arcs: updatedArcs
      };
      
      // Add to history
      const historyStatus = historyManager.addState(newState);
      setCanUndo(historyStatus.canUndo);
      setCanRedo(historyStatus.canRedo);
      
      return newState;
    });
  };
  
  // Function to handle dragging an angle point
  const handleDragAnglePoint = (arcId, pointIndex, newPosition) => {
    setElements(prev => {
      // Find the arc to update
      const updatedArcs = prev.arcs.map(arc => {
        if (arc.id === arcId && arc.anglePoints && arc.anglePoints[pointIndex]) {
          // Apply snap to grid if enabled
          const position = gridSnappingEnabled ? 
            snapToGrid(newPosition.x, newPosition.y) : 
            newPosition;
          
          // Create a copy of the angle points array
          const anglePoints = [...arc.anglePoints];
          
          // Update the position of the dragged angle point
          anglePoints[pointIndex] = position;
          
          // Return updated arc with modified angle point
          return {
            ...arc,
            anglePoints
          };
        }
        return arc;
      });
      
      // Create new state with updated arcs
      const newState = {
        ...prev,
        arcs: updatedArcs
      };
      
      // Add to history
      const historyStatus = historyManager.addState(newState);
      setCanUndo(historyStatus.canUndo);
      setCanRedo(historyStatus.canRedo);
      
      return newState;
    });
  };
  
  // Function to handle deleting an angle point
  const handleDeleteAnglePoint = (arcId, pointIndex) => {
    setElements(prev => {
      // Find the arc to update
      const updatedArcs = prev.arcs.map(arc => {
        if (arc.id === arcId && arc.anglePoints && arc.anglePoints[pointIndex] !== undefined) {
          // Create a copy of the angle points array without the deleted point
          const anglePoints = [...arc.anglePoints];
          anglePoints.splice(pointIndex, 1);
          
          // Return updated arc with modified angle points array
          return {
            ...arc,
            anglePoints
          };
        }
        return arc;
      });
      
      // Create new state with updated arcs
      const newState = {
        ...prev,
        arcs: updatedArcs
      };
      
      // Add to history
      const historyStatus = historyManager.addState(newState);
      setCanUndo(historyStatus.canUndo);
      setCanRedo(historyStatus.canRedo);
      
      return newState;
    });
  };
  
  // Function to apply auto-layout to the Petri net
  const handleAutoLayout = () => {
    // Get the current canvas dimensions for the auto-layout algorithm
    const layoutDimensions = {
      width: virtualCanvasDimensions.width,
      height: virtualCanvasDimensions.height
    };
    
    // Apply the auto-layout algorithm (using a copy of elements to avoid mutation)
    const newElements = applyAutoLayout(
      JSON.parse(JSON.stringify(elements)), 
      layoutDimensions, 
      gridSize
    );
    
    // Update the elements state
    setElements(newElements);
    
    // Add to history
    updateHistory(newElements);
    
    // Center the view on the newly laid out elements
    centerViewOnElements(newElements);
  };
  
  // Function to center the view on a set of elements
  const centerViewOnElements = (elements) => {
    if (!elements.places.length && !elements.transitions.length) return;
    
    // Calculate the bounding box of all elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    // Check places
    elements.places.forEach(place => {
      minX = Math.min(minX, place.x);
      minY = Math.min(minY, place.y);
      maxX = Math.max(maxX, place.x);
      maxY = Math.max(maxY, place.y);
    });
    
    // Check transitions
    elements.transitions.forEach(transition => {
      minX = Math.min(minX, transition.x);
      minY = Math.min(minY, transition.y);
      maxX = Math.max(maxX, transition.x);
      maxY = Math.max(maxY, transition.y);
    });
    
    // Calculate center of the bounding box
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Calculate the center of the viewport
    const viewportCenterX = stageDimensions.width / 2;
    const viewportCenterY = stageDimensions.height / 2;
    
    // Set the scroll position to center the elements
    setCanvasScroll({
      x: centerX * zoomLevel - viewportCenterX,
      y: centerY * zoomLevel - viewportCenterY
    });
  };
  
  // Function to handle the start of dragging an element
  const handleDragStart = (element, elementType) => {
    setDraggedElement({ element, elementType });
  };

  // Function to handle the end of dragging an element and update its position
  const handleDragEnd = (element, elementType, newPos) => {
    // Clear the dragged element state
    setDraggedElement(null);
    
    // Snap the new position to grid if enabled
    const snappedPos = snapToGrid(newPos.x, newPos.y);
    
    // Update the element's position in the state
    setElements(prev => {
      let newState;
      
      if (elementType === 'place') {
        // Update the place position
        const updatedPlaces = prev.places.map(place => {
          if (place.id === element.id) {
            return { ...place, x: snappedPos.x / zoomLevel, y: snappedPos.y / zoomLevel };
          }
          return place;
        });
        
        newState = { ...prev, places: updatedPlaces };
      } else if (elementType === 'transition') {
        // Update the transition position
        const updatedTransitions = prev.transitions.map(transition => {
          if (transition.id === element.id) {
            return { ...transition, x: snappedPos.x / zoomLevel, y: snappedPos.y / zoomLevel };
          }
          return transition;
        });
        
        newState = { ...prev, transitions: updatedTransitions };
      }
      
      // Add to history after state update
      updateHistory(newState);
      return newState;
    });
  };
  
  // Function to update history after state changes
  const updateHistory = (newState) => {
    const historyStatus = historyManager.addState(newState);
    setCanUndo(historyStatus.canUndo);
    setCanRedo(historyStatus.canRedo);
  };
  
  // Function to fire a transition and update the state
  const fireTransitionAndUpdate = async (transitionId) => {
    try {
      // Get the transition from the enabledTransitionIds
      if (!enabledTransitionIds.includes(transitionId)) {
        console.warn(`Transition ${transitionId} is not enabled`);
        return false;
      }
      
      console.log(`Firing transition ${transitionId} in visual animation mode`);
      
      // Import the fireTransition function directly
      const { fireTransition } = await import('./utils/simulator');
      
      // Fire the transition and get the updated Petri net
      const updatedPetriNet = await fireTransition(transitionId);
      
      // Update the elements state
      setElements(updatedPetriNet);
      
      // Add to history
      updateHistory(updatedPetriNet);
      
      // Import the getEnabledTransitions function directly
      const { getEnabledTransitions } = await import('./utils/simulator');
      
      // Get the new enabled transitions
      const newEnabled = await getEnabledTransitions();
      console.log('New enabled transitions:', newEnabled);
      
      // Update enabled transitions
      updateEnabledTransitions(newEnabled);
      
      return newEnabled.length > 0; // Return true if there are still enabled transitions
    } catch (error) {
      console.error(`Error firing transition ${transitionId}:`, error);
      setSimulationError(`Error firing transition: ${error.message}`);
      return false;
    }
  };
  
  // Function to run the visual animation
  const runVisualAnimation = async () => {
    console.log('Running visual animation cycle', { 
      isSimulating, 
      simulationMode, 
      enabledTransitionIds 
    });
    
    if (!isSimulating || simulationMode !== 'quick' || !enabledTransitionIds.length) {
      console.log('Stopping visual animation - conditions not met');
      stopVisualAnimation();
      return;
    }
    
    // Get the first enabled transition
    const transitionId = enabledTransitionIds[0];
    console.log(`Attempting to fire transition ${transitionId}`);
    
    // Fire the transition and update the state
    const hasMoreTransitions = await fireTransitionAndUpdate(transitionId);
    
    // If there are no more enabled transitions, stop the animation
    if (!hasMoreTransitions) {
      console.log('No more enabled transitions, stopping animation');
      stopVisualAnimation();
    }
  };
  
  // Function to stop the visual animation
  const stopVisualAnimation = () => {
    console.log('Stopping visual animation');
    if (visualAnimationInterval) {
      console.log('Clearing animation interval');
      clearInterval(visualAnimationInterval);
      setVisualAnimationInterval(null);
    }
    setIsVisualAnimationRunning(false);
  };
  
  // Function to start simulation based on the selected mode
  const startSimulation = async () => {
    if (simulationMode === 'step') {
      // Step-by-step mode is handled by the ExecutionPanel
      return;
    }
    try {
      console.log('Starting simulation with mode:', simulationMode);
      
      // Initialize the simulator with the current Petri net state
      const { initializeSimulator } = await import('./utils/simulator');
      await initializeSimulator(elements);
      
      // Get the enabled transitions
      const { getEnabledTransitions } = await import('./utils/simulator');
      const enabled = await getEnabledTransitions();
      console.log('Enabled transitions after initialization:', enabled);
      
      // Update the enabled transitions
      updateEnabledTransitions(enabled);
      
      // Set the simulation state
      setIsSimulating(true);
      setSimulationError(null);
      
      // If we're in quick mode, start the visual animation
      if (simulationMode === 'quick') {
        console.log('Starting visual animation from simulation start');
        // Add a small delay to ensure state is updated
        setTimeout(() => {
          startVisualAnimation();
        }, 100);
      }
      
      // The actual simulation logic is handled by the ExecutionPanel component
    } catch (error) {
      console.error('Error starting simulation:', error);
      setSimulationError(`Error starting simulation: ${error.message}`);
      setIsSimulating(false);
    }
  };
  
  // Function to stop simulation
  const stopSimulation = () => {
    // Stop the visual animation if it's running
    stopVisualAnimation();
    
    // Set simulation state to false
    setIsSimulating(false);
  };
  
  // Function to clear the canvas
  const clearCanvas = () => {
    // Create an empty Petri net
    const emptyPetriNet = {
      places: [],
      transitions: [],
      arcs: []
    };
    
    // Update the elements state
    setElements(emptyPetriNet);
    
    // Add to history
    updateHistory(emptyPetriNet);
    
    // Reset selection and mode
    setSelectedElement(null);
    setMode('select');
    
    // Reset simulation state
    setIsSimulating(false);
    setEnabledTransitionIds([]);
  };

  // Function to update enabled transitions
  const updateEnabledTransitions = (enabledTransitions) => {
    if (!enabledTransitions) {
      console.log('No enabled transitions provided, clearing state');
      setEnabledTransitionIds([]);
      return;
    }
    
    // Extract just the IDs from the enabled transitions
    const transitionIds = enabledTransitions.map(t => t.id);
    console.log('Updating enabled transition IDs:', transitionIds);
    setEnabledTransitionIds(transitionIds);
  };

  // Function to find a potential arc target near the cursor position
  const findPotentialArcTarget = (position) => {
    // Constants for element dimensions
    const PLACE_RADIUS = 20;
    const TRANSITION_WIDTH = 30;
    const TRANSITION_HEIGHT = 40;
    
    // If arc starts from a place, we can only connect to a transition
    if (arcStart && arcStart.elementType === 'place') {
      // Find a transition that contains the position
      const nearbyTransition = elements.transitions.find(transition => {
        // Skip if this is the source element
        if (transition.id === arcStart.element.id) return false;
        
        // Check if position is inside the transition rectangle
        const halfWidth = TRANSITION_WIDTH / 2;
        const halfHeight = TRANSITION_HEIGHT / 2;
        return (
          position.x >= transition.x - halfWidth &&
          position.x <= transition.x + halfWidth &&
          position.y >= transition.y - halfHeight &&
          position.y <= transition.y + halfHeight
        );
      });
      
      if (nearbyTransition) {
        // Get the optimal connection point
        const point = findNearestCardinalPoint(
          nearbyTransition,
          'transition',
          { x: arcStart.element.x, y: arcStart.element.y }
        );
        
        return {
          x: nearbyTransition.x,
          y: nearbyTransition.y,
          element: nearbyTransition,
          elementType: 'transition',
          point: point
        };
      }
    }
    
    // If arc starts from a transition, we can only connect to a place
    if (arcStart && arcStart.elementType === 'transition') {
      // Find a place that contains the position
      const nearbyPlace = elements.places.find(place => {
        // Skip if this is the source element
        if (place.id === arcStart.element.id) return false;
        
        // Check if position is inside the place circle
        const distance = Math.sqrt(
          Math.pow(place.x - position.x, 2) + 
          Math.pow(place.y - position.y, 2)
        );
        return distance <= PLACE_RADIUS; // Use <= to include the edge
      });
      
      if (nearbyPlace) {
        // Get the optimal connection point
        const point = findNearestCardinalPoint(
          nearbyPlace,
          'place',
          { x: arcStart.element.x, y: arcStart.element.y }
        );
        
        return {
          x: nearbyPlace.x,
          y: nearbyPlace.y,
          element: nearbyPlace,
          elementType: 'place',
          point: point
        };
      }
    }
    
    return null;
  };

  // Function to find potential target elements near a point
  const findPotentialTarget = (x, y) => {
    // Check if point is near any place or transition that could be a valid target
    const sourceType = arcStart.elementType;
    const validTargetType = sourceType === 'place' ? 'transition' : 'place';
    
    // Check elements of the valid target type
    const targetElements = validTargetType === 'place' ? elements.places : elements.transitions;
    
    // Don't allow connecting to the source element itself
    const validTargets = targetElements.filter(el => el.id !== arcStart.element.id);
    
    // Find the closest element within a certain radius
    const snapRadius = 50; // Pixels
    let closestElement = null;
    let minDistance = snapRadius;
    let closestPoint = null;
    
    validTargets.forEach(element => {
      const points = getCardinalPoints(element, validTargetType);
      
      Object.entries(points).forEach(([direction, point]) => {
        const dx = point.x - x;
        const dy = point.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestElement = element;
          closestPoint = { direction, point };
        }
      });
    });
    
    // Check if the closest element is within the detection radius
    const potentialTarget = findPotentialArcTarget({ x, y });
    
    if (potentialTarget) {
      return { element: potentialTarget, type: validTargetType, point: closestPoint };
    } else {
      return null;
    }
  };
  
  // Handle stage click for element creation
  const handleStageClick = (e) => {
    // Only handle clicks on the background
    if (e.target.name() === 'background') {
      // Get click position
      const pointerPos = e.target.getStage().getPointerPosition();
      const clickPos = {
        x: pointerPos.x / zoomLevel + canvasScroll.x / zoomLevel,
        y: pointerPos.y / zoomLevel + canvasScroll.y / zoomLevel
      };
      
      // Snap to grid if enabled
      const snappedPos = snapToGrid(clickPos.x, clickPos.y);
      
      // Check if we need to expand the canvas
      checkCanvasExpansion(clickPos);
      
      // Create new element based on mode
      switch (mode) {
        case 'place':
          addElement('place', snappedPos.x, snappedPos.y);
          break;
        case 'transition':
          addElement('transition', snappedPos.x, snappedPos.y);
          break;
        case 'arc':
          if (arcStart) {
            // If we're in arc creation mode and have started an arc,
            // clicking anywhere on the stage cancels the arc creation
            console.log('Arc creation canceled by clicking on empty area');
            setArcStart(null);
            setTempArcEnd(null);
          }
          break;
        default:
          break;
      }
    }
  };
  
  // Function to handle mouse move for arc creation visual feedback
  const handleMouseMove = (e) => {
    if (mode === 'arc' && arcStart) {
      const stage = e.target.getStage();
      const pointerPosition = stage.getPointerPosition();
      
      // Adjust for scroll position and zoom
      const adjustedPosition = {
        x: (pointerPosition.x / zoomLevel) + (canvasScroll.x / zoomLevel),
        y: (pointerPosition.y / zoomLevel) + (canvasScroll.y / zoomLevel)
      };
      
      // Check if we need to expand the canvas
      checkCanvasExpansion(adjustedPosition);
      
      // Find the nearest cardinal point on the source element
      const sourcePoint = findNearestCardinalPoint(
        arcStart.element, 
        arcStart.elementType, 
        adjustedPosition
      ).point;
      
      // Check if mouse is near a potential target
      const potentialTarget = findPotentialArcTarget(adjustedPosition);
      
      // Update the temporary arc end point
      setTempArcEnd({
        sourcePoint,
        x: potentialTarget ? potentialTarget.x : adjustedPosition.x,
        y: potentialTarget ? potentialTarget.y : adjustedPosition.y,
        potentialTarget,
        mousePosition: adjustedPosition // Store the raw mouse position
      });
      
      // Prevent default to avoid text selection during arc drawing
      e.evt.preventDefault();
    }
  };

  // Effect to update virtual canvas dimensions when necessary
  useEffect(() => {
    // Adjust virtual canvas size based on stage dimensions and zoom level
    const updateVirtualCanvasSize = () => {
      if (stageDimensions.width && stageDimensions.height) {
        // At minimum zoom (10%), the virtual canvas should be 10x the visible area
        // This ensures the entire canvas is filled at maximum zoom out
        const minZoomMultiplier = 1 / MIN_ZOOM;
        setVirtualCanvasDimensions({
          width: stageDimensions.width * minZoomMultiplier,
          height: stageDimensions.height * minZoomMultiplier
        });
      }
    };
    
    updateVirtualCanvasSize();
  }, [stageDimensions, MIN_ZOOM]);
  
  // Expose Petri net state for e2e testing
  useEffect(() => {
    if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') {
      window.__PETRI_NET_STATE__ = {
        places: elements.places,
        transitions: elements.transitions,
        arcs: elements.arcs
      };
    }
  }, [elements.places, elements.transitions, elements.arcs]);

  // Function to get cardinal points of an element (N, E, S, W points)
  const getCardinalPoints = (element, elementType) => {
    // Hardcoded dimensions from the Place and Transition components
    const PLACE_RADIUS = 20;
    const TRANSITION_WIDTH = 30;
    const TRANSITION_HEIGHT = 40;
    
    // Calculate cardinal points based on element type
    if (elementType === 'place') {
      return {
        north: { point: { x: element.x, y: element.y - PLACE_RADIUS } },
        east: { point: { x: element.x + PLACE_RADIUS, y: element.y } },
        south: { point: { x: element.x, y: element.y + PLACE_RADIUS } },
        west: { point: { x: element.x - PLACE_RADIUS, y: element.y } }
      };
    } else if (elementType === 'transition') {
      // For transitions (rectangles), use the center points of each side
      const halfWidth = TRANSITION_WIDTH / 2;
      const halfHeight = TRANSITION_HEIGHT / 2;
      return {
        north: { point: { x: element.x, y: element.y - halfHeight } },
        east: { point: { x: element.x + halfWidth, y: element.y } },
        south: { point: { x: element.x, y: element.y + halfHeight } },
        west: { point: { x: element.x - halfWidth, y: element.y } }
      };
    }
    
    // Default fallback (should not reach here)
    return {
      north: { point: { x: element.x, y: element.y } },
      east: { point: { x: element.x, y: element.y } },
      south: { point: { x: element.x, y: element.y } },
      west: { point: { x: element.x, y: element.y } }
    };
  };

  // Function to find the nearest cardinal point to a given position
  const findNearestCardinalPoint = (element, elementType, position) => {
    const points = getCardinalPoints(element, elementType);
    
    let minDistance = Infinity;
    let nearestPoint = null;
    let direction = null;
    
    Object.entries(points).forEach(([dir, point]) => {
      const distance = Math.sqrt(
        Math.pow(point.point.x - position.x, 2) + 
        Math.pow(point.point.y - position.y, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = point.point;
        direction = dir;
      }
    });
    
    return { point: nearestPoint, direction };
  };

  // Function to check if we need to expand the canvas
  const checkCanvasExpansion = (position) => {
    const expandMargin = 200; // px
    let needsUpdate = false;
    let newWidth = virtualCanvasDimensions.width;
    let newHeight = virtualCanvasDimensions.height;
    
    // Check if we need to expand width
    if (position.x > virtualCanvasDimensions.width - expandMargin) {
      newWidth = virtualCanvasDimensions.width + 500;
      needsUpdate = true;
    }
    
    // Check if we need to expand height
    if (position.y > virtualCanvasDimensions.height - expandMargin) {
      newHeight = virtualCanvasDimensions.height + 500;
      needsUpdate = true;
    }
    
    // Update dimensions if needed
    if (needsUpdate) {
      setVirtualCanvasDimensions({
        width: newWidth,
        height: newHeight
      });
    }
  };
  
  // Function to add a new element (place or transition) to the canvas
  const addElement = (type, x, y) => {
    const id = `${type}-${Date.now()}`;
    
    // Create the new element with the requested naming convention
    const newElement = {
      id,
      x,
      y,
      label: type === 'place' ? `P${elements.places.length + 1}` : `T${elements.transitions.length + 1}`
    };
    
    // Add tokens field if it's a place
    if (type === 'place') {
      newElement.tokens = 0;
    }
    
    // Update the state with the new element
    setElements(prev => {
      // Create a new array with the new element added
      const updatedElements = {
        ...prev,
        [`${type}s`]: [...prev[`${type}s`], newElement]
      };
      
      // Add to history
      updateHistory(updatedElements);
      
      return updatedElements;
    });
    
    // No longer automatically switch to select mode
    // This allows the user to continue adding the same element type
  };
  
  // Function to handle element click for selection or arc creation
  const handleElementClick = (element, elementType) => {
    console.log(`Element clicked: ${elementType} ${element.id} in mode: ${mode}`);
    
    if (mode === 'arc') {
      // Prevent starting an arc from another arc
      if (elementType === 'arc') {
        console.log('Cannot start an arc from another arc');
        // Instead, select the arc when clicked in arc mode
        setSelectedElement({ element, type: elementType });
        return;
      }
      
      if (!arcStart) {
        // Start creating an arc
        setArcStart({ element, elementType });
        console.log(`Arc creation started from ${elementType} ${element.id}`);
        
        // Initialize tempArcEnd with the source element's position
        const sourcePoint = findNearestCardinalPoint(
          element,
          elementType,
          { x: element.x + 1, y: element.y + 1 } // Slight offset to force a direction
        ).point;
        
        setTempArcEnd({
          sourcePoint,
          x: element.x,
          y: element.y,
          potentialTarget: null,
          mousePosition: { x: element.x, y: element.y }
        });
      } else {
        try {
          // Complete the arc if valid connection
          const startType = arcStart.elementType;
          const endType = elementType;
          
          // Don't allow connecting to the same element
          if (arcStart.element.id === element.id) {
            console.log('Cannot connect an element to itself');
            return;
          }
          
          // Validate: arcs can only connect place->transition or transition->place
          if ((startType === 'place' && endType === 'transition') ||
              (startType === 'transition' && endType === 'place')) {
            
            // Get optimal connection points
            const sourceCardinal = findNearestCardinalPoint(
              arcStart.element,
              startType,
              element
            );
            
            const targetCardinal = findNearestCardinalPoint(
              element,
              endType,
              arcStart.element
            );
            
            const newArc = {
              id: `arc-${Date.now()}`,
              sourceId: arcStart.element.id,
              targetId: element.id,
              sourceType: startType,
              targetType: endType,
              sourceDirection: sourceCardinal.direction,
              targetDirection: targetCardinal.direction,
              weight: 1
            };
            
            console.log('Creating new arc:', newArc);
            
            setElements(prev => {
              const newState = {
                ...prev,
                arcs: [...prev.arcs, newArc]
              };
              // Add to history after state update
              updateHistory(newState);
              return newState;
            });
            console.log(`Arc created from ${startType} ${arcStart.element.id} to ${endType} ${element.id}`);
          } else {
            console.log(`Invalid arc connection: ${startType} to ${endType}`);
          }
        } catch (error) {
          console.error('Error during arc creation:', error);
        } finally {
          // Always reset arc start and temp end, even if there was an error
          setArcStart(null);
          setTempArcEnd(null);
        }
      }
    } else if (mode === 'select') {
      // Select the element
      setSelectedElement(element);
    }
  };

  // Function to delete the selected element
  const deleteSelectedElement = () => {
    if (!selectedElement) return;
    
    // Determine the type of the selected element
    const elementType = selectedElement.id.split('-')[0]; // e.g., 'place', 'transition', 'arc'
    
    if (elementType === 'arc') {
      // Just delete the arc
      setElements(prev => {
        const newState = {
          ...prev,
          arcs: prev.arcs.filter(arc => arc.id !== selectedElement.id)
        };
        // Add to history after state update
        updateHistory(newState);
        return newState;
      });
    } else if (elementType === 'place' || elementType === 'transition') {
      // Delete the element and all connected arcs
      setElements(prev => {
        // Filter out arcs connected to this element
        const filteredArcs = prev.arcs.filter(arc => 
          arc.sourceId !== selectedElement.id && arc.targetId !== selectedElement.id
        );
        
        // Filter out the element itself
        let newState;
        if (elementType === 'place') {
          newState = {
            ...prev,
            places: prev.places.filter(place => place.id !== selectedElement.id),
            arcs: filteredArcs
          };
        } else { // transition
          newState = {
            ...prev,
            transitions: prev.transitions.filter(transition => transition.id !== selectedElement.id),
            arcs: filteredArcs
          };
        }
        
        // Add to history after state update
        updateHistory(newState);
        return newState;
      });
    }
    
    // Clear selection after deletion
    setSelectedElement(null);
  };
  
  // Function to handle keyboard events
  const handleKeyDown = (e) => {
    // Check if the event is happening in an input or textarea field
    const tagName = e.target.tagName.toLowerCase();
    const isInputField = tagName === 'input' || tagName === 'textarea' || 
                         e.target.isContentEditable || 
                         e.target.getAttribute('role') === 'textbox';
    
    // Only process Delete/Backspace key when not in an input field
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement && !isInputField) {
      deleteSelectedElement();
    }
    
    // Undo with Ctrl+Z
    if (e.ctrlKey && e.key === 'z') {
      handleUndo();
    }
    
    // Redo with Ctrl+Y
    if (e.ctrlKey && e.key === 'y') {
      handleRedo();
    }
  };
  
  // Function to handle undo
  const handleUndo = async () => {
    if (!canUndo) return;
    
    const result = historyManager.undo();
    if (result) {
      // Directly set the elements without going through updateHistory
      // to avoid adding the state back to history
      setElements(result.state);
      setCanUndo(result.canUndo);
      setCanRedo(result.canRedo);
      
      // Reinitialize simulator with the new state to ensure conflict detection works correctly
      if (isSimulating) {
        try {
          const { initializeSimulator, getEnabledTransitions } = await import('./utils/simulator');
          await initializeSimulator(result.state);
          const enabled = await getEnabledTransitions();
          updateEnabledTransitions(enabled);
        } catch (error) {
          console.error('Error reinitializing simulator after undo:', error);
        }
      }
    }
  };
  
  // Function to handle redo
  const handleRedo = async () => {
    if (!canRedo) return;
    
    const result = historyManager.redo();
    if (result) {
      // Directly set the elements without going through updateHistory
      // to avoid adding the state back to history
      setElements(result.state);
      setCanUndo(result.canUndo);
      setCanRedo(result.canRedo);
      
      // Reinitialize simulator with the new state to ensure conflict detection works correctly
      if (isSimulating) {
        try {
          const { initializeSimulator, getEnabledTransitions } = await import('./utils/simulator');
          await initializeSimulator(result.state);
          const enabled = await getEnabledTransitions();
          updateEnabledTransitions(enabled);
        } catch (error) {
          console.error('Error reinitializing simulator after redo:', error);
        }
      }
    }
  };
  
  // Function to cancel arc creation
  const cancelArcCreation = () => {
    setArcStart(null);
    setTempArcEnd(null);
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only process shortcuts if not typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      // Escape key to cancel arc creation
      if (e.key === 'Escape' && arcStart) {
        e.preventDefault();
        console.log('Arc creation canceled by Escape key');
        setArcStart(null);
        setTempArcEnd(null);
        return;
      }
      
      // Ctrl+Z for undo
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      
      // Ctrl+Y for redo
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
      
      // Delete key to delete selected element
      if (e.key === 'Delete' && selectedElement) {
        e.preventDefault();
        deleteSelectedElement();
      }
    };
    
    // Add event listener to the document
    document.addEventListener('keydown', handleKeyDown);
    
    // Clean up event listener on component unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedElement, arcStart, handleUndo, handleRedo]); // Re-add listener when dependencies change

  // Function to handle the start of a full simulation (non-visual)
  const startFullSimulation = async () => {
    try {
      // Import the computeReachableMarkings function directly
      const { computeReachableMarkings } = await import('./utils/simulator');
      
      // Compute all reachable markings with the configured max iterations
      const maxIterations = simulationSettings.maxIterations === Infinity ? 1000 : simulationSettings.maxIterations;
      const reachableMarkings = await computeReachableMarkings(maxIterations);
      
      // If there are reachable markings, update the elements state with the final marking
      if (reachableMarkings && reachableMarkings.length > 0) {
        const finalMarking = reachableMarkings[reachableMarkings.length - 1];
        
        // Update the elements state
        setElements(prev => {
          // Create a copy of the previous state
          const newState = { ...prev };
          
          // Update the tokens in each place
          newState.places = newState.places.map(place => {
            const placeId = place.id;
            const tokens = finalMarking[placeId] || 0;
            return { ...place, tokens };
          });
          
          return newState;
        });
        
        // Add to history
        updateHistory(elements);
      }
    } catch (error) {
      console.error('Error in full simulation:', error);
      setSimulationError('Error in full simulation: ' + error.message);
    }
  };

  // Function to handle the start of a visual animation simulation
  const startVisualAnimation = () => {
    if (isVisualAnimationRunning) return;
    
    setIsVisualAnimationRunning(true);
    
    // Reset iteration counter
    let iterationCount = 0;
    const maxIterations = simulationSettings.maxIterations;
    
    // Set up an interval to fire transitions automatically
    const interval = setInterval(async () => {
      try {
        // Check if we've reached the maximum number of iterations
        if (maxIterations !== Infinity && iterationCount >= maxIterations) {
          console.log(`Maximum iterations (${maxIterations}) reached, stopping animation`);
          stopVisualAnimation();
          return;
        }
        
        // Increment iteration counter
        iterationCount++;
        
        // Check if there are any enabled transitions
        const enabledTransitions = await getEnabledTransitions();
        
        if (enabledTransitions.length === 0) {
          // No more enabled transitions, stop the animation
          stopVisualAnimation();
          return;
        }
        
        // Fire the first enabled transition
        await fireTransitionAndUpdate(enabledTransitions[0].id);
      } catch (error) {
        console.error('Error in visual animation:', error);
        stopVisualAnimation();
      }
    }, 200); // 200ms delay between transitions
    
    setVisualAnimationInterval(interval);
  };

  // Function to handle opening the settings dialog
  const handleOpenSettings = () => {
    setIsSettingsDialogOpen(true);
  };
  
  // Function to handle saving settings
  const handleSaveSettings = (newSettings) => {
    setSimulationSettings(newSettings);
    console.log('Simulation settings updated:', newSettings);
  };

  // Handle mode change from toolbar
  const handleModeChange = (newMode) => {
    console.log(`Mode changing from ${mode} to ${newMode}`);
    
    // If we were in arc mode and switching to another mode, cancel arc creation
    if (mode === 'arc' && arcStart) {
      cancelArcCreation();
    }
    
    // Set the new mode
    setMode(newMode);
    
    // Special handling for arc mode
    if (newMode === 'arc') {
      console.log('Entering arc creation mode - click on a source element');
      setArcStart(null);
      setTempArcEnd(null);
    }
  };

  // Effect to add and remove keyboard event listeners
  React.useEffect(() => {
    // Add event listener when the component mounts
    document.addEventListener('keydown', handleKeyDown);
    
    // Remove event listener when the component unmounts
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedElement, canUndo, canRedo]); // Re-add listener when dependencies change

  // Handle scroll events to navigate the virtual canvas
  const handleScroll = (e) => {
    // Only prevent default if we're handling the scroll
    if (containerRef.current && containerRef.current.contains(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      
      // Check if Ctrl key is pressed for zooming
      if (e.ctrlKey) {
        // Zoom with the wheel
        const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
        handleZoom(delta, { x: e.clientX, y: e.clientY });
      } else {
        // Regular scrolling
        const deltaX = e.deltaX;
        const deltaY = e.deltaY;
        
        // Update scroll position with limits
        setCanvasScroll(prev => {
          // Calculate max scroll positions based on virtual canvas size and zoom level
          const maxScrollX = Math.max(0, virtualCanvasDimensions.width * zoomLevel - stageDimensions.width);
          const maxScrollY = Math.max(0, virtualCanvasDimensions.height * zoomLevel - stageDimensions.height);
          
          return {
            x: Math.max(0, Math.min(maxScrollX, prev.x + deltaX)),
            y: Math.max(0, Math.min(maxScrollY, prev.y + deltaY))
          };
        });
      }
    }
  };

  // Handle zoom in/out
  const handleZoom = (delta, point = null) => {
    // Calculate new zoom level with limits
    const newZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + delta));
    
    if (newZoomLevel !== zoomLevel) {
      // If we have a specific point to zoom around (like mouse position)
      if (point && containerRef.current) {
        // Get container bounds
        const containerRect = containerRef.current.getBoundingClientRect();
        
        // Calculate point relative to container
        const relativeX = point.x - containerRect.left;
        const relativeY = point.y - containerRect.top;
        
        // Calculate point in virtual canvas coordinates
        const virtualX = (relativeX + canvasScroll.x) / zoomLevel;
        const virtualY = (relativeY + canvasScroll.y) / zoomLevel;
        
        // Calculate new scroll position to keep the point under cursor
        const newScrollX = (virtualX * newZoomLevel) - relativeX;
        const newScrollY = (virtualY * newZoomLevel) - relativeY;
        
        // Update scroll with limits
        setCanvasScroll({
          x: Math.max(0, Math.min(virtualCanvasDimensions.width * newZoomLevel - stageDimensions.width, newScrollX)),
          y: Math.max(0, Math.min(virtualCanvasDimensions.height * newZoomLevel - stageDimensions.height, newScrollY))
        });
      }
      
      // Update zoom level
      setZoomLevel(newZoomLevel);
    }
  };

  // Effect to clean up the visual animation interval when component unmounts or simulation mode changes
  useEffect(() => {
    // Clean up function to stop the visual animation
    return () => {
      if (visualAnimationInterval) {
        clearInterval(visualAnimationInterval);
      }
    };
  }, [visualAnimationInterval, simulationMode]);

  // Update dimensions when window is resized
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        setStageDimensions({
          width: containerWidth,
          height: containerHeight
        });
      }
    };

    // Set initial dimensions
    updateDimensions();

    // Add event listener for window resize
    window.addEventListener('resize', updateDimensions);

    // Clean up
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Add event listener for wheel events at the document level
  useEffect(() => {
    const handleWheelEvent = (e) => {
      // Only handle wheel events if they're in the canvas container
      if (containerRef.current && containerRef.current.contains(e.target)) {
        handleScroll(e);
      }
    };
    
    document.addEventListener('wheel', handleWheelEvent, { passive: false });
    
    return () => {
      document.removeEventListener('wheel', handleWheelEvent);
    };
  }, [canvasScroll, virtualCanvasDimensions, stageDimensions, zoomLevel]);

  return (
    <div className="flex flex-col h-screen" ref={appRef} tabIndex="0">
      <div className="sticky top-0 z-10 bg-white">
        <Toolbar 
          mode={mode} 
          setMode={setMode} 
          gridSnappingEnabled={gridSnappingEnabled}
          toggleGridSnapping={toggleGridSnapping}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          elements={elements}
          setElements={setElements}
          updateHistory={updateHistory}
          simulationMode={simulationMode}
          setSimulationMode={setSimulationMode}
          isSimulating={isSimulating}
          startSimulation={startSimulation}
          stopSimulation={stopSimulation}
          clearCanvas={clearCanvas}
          onAutoLayout={handleAutoLayout}
          onOpenSettings={handleOpenSettings}
        />
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        <div 
          className="flex-1 overflow-hidden stage-container"
          ref={containerRef}
          style={{ overflow: 'hidden', position: 'relative' }}
        >
          {/* Zoom controls */}
          <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
            <button 
              className="bg-white p-2 rounded-full shadow-md hover:bg-gray-100 focus:outline-none"
              onClick={() => handleZoom(ZOOM_STEP)}
              title="Zoom In"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
            <button 
              className="bg-white p-2 rounded-full shadow-md hover:bg-gray-100 focus:outline-none"
              onClick={() => handleZoom(-ZOOM_STEP)}
              title="Zoom Out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
              </svg>
            </button>
            <button 
              className="bg-white p-2 rounded-full shadow-md hover:bg-gray-100 focus:outline-none text-xs font-mono"
              onClick={() => setZoomLevel(1.0)}
              title="Reset Zoom"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
          </div>
          <Stage 
            ref={stageRef}
            data-testid="canvas"
            width={stageDimensions.width} 
            height={stageDimensions.height} 
            onClick={handleStageClick}
            onMouseMove={handleMouseMove}
            className="canvas-container"
            scaleX={zoomLevel}
            scaleY={zoomLevel}
          >
            <Layer>
              {/* Background for detecting clicks on empty canvas */}
              <Rect
                x={0}
                y={0}
                width={stageDimensions.width}
                height={stageDimensions.height}
                fill="transparent"
                name="background"
                onClick={() => {
                  // Clear arc creation state if in arc mode
                  if (mode === 'arc' && arcStart) {
                    setArcStart(null);
                    setTempArcEnd(null);
                  }
                  
                  // Clear element selection when clicking on empty canvas
                  if (selectedElement) {
                    setSelectedElement(null);
                  }
                }}
              />
              
              {/* Grid lines */}
              <Grid 
                width={virtualCanvasDimensions.width} 
                height={virtualCanvasDimensions.height} 
                gridSize={gridSize} 
                scrollX={-canvasScroll.x / zoomLevel}
                scrollY={-canvasScroll.y / zoomLevel}
              />
              
              {/* Places - adjust position to account for scroll */}
              {elements.places.map(place => (
                <Place
                  key={place.id}
                  place={{
                    ...place,
                    x: place.x - canvasScroll.x / zoomLevel,
                    y: place.y - canvasScroll.y / zoomLevel
                  }}
                  isSelected={selectedElement && selectedElement.id === place.id || 
                    (arcStart && arcStart.element.id === place.id)}
                  isDragging={draggedElement && draggedElement.element.id === place.id}
                  onClick={() => handleElementClick(place, 'place')}
                  onDragStart={() => handleDragStart(place, 'place')}
                  onDragMove={(e) => {
                    // Get current position
                    const rawPos = { 
                      x: e.target.x() + canvasScroll.x, 
                      y: e.target.y() + canvasScroll.y 
                    };
                    
                    // Calculate snapped position
                    const snappedPos = snapToGrid(rawPos.x, rawPos.y);
                    
                    // Update the visual position of the element being dragged
                    e.target.position({
                      x: snappedPos.x - canvasScroll.x,
                      y: snappedPos.y - canvasScroll.y
                    });
                  }}
                  onDragEnd={(e) => {
                    const newPos = { 
                      x: e.target.x() * zoomLevel + canvasScroll.x, 
                      y: e.target.y() * zoomLevel + canvasScroll.y 
                    };
                    handleDragEnd(place, 'place', newPos);
                  }}
                />
              ))}
              
              {/* Transitions - adjust position to account for scroll */}
              {elements.transitions.map(transition => (
                <Transition
                  key={transition.id}
                  transition={{
                    ...transition,
                    x: transition.x - canvasScroll.x / zoomLevel,
                    y: transition.y - canvasScroll.y / zoomLevel
                  }}
                  isSelected={selectedElement && selectedElement.id === transition.id || 
                    (arcStart && arcStart.element.id === transition.id)}
                  isDragging={draggedElement && draggedElement.element.id === transition.id}
                  isEnabled={enabledTransitionIds.includes(transition.id)}
                  onClick={() => handleElementClick(transition, 'transition')}
                  onDragStart={() => handleDragStart(transition, 'transition')}
                  onDragMove={(e) => {
                    // Get current position
                    const rawPos = { 
                      x: e.target.x() + canvasScroll.x, 
                      y: e.target.y() + canvasScroll.y 
                    };
                    
                    // Calculate snapped position
                    const snappedPos = snapToGrid(rawPos.x, rawPos.y);
                    
                    // Update the visual position of the element being dragged
                    e.target.position({
                      x: snappedPos.x - canvasScroll.x,
                      y: snappedPos.y - canvasScroll.y
                    });
                  }}
                  onDragEnd={(e) => {
                    const newPos = { 
                      x: e.target.x() * zoomLevel + canvasScroll.x, 
                      y: e.target.y() * zoomLevel + canvasScroll.y 
                    };
                    handleDragEnd(transition, 'transition', newPos);
                  }}
                />
              ))}
              
              {/* Arcs - adjust position to account for scroll */}
              {elements.arcs.map(arc => (
                <Arc
                  key={arc.id}
                  arc={arc}
                  places={elements.places.map(place => ({
                    ...place,
                    x: place.x - canvasScroll.x / zoomLevel,
                    y: place.y - canvasScroll.y / zoomLevel
                  }))}
                  transitions={elements.transitions.map(transition => ({
                    ...transition,
                    x: transition.x - canvasScroll.x / zoomLevel,
                    y: transition.y - canvasScroll.y / zoomLevel
                  }))}
                  isSelected={selectedElement && selectedElement.id === arc.id}
                  onClick={() => handleElementClick(arc, 'arc')}
                  canvasScroll={canvasScroll}
                  zoomLevel={zoomLevel}
                  gridSize={gridSize}
                  gridSnappingEnabled={gridSnappingEnabled}
                  onAnglePointAdded={(arcId, anglePoint) => handleAddAnglePoint(arcId, anglePoint)}
                  onAnglePointDragged={(arcId, index, newPosition) => handleDragAnglePoint(arcId, index, newPosition)}
                  onAnglePointDeleted={(arcId, index) => handleDeleteAnglePoint(arcId, index)}
                />
              ))}
              
              {/* Temporary arc during creation */}
              {tempArcEnd && (
                <>
                  {/* Main arc line - dashed for temporary state */}
                  <Line
                    points={[
                      tempArcEnd.sourcePoint.x - canvasScroll.x / zoomLevel,
                      tempArcEnd.sourcePoint.y - canvasScroll.y / zoomLevel,
                      tempArcEnd.x - canvasScroll.x / zoomLevel,
                      tempArcEnd.y - canvasScroll.y / zoomLevel
                    ]}
                    stroke={tempArcEnd.potentialTarget ? "#4CAF50" : "#FF9800"} 
                    strokeWidth={2}
                    dash={[8, 3]}
                    lineCap="round"
                  />
                  
                  {/* Arrow head for temporary arc */}
                  {tempArcEnd.potentialTarget && (
                    <>
                      {/* Arrow head lines */}
                      {(() => {
                        // Calculate angle for arrow head
                        const dx = tempArcEnd.x - tempArcEnd.sourcePoint.x;
                        const dy = tempArcEnd.y - tempArcEnd.sourcePoint.y;
                        const angle = Math.atan2(dy, dx);
                        
                        // Arrow head properties
                        const arrowHeadSize = 12;
                        const arrowAngle1 = angle - Math.PI / 6;
                        const arrowAngle2 = angle + Math.PI / 6;
                        
                        // Calculate arrow head points
                        const endX = tempArcEnd.x - canvasScroll.x / zoomLevel;
                        const endY = tempArcEnd.y - canvasScroll.y / zoomLevel;
                        const point1X = endX - arrowHeadSize * Math.cos(arrowAngle1);
                        const point1Y = endY - arrowHeadSize * Math.sin(arrowAngle1);
                        const point2X = endX - arrowHeadSize * Math.cos(arrowAngle2);
                        const point2Y = endY - arrowHeadSize * Math.sin(arrowAngle2);
                        
                        return (
                          <>
                            <Line
                              points={[endX, endY, point1X, point1Y]}
                              stroke="#4CAF50"
                              strokeWidth={2}
                              dash={[5, 3]}
                            />
                            <Line
                              points={[endX, endY, point2X, point2Y]}
                              stroke="#4CAF50"
                              strokeWidth={2}
                              dash={[5, 3]}
                            />
                          </>
                        );
                      })()} 
                    </>
                  )}
                  
                  {/* Visual cue for source point */}
                  <Circle
                    x={tempArcEnd.sourcePoint.x - canvasScroll.x / zoomLevel}
                    y={tempArcEnd.sourcePoint.y - canvasScroll.y / zoomLevel}
                    radius={4}
                    fill="#FF9800"
                    stroke="white"
                    strokeWidth={1}
                    listening={false} /* Make non-interactive so it doesn't block clicks */
                  />
                  
                  {/* Visual cue for mouse position */}
                  <Circle
                    x={tempArcEnd.x - canvasScroll.x / zoomLevel}
                    y={tempArcEnd.y - canvasScroll.y / zoomLevel}
                    radius={tempArcEnd.potentialTarget ? 6 : 4}
                    fill={tempArcEnd.potentialTarget ? "#4CAF50" : "#FF9800"}
                    stroke="white"
                    strokeWidth={1}
                    opacity={tempArcEnd.potentialTarget ? 1 : 0.7}
                    listening={false} /* Make non-interactive so it doesn't block clicks */
                  />
                </>
              )}
            </Layer>
          </Stage>
          
          {/* Visual scrollbars for canvas navigation */}
          {/* Horizontal scrollbar */}
          <div 
            className="horizontal-scrollbar-container" 
            style={{
              position: 'absolute',
              bottom: '0',
              left: '0',
              right: '12px', // Leave space for vertical scrollbar
              height: '12px',
              background: 'rgba(200,200,200,0.3)',
              borderTop: '1px solid rgba(0,0,0,0.1)',
              zIndex: 20
            }}
          >
            <div 
              className="horizontal-scrollbar-thumb"
              style={{
                position: 'absolute',
                left: (() => {
                  // Calculate the maximum scrollable area, accounting for zoom level
                  const maxScrollX = Math.max(0, virtualCanvasDimensions.width * zoomLevel - stageDimensions.width);
                  // Calculate the percentage of scrolling (0 to 1)
                  const scrollPercentage = maxScrollX > 0 ? canvasScroll.x / maxScrollX : 0;
                  // Calculate the available space for the thumb to move (container width - thumb width)
                  // Thumb width should reflect the visible portion of the virtual canvas
                  const thumbWidth = Math.max(10, (stageDimensions.width / (virtualCanvasDimensions.width * zoomLevel)) * 100);
                  const availableSpace = 100 - thumbWidth;
                  // Return the position as a percentage
                  return `${scrollPercentage * availableSpace}%`;
                })(),
                width: `${Math.max(10, (stageDimensions.width / (virtualCanvasDimensions.width * zoomLevel)) * 100)}%`, // Minimum 10% width for visibility
                height: '100%',
                background: 'rgba(100,100,100,0.5)',
                borderRadius: '4px',
                cursor: 'ew-resize'
              }}
            />
          </div>
          
          {/* Vertical scrollbar */}
          <div 
            className="vertical-scrollbar-container" 
            style={{
              position: 'absolute',
              top: '0',
              right: '0',
              bottom: '12px', // Leave space for horizontal scrollbar
              width: '12px',
              background: 'rgba(200,200,200,0.3)',
              borderLeft: '1px solid rgba(0,0,0,0.1)',
              zIndex: 20
            }}
          >
            <div 
              className="vertical-scrollbar-thumb"
              style={{
                position: 'absolute',
                top: (() => {
                  // Calculate the maximum scrollable area, accounting for zoom level
                  const maxScrollY = Math.max(0, virtualCanvasDimensions.height * zoomLevel - stageDimensions.height);
                  // Calculate the percentage of scrolling (0 to 1)
                  const scrollPercentage = maxScrollY > 0 ? canvasScroll.y / maxScrollY : 0;
                  // Calculate the available space for the thumb to move (container height - thumb height)
                  // Thumb height should reflect the visible portion of the virtual canvas
                  const thumbHeight = Math.max(10, (stageDimensions.height / (virtualCanvasDimensions.height * zoomLevel)) * 100);
                  const availableSpace = 100 - thumbHeight;
                  // Return the position as a percentage
                  return `${scrollPercentage * availableSpace}%`;
                })(),
                height: `${Math.max(10, (stageDimensions.height / (virtualCanvasDimensions.height * zoomLevel)) * 100)}%`, // Minimum 10% height for visibility
                width: '100%',
                background: 'rgba(100,100,100,0.5)',
                borderRadius: '4px',
                cursor: 'ns-resize'
              }}
            />
          </div>
          
          {/* Visual indicators for scroll position */}
          <div 
            className="scroll-indicators" 
            style={{
              position: 'absolute', 
              bottom: '15px', 
              left: '15px', 
              background: 'rgba(0,0,0,0.2)', 
              padding: '5px', 
              borderRadius: '3px',
              color: 'white',
              fontSize: '12px',
              zIndex: 10
            }}
          >
            Canvas: {virtualCanvasDimensions.width}x{virtualCanvasDimensions.height} | 
            Scroll: {Math.round(canvasScroll.x)},{Math.round(canvasScroll.y)}
          </div>
        </div>
        
        <div className="w-64 bg-gray-100 overflow-y-auto flex flex-col">
          <PropertiesPanel 
            selectedElement={selectedElement} 
            elements={elements}
            setElements={setElements}
            updateHistory={updateHistory}
            simulationSettings={simulationSettings}
          />
          <ExecutionPanel 
            elements={elements}
            onUpdateElements={(updatedPetriNet) => {
              // Update the elements state with the new Petri net state
              setElements(prev => {
                // Create a deep copy of the previous arcs to ensure we preserve all properties
                const preservedArcs = prev.arcs.map(arc => ({
                  ...arc,
                  // Ensure we have both sourceId and source (for compatibility)
                  sourceId: arc.sourceId || arc.source,
                  targetId: arc.targetId || arc.target
                }));
                
                // If updatedPetriNet has arcs, merge them with preserved arcs
                const mergedArcs = updatedPetriNet.arcs ? 
                  updatedPetriNet.arcs.map(updatedArc => {
                    // Find the corresponding arc in the preserved arcs
                    const existingArc = preservedArcs.find(arc => arc.id === updatedArc.id);
                    if (existingArc) {
                      // Merge the updated arc with the existing arc to preserve all properties
                      return {
                        ...existingArc,
                        ...updatedArc,
                        // Ensure these critical properties are preserved
                        sourceId: updatedArc.sourceId || updatedArc.source || existingArc.sourceId || existingArc.source,
                        targetId: updatedArc.targetId || updatedArc.target || existingArc.targetId || existingArc.target,
                        sourceType: updatedArc.sourceType || existingArc.sourceType,
                        targetType: updatedArc.targetType || existingArc.targetType,
                        sourceDirection: updatedArc.sourceDirection || existingArc.sourceDirection,
                        targetDirection: updatedArc.targetDirection || existingArc.targetDirection
                      };
                    }
                    return updatedArc;
                  }) : 
                  preservedArcs;
                
                const newState = {
                  ...prev,
                  places: updatedPetriNet.places || prev.places,
                  transitions: updatedPetriNet.transitions || prev.transitions,
                  arcs: mergedArcs
                };
                
                // Add to history after state update
                updateHistory(newState);
                return newState;
              });
            }}
            onEnabledTransitionsChange={updateEnabledTransitions}
            simulationSettings={simulationSettings}
          />
          {/* ImportExportPanel removed as requested */}
        </div>
      </div>
      
      {/* Settings Dialog */}
      <SettingsDialog 
        isOpen={isSettingsDialogOpen}
        onClose={() => setIsSettingsDialogOpen(false)}
        settings={simulationSettings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}

export default App;
