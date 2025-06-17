import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Line, Circle, Text } from 'react-konva';
import { usePetriNet } from '../../contexts/PetriNetContext';
import { v4 as uuidv4 } from 'uuid';

// Assuming these components exist and will be created/moved later
// Placeholder imports - adjust paths as necessary when components are created/moved
import Place from '../../components/Place'; 
import Transition from '../../components/Transition';
import Arc from '../../components/Arc';
import Grid from '../../components/Grid'; 



// Constants for canvas expansion (can be moved to context if shared)
// const expansionThreshold = 100; // px from edge to trigger expansion
// const expansionAmount = 500;    // px to expand in each direction

const CanvasManager = ({ handleZoom, ZOOM_STEP }) => {
  const {
    stageDimensions, setStageDimensions,
    virtualCanvasDimensions, // For background size reference
    canvasScroll, setCanvasScroll, // For positioning elements relative to scroll
    zoomLevel, setZoomLevel,
    mode, setMode,
    arcStart, setArcStart,
    tempArcEnd, setTempArcEnd,
    selectedElement, setSelectedElement,
    elements, setElements,
    enabledTransitionIds,
    snapToGrid, gridSize, gridSnappingEnabled, // Added gridSnappingEnabled
    containerRef, // Ref for the stage container div
    stageRef, // Ref for the Konva Stage
    updateHistory // For operations that modify elements directly
  } = usePetriNet();

  const [draggedElement, setDraggedElement] = useState(null);

  // Effect to set stage dimensions based on its container
  useEffect(() => {
    // containerRef from context is now the DOM node itself (or null).
    // Directly check if it exists before using its properties.
    if (containerRef) {
      const rect = containerRef.getBoundingClientRect();
      const newWidth = rect.width;
      const newHeight = rect.height;
      if (newWidth > 0 && newHeight > 0 && (newWidth !== stageDimensions.width || newHeight !== stageDimensions.height)) {
        setStageDimensions({ width: newWidth, height: newHeight });
      }
    }
    // Consider ResizeObserver for more dynamic updates if needed
  }, [containerRef, stageDimensions, setStageDimensions]); // stageDimensions object as dependency



  const getVirtualPointerPosition = () => {
    const stage = stageRef.current;
    if (!stage) return null;

    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return null;

    const x = (pointerPosition.x / zoomLevel) + canvasScroll.x;
    const y = (pointerPosition.y / zoomLevel) + canvasScroll.y;
    return { x, y };
  };

  const handleStageClick = (e) => {
    if (e.target !== stageRef.current && e.target.name() !== 'background') {
      return;
    }

    let pos = getVirtualPointerPosition();
    if (!pos) return;

    if (gridSnappingEnabled) {
      pos = snapToGrid(pos.x, pos.y);
    }

    if (mode === 'place') {
      const newPlace = { id: uuidv4(), x: pos.x, y: pos.y, label: `P${elements.places.length + 1}`, tokens: 0 };
      setElements(prev => ({ ...prev, places: [...prev.places, newPlace] }));
    } else if (mode === 'transition') {
      const newTransition = { id: uuidv4(), x: pos.x, y: pos.y, label: `T${elements.transitions.length + 1}` };
      setElements(prev => ({ ...prev, transitions: [...prev.transitions, newTransition] }));
    }
  };

  const handleMouseMove = (e) => {
    if (mode === 'arc' && arcStart) {
      const pos = getVirtualPointerPosition();
      if (pos) {
         // Check if hovering over a potential target
        let potentialTarget = null;
        const stage = stageRef.current;
        if (stage) {
            const pointerPos = stage.getPointerPosition(); // stage coords
            const shape = stage.getIntersection(pointerPos);
            if (shape && (shape.attrs.elementType === 'place' || shape.attrs.elementType === 'transition')) {
                if (shape.attrs.id !== arcStart.element.id) { // Cannot connect to itself
                    potentialTarget = { id: shape.attrs.id, type: shape.attrs.elementType };
                }
            }
        }
        setTempArcEnd({ 
            sourcePoint: arcStart.point, // The actual starting point on virtual canvas
            x: pos.x, // Mouse position on virtual canvas
            y: pos.y, 
            potentialTarget 
        });
      }
    }
    // Add other mouse move logic like canvas expansion on drag if needed
  };

  const handleElementClick = (element, type) => {
    if (mode === 'select' || mode === 'arc_angle') {
      setSelectedElement({ ...element, type });
      setArcStart(null); // Clear any pending arc
      setTempArcEnd(null);
    } else if (mode === 'arc') {
      if (!arcStart) {
        // Starting an arc
        setSelectedElement({ ...element, type }); // Highlight source
        // Determine connection point based on element type and shape
        // For simplicity, using center for now. Could be edge points later.
        setArcStart({ element: {id: element.id, type}, point: { x: element.x, y: element.y } });
        setTempArcEnd({ sourcePoint: { x: element.x, y: element.y }, x: element.x, y: element.y, potentialTarget: null });
      } else {
        // Completing an arc
        if (arcStart.element.id === element.id) return; // Cannot connect to self

        // Validate arc (e.g., place to transition or transition to place)
        const sourceType = arcStart.element.type;
        const targetType = type;
        if (sourceType === targetType) {
          console.warn("Invalid arc: Cannot connect elements of the same type.");
          setArcStart(null);
          setTempArcEnd(null);
          setSelectedElement(null);
          return;
        }

        const newArc = {
          id: uuidv4(),
          source: arcStart.element.id,
          target: element.id,
          weight: 1,
          anglePoints: [], // Initialize with no angle points
          sourceType: arcStart.element.type,
          targetType: type,
        };
        setElements(prev => ({ ...prev, arcs: [...prev.arcs, newArc] }));
        setArcStart(null);
        setTempArcEnd(null);
        setSelectedElement(null); 
        // setMode('select'); // Optionally switch back to select mode
      }
    }
  };

  const handleDragStart = (element, type) => {
    setSelectedElement({ ...element, type });
    setDraggedElement({ element: { ...element, type }, type });
    // Konva handles visual dragging, state update is onDragEnd
  };

  const handleDragEnd = (elementData, type, newPosition) => {
    setElements(prev => {
      const updatedElements = { ...prev };
      let found = false;
      if (type === 'place') {
        updatedElements.places = prev.places.map(p => {
          if (p.id === elementData.id) {
            found = true;
            return { ...p, x: newPosition.x, y: newPosition.y };
          }
          return p;
        });
      } else if (type === 'transition') {
        updatedElements.transitions = prev.transitions.map(t => {
          if (t.id === elementData.id) {
            found = true;
            return { ...t, x: newPosition.x, y: newPosition.y };
          }
          return t;
        });
      }
      // Add to history if an element was actually moved
      if (found) {
        updateHistory(updatedElements); // Manually trigger history if setElements doesn't capture this specific change pattern for history
      }
      return found ? updatedElements : prev;
    });
    setDraggedElement(null);
  };
  
  const handleAddAnglePoint = (arcId, anglePoint) => {
    setElements(prev => {
      const updatedArcs = prev.arcs.map(arc => {
        if (arc.id === arcId) {
          const point = gridSnappingEnabled ? snapToGrid(anglePoint.x, anglePoint.y) : anglePoint;
          const anglePoints = arc.anglePoints ? [...arc.anglePoints] : [];
          anglePoints.push(point);
          return { ...arc, anglePoints };
        }
        return arc;
      });
      return { ...prev, arcs: updatedArcs };
    });
  };
  
  const handleDragAnglePoint = (arcId, pointIndex, newPosition) => {
    setElements(prev => {
      const updatedArcs = prev.arcs.map(arc => {
        if (arc.id === arcId && arc.anglePoints && arc.anglePoints[pointIndex]) {
          const position = gridSnappingEnabled ? snapToGrid(newPosition.x, newPosition.y) : newPosition;
          const anglePoints = [...arc.anglePoints];
          anglePoints[pointIndex] = position;
          return { ...arc, anglePoints };
        }
        return arc;
      });
      return { ...prev, arcs: updatedArcs };
    });
  };
  
  const handleWheelEvent = React.useCallback((e) => {
    // This function will be called by the document event listener
    // It already checks if containerRef.current.contains(e.target)
    e.preventDefault();
    e.stopPropagation();

    if (e.ctrlKey) {
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP; // Use ZOOM_STEP prop
      handleZoom(delta); // Call prop handleZoom, which handles zoom-to-center
    } else {
      const deltaX = e.deltaX;
      const deltaY = e.deltaY;

      setCanvasScroll(prev => {
        if (!virtualCanvasDimensions || !stageDimensions) return prev; // Guard against undefined dimensions
        const maxScrollX = Math.max(0, virtualCanvasDimensions.width * zoomLevel - stageDimensions.width);
        const maxScrollY = Math.max(0, virtualCanvasDimensions.height * zoomLevel - stageDimensions.height);
        
        return {
          x: Math.max(0, Math.min(maxScrollX, prev.x + deltaX)),
          y: Math.max(0, Math.min(maxScrollY, prev.y + deltaY))
        };
      });
    }
  }, [ZOOM_STEP, handleZoom, setCanvasScroll, zoomLevel, virtualCanvasDimensions, stageDimensions]);

  // Effect to add wheel event listener for zoom and scroll
  useEffect(() => {
    const wheelListener = (e) => {
      // Check if the event target is within the containerRef element
      // This ensures we only handle wheel events originating from the canvas area.
      if (containerRef && containerRef.contains(e.target)) {
        handleWheelEvent(e);
      }
    };

    // Add event listener to the document to capture wheel events globally,
    // then filter them by target in wheelListener.
    // This is more robust if the direct target of the wheel event isn't always the container itself
    // but one of its children (like the Konva stage).
    document.addEventListener('wheel', wheelListener, { passive: false });

    return () => {
      document.removeEventListener('wheel', wheelListener);
    };
  }, [containerRef, handleWheelEvent]); // Updated dependencies

  const handleDeleteAnglePoint = (arcId, pointIndex) => {
    setElements(prev => {
      const updatedArcs = prev.arcs.map(arc => {
        if (arc.id === arcId && arc.anglePoints && arc.anglePoints[pointIndex]) {
          const anglePoints = [...arc.anglePoints];
          anglePoints.splice(pointIndex, 1);
          return { ...arc, anglePoints };
        }
        return arc;
      });
      return { ...prev, arcs: updatedArcs };
    });
  };

  return (
      <Stage
        ref={stageRef}
        width={virtualCanvasDimensions.width}
        height={virtualCanvasDimensions.height}
        onClick={handleStageClick} // For creating elements on background
        onMouseMove={handleMouseMove}
        className="canvas-stage" // Added a class for potential styling
        scaleX={zoomLevel}
        scaleY={zoomLevel}
        // offsetX and offsetY are tricky with manual scroll. Elements are positioned relative to scroll.
      >
        <Layer>
          {/* Background Rect - for stage clicks and visual virtual area */}
          <Rect
            x={-canvasScroll.x / zoomLevel} // Position background relative to viewport scroll
            y={-canvasScroll.y / zoomLevel}
            width={virtualCanvasDimensions.width} // Full virtual size
            height={virtualCanvasDimensions.height}
            fill="#FFFFFF" // Explicit white background
            name="background"
            onClick={(e) => {
              // This onClick on the Rect is for when the click *is* on the background
              // handleStageClick is for clicks that might bubble up to the Stage
              if (mode === 'arc' && arcStart) {
                setArcStart(null);
                setTempArcEnd(null);
              }
              setSelectedElement(null);
            }}
          />
          
          <Grid 
            width={virtualCanvasDimensions.width} 
            height={virtualCanvasDimensions.height} 
            gridSize={gridSize} 
            scrollX={-canvasScroll.x / zoomLevel} // Grid position adjusted for scroll
            scrollY={-canvasScroll.y / zoomLevel}
            zoomLevel={zoomLevel} // Pass zoomLevel if grid lines need to adjust thickness or visibility
          />

          {/* Places - adjust position to account for scroll and zoom */}
          {elements.places.map(place => (
            <Place
              key={place.id}
              placeData={{
                ...place,
                x: (place.x - canvasScroll.x) / zoomLevel,
                y: (place.y - canvasScroll.y) / zoomLevel
              }}
              isSelected={selectedElement && selectedElement.id === place.id || 
                (arcStart && arcStart.element.id === place.id)}
              isDragging={draggedElement && draggedElement.element.id === place.id}
              onClick={() => handleElementClick(place, 'place')}
              onDragStart={() => handleDragStart(place, 'place')}
              onDragMove={(e) => {
                const stage = e.target.getStage();
                const pointerPosition = stage.getPointerPosition();
                const virtualPos = {
                    x: (pointerPosition.x / zoomLevel) + canvasScroll.x,
                    y: (pointerPosition.y / zoomLevel) + canvasScroll.y
                };
                const snappedPos = gridSnappingEnabled ? snapToGrid(virtualPos.x, virtualPos.y) : virtualPos;
                e.target.position({
                  x: (snappedPos.x - canvasScroll.x) / zoomLevel,
                  y: (snappedPos.y - canvasScroll.y) / zoomLevel
                });
              }}
              onDragEnd={(e) => {
                const finalVirtualPos = {
                    x: (e.target.x() * zoomLevel) + canvasScroll.x,
                    y: (e.target.y() * zoomLevel) + canvasScroll.y
                };
                const snappedFinalPos = gridSnappingEnabled ? snapToGrid(finalVirtualPos.x, finalVirtualPos.y) : finalVirtualPos;
                handleDragEnd(place, 'place', snappedFinalPos);
              }}
            />
          ))}
          
          {/* Transitions - adjust position to account for scroll and zoom */}
          {elements.transitions.map(transition => (
            <Transition
              key={transition.id}
              transitionData={{
                ...transition,
                x: (transition.x - canvasScroll.x) / zoomLevel,
                y: (transition.y - canvasScroll.y) / zoomLevel
              }}
              isSelected={selectedElement && selectedElement.id === transition.id || 
                (arcStart && arcStart.element.id === transition.id)}
              isDragging={draggedElement && draggedElement.element.id === transition.id}
              isEnabled={enabledTransitionIds.includes(transition.id)}
              onClick={() => handleElementClick(transition, 'transition')}
              onDragStart={() => handleDragStart(transition, 'transition')}
              onDragMove={(e) => {
                const stage = e.target.getStage();
                const pointerPosition = stage.getPointerPosition();
                const virtualPos = {
                    x: (pointerPosition.x / zoomLevel) + canvasScroll.x,
                    y: (pointerPosition.y / zoomLevel) + canvasScroll.y
                };
                const snappedPos = gridSnappingEnabled ? snapToGrid(virtualPos.x, virtualPos.y) : virtualPos;
                e.target.position({
                  x: (snappedPos.x - canvasScroll.x) / zoomLevel,
                  y: (snappedPos.y - canvasScroll.y) / zoomLevel
                });
              }}
              onDragEnd={(e) => {
                const finalVirtualPos = {
                    x: (e.target.x() * zoomLevel) + canvasScroll.x,
                    y: (e.target.y() * zoomLevel) + canvasScroll.y
                };
                const snappedFinalPos = gridSnappingEnabled ? snapToGrid(finalVirtualPos.x, finalVirtualPos.y) : finalVirtualPos;
                handleDragEnd(transition, 'transition', snappedFinalPos);
              }}
            />
          ))}
          
          {/* Arcs - Pass scroll and zoom for its internal calculations */}
          {elements.arcs.map(arc => (
            <Arc
              key={arc.id}
              arcData={arc}
              places={elements.places}
              transitions={elements.transitions}
              isSelected={selectedElement && selectedElement.id === arc.id}
              onClick={() => handleElementClick(arc, 'arc')}
              canvasScroll={canvasScroll}
              zoomLevel={zoomLevel}
              gridSize={gridSize}
              gridSnappingEnabled={gridSnappingEnabled}
              onAddAnglePoint={(point) => handleAddAnglePoint(arc.id, point)}
              onDragAnglePoint={(index, newPos) => handleDragAnglePoint(arc.id, index, newPos)}
              onDeleteAnglePoint={(index) => handleDeleteAnglePoint(arc.id, index)}
              mode={mode} // Pass mode to Arc for conditional rendering of angle points
            />
          ))}

          {/* Temporary Arc for visualization */}
          {tempArcEnd && tempArcEnd.sourcePoint && (
            <Line
              points={[
                (tempArcEnd.sourcePoint.x - canvasScroll.x) / zoomLevel,
                (tempArcEnd.sourcePoint.y - canvasScroll.y) / zoomLevel,
                (tempArcEnd.x - canvasScroll.x) / zoomLevel,
                (tempArcEnd.y - canvasScroll.y) / zoomLevel,
              ]}
              stroke="grey"
              strokeWidth={2 / zoomLevel} // Adjusted for zoom
              dash={[5 / zoomLevel, 5 / zoomLevel]} // Adjusted for zoom
              listening={false} // Not interactive
            />
          )}
        </Layer>
      </Stage>
  );
};

export default CanvasManager;
