import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Rect, Line, Circle, Text } from 'react-konva';
import { usePetriNet } from '../../contexts/PetriNetContext';
import { useElementManager } from '../elements/useElementManager';

// Assuming these components exist and will be created/moved later
// Placeholder imports - adjust paths as necessary when components are created/moved
import ElementManager from '../elements/ElementManager';
import ArcManager from '../arcs/ArcManager';
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
    stageRef // Ref for the Konva Stage
  } = usePetriNet();

  const { 
    handleCreateElement, 
    handleElementClick, 
    handleElementDragEnd, 
    handleAddAnglePoint, 
  } = useElementManager();

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
    const pos = getVirtualPointerPosition();
    handleCreateElement(pos);
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



  const handleDragStart = (element, type) => {
    setSelectedElement({ ...element, type });
    setDraggedElement({ element: { ...element, type }, type });
    // Konva handles visual dragging, state update is onDragEnd
  };

  const onDragEnd = (elementData, type, newPosition) => {
    handleElementDragEnd(elementData, type, newPosition);
    setDraggedElement(null);
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

        </Layer>
        <ElementManager 
            elements={elements}
            selectedElement={selectedElement}
            handleElementClick={handleElementClick}
            handleElementDragEnd={handleElementDragEnd}
            enabledTransitionIds={enabledTransitionIds}
            zoomLevel={zoomLevel}
            canvasScroll={canvasScroll}
        />
        <ArcManager />
      </Stage>
  );
};

export default CanvasManager;
