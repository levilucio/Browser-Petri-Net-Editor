import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import { usePetriNet } from '../../contexts/PetriNetContext';
import { useElementManager } from '../elements/useElementManager';
import ElementManager from '../elements/ElementManager';
import ArcManager from '../arcs/ArcManager';
import Grid from '../../components/Grid';
import CustomScrollbar from '../../components/CustomScrollbar';
import SnapIndicator from '../../components/SnapIndicator';

const CanvasManager = ({ handleZoom, ZOOM_STEP }) => {
  const {
    stageDimensions, setStageDimensions,
    virtualCanvasDimensions,
    canvasScroll, setCanvasScroll,
    zoomLevel,
    mode, setMode,
    arcStart, setArcStart,
    tempArcEnd, setTempArcEnd,
    selectedElement, setSelectedElement,
    elements,
    enabledTransitionIds,
    setContainerRef,
    stageRef,
    gridSize,
    gridSnappingEnabled,
    snapToGrid,
    snapIndicator, setSnapIndicator,
    selectedElements, setSelection,
  } = usePetriNet();

  const { 
    handleCreateElement, 
    handleElementClick, 
    handleElementDragEnd, 
  } = useElementManager();

  const localContainerRef = useRef(null);
  const selectingRef = useRef({ isSelecting: false, start: null });
  const [selectionRect, setSelectionRect] = useState(null); // {x,y,w,h}

  useEffect(() => {
    const container = localContainerRef.current;
    if (!container) {
      return;
    }

    setContainerRef(container);

    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        // Check to prevent setting dimensions to 0, which can happen briefly
        if (width > 0 && height > 0) {
            setStageDimensions({ width, height });
        }
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [setStageDimensions, setContainerRef]);

  const getVirtualPointerPosition = () => {
    const stage = stageRef.current;
    if (!stage) return null;

    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return null;

    // Transform stage coordinates to virtual coordinates
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    const { x, y } = transform.point(pointerPosition);
    return { x, y };
  };

  const handleStageClick = (e) => {
    if (e.target.name() !== 'background') {
      return;
    }
    const pos = getVirtualPointerPosition();
    handleCreateElement(pos);
  };

  const handleMouseMove = () => {
    const pos = getVirtualPointerPosition();
    if (!pos) return;
    
    // Handle arc drawing
    if (mode === 'arc' && arcStart) {
      let potentialTarget = null;
      const stage = stageRef.current;
      if (stage) {
          const pointerPos = stage.getPointerPosition();
          const shape = stage.getIntersection(pointerPos);
          if (shape && (shape.attrs.elementType === 'place' || shape.attrs.elementType === 'transition')) {
              if (shape.attrs.id !== arcStart.element.id) {
                  potentialTarget = { id: shape.attrs.id, type: shape.attrs.elementType };
              }
          }
      }
      setTempArcEnd({ 
          sourcePoint: arcStart.point,
          x: pos.x,
          y: pos.y, 
          potentialTarget 
      });
    }
    
    // Update selection rectangle during drag in select mode
    if (mode === 'select' && selectingRef.current.isSelecting && selectingRef.current.start) {
      const start = selectingRef.current.start;
      setSelectionRect({ x: start.x, y: start.y, w: pos.x - start.x, h: pos.y - start.y });
    }

    // Show snap indicator when grid snapping is enabled and in place/transition mode
    if (gridSnappingEnabled && (mode === 'place' || mode === 'transition')) {
      const snappedPos = snapToGrid(pos.x, pos.y);
      setSnapIndicator({
        visible: true,
        position: snappedPos,
        elementType: mode
      });
    } else {
      // Hide indicator if not in place/transition mode or grid snapping disabled
      if (snapIndicator.visible) {
        setSnapIndicator({
          visible: false,
          position: null,
          elementType: null
        });
      }
    }
  };

  const handleWheelEvent = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.ctrlKey) {
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      handleZoom(delta);
    } else {
      const deltaX = e.deltaX / zoomLevel;
      const deltaY = e.deltaY / zoomLevel;

      setCanvasScroll(prev => {
        if (!virtualCanvasDimensions || !stageDimensions) return prev;
        
        const maxScrollX = Math.max(0, virtualCanvasDimensions.width - (stageDimensions.width / zoomLevel));
        const maxScrollY = Math.max(0, virtualCanvasDimensions.height - (stageDimensions.height / zoomLevel));
        
        return {
          x: Math.max(0, Math.min(maxScrollX, prev.x + deltaX)),
          y: Math.max(0, Math.min(maxScrollY, prev.y + deltaY))
        };
      });
    }
  }, [ZOOM_STEP, handleZoom, setCanvasScroll, zoomLevel, virtualCanvasDimensions, stageDimensions]);

  useEffect(() => {
    const container = localContainerRef.current;
    if (!container) return;

    const wheelListener = (e) => {
      if (container.contains(e.target)) {
        handleWheelEvent(e);
      }
    };

    document.addEventListener('wheel', wheelListener, { passive: false });

    return () => {
      document.removeEventListener('wheel', wheelListener);
    };
  }, [handleWheelEvent]);

  const handleScroll = useCallback((axis, newScrollValue) => {
    setCanvasScroll(prev => {
        const newScroll = { ...prev, [axis]: newScrollValue };
        const maxScrollX = Math.max(0, virtualCanvasDimensions.width - (stageDimensions.width / zoomLevel));
        const maxScrollY = Math.max(0, virtualCanvasDimensions.height - (stageDimensions.height / zoomLevel));

        return {
            x: Math.max(0, Math.min(newScroll.x, maxScrollX)),
            y: Math.max(0, Math.min(newScroll.y, maxScrollY)),
        };
    });
  }, [setCanvasScroll, virtualCanvasDimensions, stageDimensions, zoomLevel]);

  return (
    <div
      ref={localContainerRef}
      className="canvas-container"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#f0f0f0',
        overflow: 'hidden', // Use hidden because we are implementing custom scrollbars
      }}
    >
      <Stage
        ref={stageRef}
        width={stageDimensions.width}
        height={stageDimensions.height}
        onClick={handleStageClick}
        onMouseMove={handleMouseMove}
        onMouseDown={(e) => {
          if (mode !== 'select') return;
          if (e.target && e.target.name && e.target.name() !== 'background') return;
          const start = getVirtualPointerPosition();
          if (!start) return;
          selectingRef.current = { isSelecting: true, start };
          setSelectionRect({ x: start.x, y: start.y, w: 0, h: 0 });
        }}
        onMouseUp={() => {
          if (mode !== 'select') return;
          if (!selectingRef.current.isSelecting || !selectionRect) return;
          const { x, y, w, h } = selectionRect;
          const minX = Math.min(x, x + w);
          const minY = Math.min(y, y + h);
          const maxX = Math.max(x, x + w);
          const maxY = Math.max(y, y + h);
          const inside = (pt) => pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;
          const newSelection = [];
          elements.places.forEach(p => { if (inside({ x: p.x, y: p.y })) newSelection.push({ id: p.id, type: 'place' }); });
          elements.transitions.forEach(t => { if (inside({ x: t.x, y: t.y })) newSelection.push({ id: t.id, type: 'transition' }); });
          setSelection(newSelection);
          selectingRef.current = { isSelecting: false, start: null };
          setSelectionRect(null);
        }}
        scaleX={zoomLevel}
        scaleY={zoomLevel}
        offsetX={canvasScroll.x}
        offsetY={canvasScroll.y}
      >
        <Layer>
          <Rect
            x={0}
            y={0}
            width={virtualCanvasDimensions.width}
            height={virtualCanvasDimensions.height}
            fill="#FFFFFF"
            name="background"
            onClick={() => {
              if (mode === 'arc' && arcStart) {
                setArcStart(null);
                setTempArcEnd(null);
              }
              setSelectedElement(null);
            }}
          />
          {selectionRect && (
            <Rect
              x={Math.min(selectionRect.x, selectionRect.x + selectionRect.w)}
              y={Math.min(selectionRect.y, selectionRect.y + selectionRect.h)}
              width={Math.abs(selectionRect.w)}
              height={Math.abs(selectionRect.h)}
              stroke="#3399FF"
              strokeWidth={1}
              dash={[4, 4]}
              fill="rgba(51,153,255,0.15)"
              listening={false}
            />
          )}
          <Grid 
            width={virtualCanvasDimensions.width} 
            height={virtualCanvasDimensions.height} 
            gridSize={gridSize} 
          />
          
          {/* Snap indicator layer */}
          <SnapIndicator 
            position={snapIndicator.position}
            visible={snapIndicator.visible}
            elementType={snapIndicator.elementType}
          />
        </Layer>
        <ElementManager 
          elements={elements}
          selectedElement={selectedElement}
          handleElementClick={handleElementClick}
          handleElementDragEnd={handleElementDragEnd}
          enabledTransitionIds={enabledTransitionIds}
        />
        <ArcManager />
      </Stage>
      {stageDimensions.width > 0 && virtualCanvasDimensions.width * zoomLevel > stageDimensions.width && (
          <CustomScrollbar
              orientation="horizontal"
              contentSize={virtualCanvasDimensions.width}
              viewportSize={stageDimensions.width / zoomLevel}
              scrollPosition={canvasScroll.x}
              onScroll={(newScroll) => handleScroll('x', newScroll)}
          />
      )}
      {stageDimensions.height > 0 && virtualCanvasDimensions.height * zoomLevel > stageDimensions.height && (
          <CustomScrollbar
              orientation="vertical"
              contentSize={virtualCanvasDimensions.height}
              viewportSize={(stageDimensions.height / zoomLevel)}
              scrollPosition={canvasScroll.y}
              onScroll={(newScroll) => handleScroll('y', newScroll)}
          />
      )}
    </div>
  );
};

export default CanvasManager;
