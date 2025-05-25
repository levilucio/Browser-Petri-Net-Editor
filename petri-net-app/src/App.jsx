import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Rect } from 'react-konva';
import Toolbar from './components/Toolbar';
import PropertiesPanel from './components/PropertiesPanel';
import ExecutionPanel from './components/ExecutionPanel';
// ImportExportPanel removed as requested
import Place from './components/Place';
import Transition from './components/Transition';
import Arc from './components/Arc';
import Grid from './components/Grid';
import { HistoryManager } from './utils/historyManager';
// Import the simulator functions
import { initializeSimulator, getEnabledTransitions } from './utils/simulator';

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
  const [simulationMode, setSimulationMode] = useState('step'); // step, quick, non-visual
  const [isSimulating, setIsSimulating] = useState(false);
  const [enabledTransitions, setEnabledTransitions] = useState([]);
  const [simulationError, setSimulationError] = useState(null);

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
    width: 2000,  // Initial width of virtual canvas
    height: 1500  // Initial height of virtual canvas
  });
  
  // Scroll position for the canvas
  const [canvasScroll, setCanvasScroll] = useState({
    x: 0,
    y: 0
  });
  
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
  
  // Function to handle the start of dragging an element
  const handleDragStart = (element, elementType) => {
    setDraggedElement({ element, elementType });
  };
  
  // Function to update history after state changes
  const updateHistory = (newState) => {
    const historyStatus = historyManager.addState(newState);
    setCanUndo(historyStatus.canUndo);
    setCanRedo(historyStatus.canRedo);
  };
  
  // Function to start simulation based on the selected mode
  const startSimulation = async () => {
    if (simulationMode === 'step') {
      // Step-by-step mode is handled by the ExecutionPanel
      return;
    }
    
    setIsSimulating(true);
    setSimulationError(null);
    
    try {
      // Initialize the simulator with the current Petri net state
      await initializeSimulator(elements);
      
      // Get the enabled transitions
      const enabled = await getEnabledTransitions();
      setEnabledTransitions(enabled);
      
      // The actual simulation logic is handled by the ExecutionPanel component
    } catch (error) {
      console.error('Error starting simulation:', error);
      setSimulationError(`Error starting simulation: ${error.message}`);
      setIsSimulating(false);
    }
  };
  
  // Function to stop simulation
  const stopSimulation = () => {
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
    setEnabledTransitions([]);
  };

  // Function to handle the end of dragging an element
  const handleDragEnd = (element, elementType, newPosition) => {
    // Snap the final position to grid
    const snappedPos = snapToGrid(newPosition.x, newPosition.y);
    
    // Update the element's position
    if (elementType === 'place') {
      setElements(prev => {
        const newState = {
          ...prev,
          places: prev.places.map(p => 
            p.id === element.id ? { ...p, x: snappedPos.x, y: snappedPos.y } : p
          )
        };
        // Add to history after state update
        updateHistory(newState);
        return newState;
      });
    } else if (elementType === 'transition') {
      setElements(prev => {
        const newState = {
          ...prev,
          transitions: prev.transitions.map(t => 
            t.id === element.id ? { ...t, x: snappedPos.x, y: snappedPos.y } : t
          )
        };
        // Add to history after state update
        updateHistory(newState);
        return newState;
      });
    }
    
    // Clear the dragged element state
    setDraggedElement(null);
  };

  // Function to add a new element to the canvas
  const addElement = (type, x, y) => {
    const snappedPos = snapToGrid(x, y);
    
    if (type === 'place') {
      const newPlace = {
        id: `place-${Date.now()}`,
        x: snappedPos.x,
        y: snappedPos.y,
        name: `P${elements.places.length + 1}`,
        tokens: 0
      };
      setElements(prev => {
        const newState = {
          ...prev,
          places: [...prev.places, newPlace]
        };
        // Add to history after state update
        updateHistory(newState);
        return newState;
      });
    } else if (type === 'transition') {
      const newTransition = {
        id: `transition-${Date.now()}`,
        x: snappedPos.x,
        y: snappedPos.y,
        name: `T${elements.transitions.length + 1}`
      };
      setElements(prev => {
        const newState = {
          ...prev,
          transitions: [...prev.transitions, newTransition]
        };
        // Add to history after state update
        updateHistory(newState);
        return newState;
      });
    }
  };

  // Function to handle stage click
  const handleStageClick = (e) => {
    // Get position relative to the stage
    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    
    // Adjust for scroll position to get the actual position in the virtual canvas
    const x = pointerPosition.x + canvasScroll.x;
    const y = pointerPosition.y + canvasScroll.y;
    
    // Check if we need to expand the canvas
    checkAndExpandCanvas(x, y);
    
    // In Konva, we can check the name of the clicked target
    // If e.target === stage or e.target.name() === undefined, we clicked on the empty canvas
    const clickedOnEmptyCanvas = e.target === stage || e.target.name() === 'background';
    
    if (mode === 'place') {
      addElement('place', x, y);
    } else if (mode === 'transition') {
      addElement('transition', x, y);
    } else if (mode === 'arc' && arcStart) {
      // If we're in arc creation mode and have started an arc,
      // clicking anywhere on the stage cancels the arc creation
      setArcStart(null);
      setTempArcEnd(null);
    }
  };

  // Calculate cardinal points for an element
  const getCardinalPoints = (element, elementType) => {
    const points = {};
    if (elementType === 'place') {
      // For places (circles)
      const radius = 20;
      points.north = { x: element.x, y: element.y - radius };
      points.south = { x: element.x, y: element.y + radius };
      points.east = { x: element.x + radius, y: element.y };
      points.west = { x: element.x - radius, y: element.y };
    } else if (elementType === 'transition') {
      // For transitions (rectangles)
      const width = 30;
      const height = 40;
      points.north = { x: element.x, y: element.y - height/2 };
      points.south = { x: element.x, y: element.y + height/2 };
      points.east = { x: element.x + width/2, y: element.y };
      points.west = { x: element.x - width/2, y: element.y };
    }
    return points;
  };
  
  // Find the nearest cardinal point to a position
  const findNearestCardinalPoint = (element, elementType, position) => {
    const points = getCardinalPoints(element, elementType);
    let nearest = 'north';
    let minDistance = Infinity;
    
    Object.entries(points).forEach(([direction, point]) => {
      const dx = point.x - position.x;
      const dy = point.y - position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearest = direction;
      }
    });
    
    return { direction: nearest, point: points[nearest] };
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
    
    return closestElement ? { element: closestElement, type: validTargetType, point: closestPoint } : null;
  };

  // Function to handle mouse move for arc creation visual feedback
  const handleMouseMove = (e) => {
    if (mode === 'arc' && arcStart) {
      const stage = e.target.getStage();
      const pointerPosition = stage.getPointerPosition();
      
      // Adjust for scroll position
      const adjustedPosition = {
        x: pointerPosition.x + canvasScroll.x,
        y: pointerPosition.y + canvasScroll.y
      };
      
      // Check if we need to expand the canvas
      checkAndExpandCanvas(adjustedPosition.x, adjustedPosition.y);
      
      // Find the nearest cardinal point on the source element
      const sourcePoint = findNearestCardinalPoint(
        arcStart.element, 
        arcStart.elementType, 
        adjustedPosition
      ).point;
      
      // Check if mouse is near a potential target
      const potentialTarget = findPotentialTarget(adjustedPosition.x, adjustedPosition.y);
      
      setTempArcEnd({
        sourcePoint,
        x: potentialTarget ? potentialTarget.point.point.x : adjustedPosition.x,
        y: potentialTarget ? potentialTarget.point.point.y : adjustedPosition.y,
        potentialTarget
      });
    }
  };

  // Function to check if we need to expand the canvas and do so if necessary
  const checkAndExpandCanvas = (x, y) => {
    let needsUpdate = false;
    let newWidth = virtualCanvasDimensions.width;
    let newHeight = virtualCanvasDimensions.height;
    
    // Check right edge
    if (x > virtualCanvasDimensions.width - expansionThreshold) {
      newWidth = virtualCanvasDimensions.width + expansionAmount;
      needsUpdate = true;
    }
    
    // Check bottom edge
    if (y > virtualCanvasDimensions.height - expansionThreshold) {
      newHeight = virtualCanvasDimensions.height + expansionAmount;
      needsUpdate = true;
    }
    
    // Check left edge (expand and adjust scroll position)
    if (x < expansionThreshold && canvasScroll.x > 0) {
      newWidth = virtualCanvasDimensions.width + expansionAmount;
      setCanvasScroll(prev => ({
        ...prev,
        x: Math.max(0, prev.x - expansionAmount)
      }));
      needsUpdate = true;
    }
    
    // Check top edge (expand and adjust scroll position)
    if (y < expansionThreshold && canvasScroll.y > 0) {
      newHeight = virtualCanvasDimensions.height + expansionAmount;
      setCanvasScroll(prev => ({
        ...prev,
        y: Math.max(0, prev.y - expansionAmount)
      }));
      needsUpdate = true;
    }
    
    // Update virtual canvas dimensions if needed
    if (needsUpdate) {
      console.log(`Expanding canvas to ${newWidth}x${newHeight}`);
      setVirtualCanvasDimensions({
        width: newWidth,
        height: newHeight
      });
    }
  };
  
  // Function to handle element click for arc creation
  const handleElementClick = (element, elementType) => {
    if (mode === 'arc') {
      if (!arcStart) {
        // Start creating an arc
        setArcStart({ element, elementType });
        console.log(`Arc creation started from ${elementType} ${element.id}`);
      } else {
        try {
          // Complete the arc if valid connection
          const startType = arcStart.elementType;
          const endType = elementType;
          
          // Validate: arcs can only connect place->transition or transition->place
          if ((startType === 'place' && endType === 'transition') ||
              (startType === 'transition' && endType === 'place')) {
            
            // Simple arc creation with fixed directions based on element types
            // This is more reliable and less prone to errors
            let sourceDirection, targetDirection;
            
            // For place->transition arcs, use east->west
            // For transition->place arcs, use south->north
            if (startType === 'place') {
              sourceDirection = 'east';
              targetDirection = 'west';
            } else {
              sourceDirection = 'south';
              targetDirection = 'north';
            }
            
            const newArc = {
              id: `arc-${Date.now()}`,
              sourceId: arcStart.element.id,
              sourceType: startType,
              targetId: element.id,
              targetType: endType,
              sourceDirection,
              targetDirection,
              weight: 1
            };
            
            setElements(prev => {
              const newState = {
                ...prev,
                arcs: [...prev.arcs, newArc]
              };
              // Add to history after state update
              updateHistory(newState);
              return newState;
            });
            console.log(`Arc created from ${startType} to ${endType}`);
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
  const handleUndo = () => {
    if (!canUndo) return;
    
    const result = historyManager.undo();
    if (result) {
      // Directly set the elements without going through updateHistory
      // to avoid adding the state back to history
      setElements(result.state);
      setCanUndo(result.canUndo);
      setCanRedo(result.canRedo);
    }
  };
  
  // Function to handle redo
  const handleRedo = () => {
    if (!canRedo) return;
    
    const result = historyManager.redo();
    if (result) {
      // Directly set the elements without going through updateHistory
      // to avoid adding the state back to history
      setElements(result.state);
      setCanUndo(result.canUndo);
      setCanRedo(result.canRedo);
    }
  };
  
  // Function to cancel arc creation
  const cancelArcCreation = () => {
    setArcStart(null);
    setTempArcEnd(null);
  };

  // Update mode handler to reset arc creation state
  const handleModeChange = (newMode) => {
    if (mode === 'arc' && newMode !== 'arc') {
      cancelArcCreation();
    }
    setMode(newMode);
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
  
  // Add this effect to expose state for testing
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      // Expose the state and simulator info for testing
      window.__PETRI_NET_STATE__ = {
        ...elements,
        simulator: {
          enabledTransitions: enabledTransitions
        }
      };
      
      // Add a custom event listener for setting tokens
      const handleSetTokens = (event) => {
        const { id, tokens } = event.detail;
        if (id && typeof tokens === 'number') {
          setElements(prev => {
            const updatedPlaces = prev.places.map(place => {
              if (place.id === id) {
                return { ...place, tokens };
              }
              return place;
            });
            return { ...prev, places: updatedPlaces };
          });
          
          // Force the simulator to update enabled transitions
          setTimeout(() => {
            updateEnabledTransitions();
          }, 100);
        }
      };
      
      // Add a custom event listener for firing transitions
      const handleFireTransitionEvent = (event) => {
        const { id } = event.detail;
        if (id) {
          console.log('Custom event: Firing transition', id);
          // Call the simulator's function directly to fire the transition
          if (simulator) {
            simulator.fireTransition(id)
              .then(updatedPetriNet => {
                console.log('Transition fired via custom event, updating state');
                onUpdateElements(updatedPetriNet);
              })
              .catch(error => {
                console.error('Error firing transition via custom event:', error);
              });
          }
        }
      };
      
      document.addEventListener('set-tokens', handleSetTokens);
      document.addEventListener('fire-transition', handleFireTransitionEvent);
      
      // Clean up the event listeners
      return () => {
        document.removeEventListener('set-tokens', handleSetTokens);
        document.removeEventListener('fire-transition', handleFireTransitionEvent);
      };
    }
  }, [elements, enabledTransitions]);
  
  // Handle scroll events to navigate the virtual canvas
  const handleScroll = (e) => {
    // Only prevent default if we're handling the scroll
    if (containerRef.current && containerRef.current.contains(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      
      const deltaX = e.deltaX;
      const deltaY = e.deltaY;
      
      // Update scroll position with limits
      setCanvasScroll(prev => ({
        x: Math.max(0, Math.min(virtualCanvasDimensions.width - stageDimensions.width, prev.x + deltaX)),
        y: Math.max(0, Math.min(virtualCanvasDimensions.height - stageDimensions.height, prev.y + deltaY))
      }));
    }
  };

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
  }, [canvasScroll, virtualCanvasDimensions, stageDimensions]);

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
        />
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        <div 
          className="flex-1 overflow-hidden stage-container"
          ref={containerRef}
          style={{ overflow: 'hidden', position: 'relative' }}
        >
          <Stage 
            ref={stageRef}
            data-testid="canvas"
            width={stageDimensions.width} 
            height={stageDimensions.height} 
            onClick={handleStageClick}
            onMouseMove={handleMouseMove}
            className="canvas-container"
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
                  if (mode === 'arc' && arcStart) {
                    setArcStart(null);
                    setTempArcEnd(null);
                  }
                }}
              />
              
              {/* Grid lines */}
              <Grid 
                width={virtualCanvasDimensions.width} 
                height={virtualCanvasDimensions.height} 
                gridSize={gridSize} 
                scrollX={-canvasScroll.x}
                scrollY={-canvasScroll.y}
              />
              
              {/* Places - adjust position to account for scroll */}
              {elements.places.map(place => (
                <Place
                  key={place.id}
                  place={{
                    ...place,
                    x: place.x - canvasScroll.x,
                    y: place.y - canvasScroll.y
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
                      x: e.target.x() + canvasScroll.x, 
                      y: e.target.y() + canvasScroll.y 
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
                    x: transition.x - canvasScroll.x,
                    y: transition.y - canvasScroll.y
                  }}
                  isSelected={selectedElement && selectedElement.id === transition.id || 
                    (arcStart && arcStart.element.id === transition.id)}
                  isDragging={draggedElement && draggedElement.element.id === transition.id}
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
                      x: e.target.x() + canvasScroll.x, 
                      y: e.target.y() + canvasScroll.y 
                    };
                    handleDragEnd(transition, 'transition', newPos);
                  }}
                />
              ))}
              
              {/* Arcs - the Arc component will handle scroll offset internally */}
              {elements.arcs.map(arc => (
                <Arc
                  key={arc.id}
                  arc={arc}
                  places={elements.places}
                  transitions={elements.transitions}
                  isSelected={selectedElement && selectedElement.id === arc.id}
                  onClick={() => setSelectedElement(arc)}
                  canvasScroll={canvasScroll}
                />
              ))}
              
              {/* Temporary arc during creation */}
              {arcStart && tempArcEnd && (
                <>
                  <Line
                    points={[
                      tempArcEnd.sourcePoint.x - canvasScroll.x,
                      tempArcEnd.sourcePoint.y - canvasScroll.y,
                      tempArcEnd.x - canvasScroll.x,
                      tempArcEnd.y - canvasScroll.y
                    ]}
                    stroke="#FF9800" /* Orange color for transient nature */
                    strokeWidth={2}
                    dash={[5, 5]}
                  />
                  {/* Visual cue for source point */}
                  <Circle
                    x={tempArcEnd.sourcePoint.x - canvasScroll.x}
                    y={tempArcEnd.sourcePoint.y - canvasScroll.y}
                    radius={4}
                    fill="#FF9800"
                    stroke="white"
                    strokeWidth={1}
                  />
                  {/* Visual cue for target point if hovering near a valid target */}
                  {tempArcEnd.potentialTarget && (
                    <Circle
                      x={tempArcEnd.potentialTarget.point.point.x - canvasScroll.x}
                      y={tempArcEnd.potentialTarget.point.point.y - canvasScroll.y}
                      radius={4}
                      fill="#FF9800"
                      stroke="white"
                      strokeWidth={1}
                    />
                  )}
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
                  // Calculate the maximum scrollable area
                  const maxScrollX = Math.max(0, virtualCanvasDimensions.width - stageDimensions.width);
                  // Calculate the percentage of scrolling (0 to 1)
                  const scrollPercentage = maxScrollX > 0 ? canvasScroll.x / maxScrollX : 0;
                  // Calculate the available space for the thumb to move (container width - thumb width)
                  const thumbWidth = Math.max(10, (stageDimensions.width / virtualCanvasDimensions.width) * 100);
                  const availableSpace = 100 - thumbWidth;
                  // Return the position as a percentage
                  return `${scrollPercentage * availableSpace}%`;
                })(),
                width: `${Math.max(10, (stageDimensions.width / virtualCanvasDimensions.width) * 100)}%`, // Minimum 10% width for visibility
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
                  // Calculate the maximum scrollable area
                  const maxScrollY = Math.max(0, virtualCanvasDimensions.height - stageDimensions.height);
                  // Calculate the percentage of scrolling (0 to 1)
                  const scrollPercentage = maxScrollY > 0 ? canvasScroll.y / maxScrollY : 0;
                  // Calculate the available space for the thumb to move (container height - thumb height)
                  const thumbHeight = Math.max(10, (stageDimensions.height / virtualCanvasDimensions.height) * 100);
                  const availableSpace = 100 - thumbHeight;
                  // Return the position as a percentage
                  return `${scrollPercentage * availableSpace}%`;
                })(),
                height: `${Math.max(10, (stageDimensions.height / virtualCanvasDimensions.height) * 100)}%`, // Minimum 10% height for visibility
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
                
                // Log the arcs for debugging
                console.log('Previous arcs:', prev.arcs);
                console.log('Updated arcs:', mergedArcs);
                
                // Add to history after state update
                updateHistory(newState);
                return newState;
              });
            }}
          />
          {/* ImportExportPanel removed as requested */}
        </div>
      </div>
    </div>
  );
}

export default App;
