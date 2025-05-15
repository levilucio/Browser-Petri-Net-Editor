import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Circle, Rect } from 'react-konva';
import Toolbar from './components/Toolbar';
import PropertiesPanel from './components/PropertiesPanel';
import ExecutionPanel from './components/ExecutionPanel';
import Place from './components/Place';
import Transition from './components/Transition';
import Arc from './components/Arc';
import Grid from './components/Grid';
import { HistoryManager } from './utils/historyManager';

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

  // Use state for stage dimensions to allow for resizing
  const [stageDimensions, setStageDimensions] = useState({
    width: 800,
    height: 600
  });
  const gridSize = 20;
  
  // Reference to the container div
  const containerRef = useRef(null);

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
    const x = pointerPosition.x;
    const y = pointerPosition.y;
    
    // In Konva, we can check the name of the clicked target
    // The Layer and Stage don't have names, so if e.target.name() is undefined,
    // we clicked on the empty canvas
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
      
      // Find the nearest cardinal point on the source element
      const sourcePoint = findNearestCardinalPoint(
        arcStart.element, 
        arcStart.elementType, 
        pointerPosition
      ).point;
      
      // Check if mouse is near a potential target
      const potentialTarget = findPotentialTarget(pointerPosition.x, pointerPosition.y);
      
      setTempArcEnd({
        sourcePoint,
        x: potentialTarget ? potentialTarget.point.point.x : pointerPosition.x,
        y: potentialTarget ? potentialTarget.point.point.y : pointerPosition.y,
        potentialTarget
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
        // Complete the arc if valid connection
        const startType = arcStart.elementType;
        const endType = elementType;
        
        // Validate: arcs can only connect place->transition or transition->place
        if ((startType === 'place' && endType === 'transition') ||
            (startType === 'transition' && endType === 'place')) {
          
          // Use the current tempArcEnd data if it exists and has a potential target
          // that matches the clicked element
          let sourceDirection, targetDirection;
          
          if (tempArcEnd && tempArcEnd.potentialTarget && 
              tempArcEnd.potentialTarget.element.id === element.id) {
            // Use the snapped points from the visual feedback
            sourceDirection = findNearestCardinalPoint(
              arcStart.element,
              startType,
              tempArcEnd.potentialTarget.point.point
            ).direction;
            
            targetDirection = tempArcEnd.potentialTarget.point.direction;
          } else {
            // Calculate the best points if no visual feedback is available
            const sourcePoint = findNearestCardinalPoint(
              arcStart.element, 
              startType, 
              { x: element.x, y: element.y }
            );
            
            const targetPoint = findNearestCardinalPoint(
              element, 
              endType, 
              { x: arcStart.element.x, y: arcStart.element.y }
            );
            
            sourceDirection = sourcePoint.direction;
            targetDirection = targetPoint.direction;
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
        
        // Reset arc start and temp end
        setArcStart(null);
        setTempArcEnd(null);
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
    // Delete key (both regular Delete and Backspace)
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement) {
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
  
  // Effect to set initial stage dimensions and handle window resize
  React.useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setStageDimensions({
          width: clientWidth,
          height: clientHeight
        });
      }
    };
    
    // Set initial dimensions
    updateDimensions();
    
    // Add resize listener
    window.addEventListener('resize', updateDimensions);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Add this effect to expose state for testing
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      window.__PETRI_NET_STATE__ = elements;
    }
  }, [elements]);

  return (
    <div className="flex flex-col h-screen" ref={appRef}>
      <Toolbar 
        mode={mode} 
        setMode={handleModeChange} 
        gridSnappingEnabled={gridSnappingEnabled}
        toggleGridSnapping={toggleGridSnapping}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden" ref={containerRef}>
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
              <Grid width={stageDimensions.width} height={stageDimensions.height} gridSize={gridSize} />
              
              {/* Places */}
              {elements.places.map(place => (
                <Place
                  key={place.id}
                  place={place}
                  isSelected={selectedElement && selectedElement.id === place.id || 
                    (arcStart && arcStart.element.id === place.id)}
                  isDragging={draggedElement && draggedElement.element.id === place.id}
                  onClick={() => handleElementClick(place, 'place')}
                  onDragStart={() => handleDragStart(place, 'place')}
                  onDragMove={(e) => {
                    // Get current position
                    const rawPos = { x: e.target.x(), y: e.target.y() };
                    
                    // Calculate snapped position
                    const snappedPos = snapToGrid(rawPos.x, rawPos.y);
                    
                    // Update the visual position of the element being dragged
                    e.target.position({
                      x: snappedPos.x,
                      y: snappedPos.y
                    });
                  }}
                  onDragEnd={(e) => {
                    const newPos = { x: e.target.x(), y: e.target.y() };
                    handleDragEnd(place, 'place', newPos);
                  }}
                />
              ))}
              
              {/* Transitions */}
              {elements.transitions.map(transition => (
                <Transition
                  key={transition.id}
                  transition={transition}
                  isSelected={selectedElement && selectedElement.id === transition.id || 
                    (arcStart && arcStart.element.id === transition.id)}
                  isDragging={draggedElement && draggedElement.element.id === transition.id}
                  onClick={() => handleElementClick(transition, 'transition')}
                  onDragStart={() => handleDragStart(transition, 'transition')}
                  onDragMove={(e) => {
                    // Get current position
                    const rawPos = { x: e.target.x(), y: e.target.y() };
                    
                    // Calculate snapped position
                    const snappedPos = snapToGrid(rawPos.x, rawPos.y);
                    
                    // Update the visual position of the element being dragged
                    e.target.position({
                      x: snappedPos.x,
                      y: snappedPos.y
                    });
                  }}
                  onDragEnd={(e) => {
                    const newPos = { x: e.target.x(), y: e.target.y() };
                    handleDragEnd(transition, 'transition', newPos);
                  }}
                />
              ))}
              
              {/* Arcs */}
              {elements.arcs.map(arc => (
                <Arc
                  key={arc.id}
                  arc={arc}
                  places={elements.places}
                  transitions={elements.transitions}
                  isSelected={selectedElement && selectedElement.id === arc.id}
                  onClick={() => setSelectedElement(arc)}
                />
              ))}
              
              {/* Temporary arc during creation */}
              {arcStart && tempArcEnd && (
                <>
                  <Line
                    points={[
                      tempArcEnd.sourcePoint.x,
                      tempArcEnd.sourcePoint.y,
                      tempArcEnd.x,
                      tempArcEnd.y
                    ]}
                    stroke="#FF9800" /* Orange color for transient nature */
                    strokeWidth={2}
                    dash={[5, 5]}
                  />
                  {/* Visual cue for source point */}
                  <Circle
                    x={tempArcEnd.sourcePoint.x}
                    y={tempArcEnd.sourcePoint.y}
                    radius={4}
                    fill="#FF9800"
                    stroke="white"
                    strokeWidth={1}
                  />
                  {/* Visual cue for target point if hovering near a valid target */}
                  {tempArcEnd.potentialTarget && (
                    <Circle
                      x={tempArcEnd.potentialTarget.point.point.x}
                      y={tempArcEnd.potentialTarget.point.point.y}
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
        </div>
        
        <PropertiesPanel 
          selectedElement={selectedElement} 
          setElements={setElements} 
        />
      </div>
      
      <ExecutionPanel elements={elements} />
    </div>
  );
}

export default App;
