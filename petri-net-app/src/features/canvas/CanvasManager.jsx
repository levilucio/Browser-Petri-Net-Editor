import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import { usePetriNet } from '../../contexts/PetriNetContext';
import { useEditorUI } from '../../contexts/EditorUIContext';
import { useElementManager } from '../elements/useElementManager';
import ElementManager from '../elements/ElementManager';
import ArcManager from '../arcs/ArcManager';
import Grid from '../../components/Grid';
import { buildSelectionFromRect } from '../selection/selection-utils';
import CustomScrollbar from '../../components/CustomScrollbar';
import SnapIndicator from '../../components/SnapIndicator';
import { logger } from '../../utils/logger.js';

const CanvasManager = ({ handleZoom, ZOOM_STEP, isSingleFingerPanningActive, isSelectionActiveRef, activateSingleFingerPan }) => {
  // Get UI state from EditorUIContext
  const {
    stageDimensions, setStageDimensions,
    virtualCanvasDimensions,
    canvasScroll, setCanvasScroll,
    zoomLevel,
    setContainerRef,
    stageRef,
    gridSize,
    gridSnappingEnabled,
    snapIndicator, setSnapIndicator,
  } = useEditorUI();
  
  // Get core editor state from PetriNetContext
  const {
    mode, setMode,
    arcStart, setArcStart,
    tempArcEnd, setTempArcEnd,
    selectedElement, setSelectedElement,
    elements,
    enabledTransitionIds,
    snapToGrid,
    selectedElements, setSelection,
    isDragging,
  } = usePetriNet();

  const { 
    handleCreateElement, 
    handleElementClick, 
    handleElementDragEnd, 
  } = useElementManager();

  const localContainerRef = useRef(null);
  const selectingRef = useRef({ isSelecting: false, start: null });
  const [selectionRect, setSelectionRect] = useState(null); // {x,y,w,h}
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  
  // Unified touch gesture state - manages both pan and selection detection
  const touchGestureRef = useRef({
    active: false,
    touchId: null,
    startX: 0,  // screen coordinates
    startY: 0,
    startVirtualX: 0,  // virtual canvas coordinates
    startVirtualY: 0,
    maxMovement: 0,
    startTime: 0,
    selectionTimerId: null,
    gestureDecided: false,  // true once we've decided pan vs selection
    gestureType: null,  // 'pan' | 'selection' | null
  });
  
  const SELECTION_DELAY = 500; // ms to hold before selection activates
  const PAN_DELAY = 250; // ms before pan can activate
  const MOVEMENT_THRESHOLD = 20; // pixels - movement beyond this triggers pan
  
  const clearTouchGesture = useCallback(() => {
    const gesture = touchGestureRef.current;
    if (gesture.selectionTimerId) {
      clearTimeout(gesture.selectionTimerId);
    }
    touchGestureRef.current = {
      active: false,
      touchId: null,
      startX: 0,
      startY: 0,
      startVirtualX: 0,
      startVirtualY: 0,
      maxMovement: 0,
      startTime: 0,
      selectionTimerId: null,
      gestureDecided: false,
      gestureType: null,
    };
    if (isSelectionActiveRef) {
      isSelectionActiveRef.current = false;
    }
  }, [isSelectionActiveRef]);
  
  const startTouchGesture = useCallback((touch, virtualPos, isSelectMode) => {
    clearTouchGesture();
    
    const gesture = touchGestureRef.current;
    gesture.active = true;
    gesture.touchId = touch.identifier;
    gesture.startX = touch.clientX;
    gesture.startY = touch.clientY;
    gesture.startVirtualX = virtualPos.x;
    gesture.startVirtualY = virtualPos.y;
    gesture.maxMovement = 0;
    gesture.startTime = Date.now();
    gesture.gestureDecided = false;
    gesture.gestureType = null;
    
    console.log('[TouchGesture] Started:', { touchId: touch.identifier, startX: touch.clientX, startY: touch.clientY, isSelectMode });
    
    // Only set selection timer in select mode
    if (isSelectMode) {
      // Set timer to activate selection at 500ms if we haven't moved much
      gesture.selectionTimerId = setTimeout(() => {
        const g = touchGestureRef.current;
        
        console.log('[TouchGesture] Timer fired:', { active: g.active, gestureDecided: g.gestureDecided, maxMovement: g.maxMovement });
        
        // If gesture already decided (e.g., pan activated), skip
        if (g.gestureDecided || !g.active) {
          console.log('[TouchGesture] Selection cancelled - gesture already decided or inactive');
          return;
        }
        
        // If we moved too much, don't activate selection
        if (g.maxMovement > MOVEMENT_THRESHOLD) {
          console.log('[TouchGesture] Selection cancelled - moved too much:', g.maxMovement);
          return;
        }
        
        // Activate selection!
        console.log('[TouchGesture] Selection ACTIVATED!');
        g.gestureDecided = true;
        g.gestureType = 'selection';
        g.selectionTimerId = null;
        
        if (isSelectionActiveRef) {
          isSelectionActiveRef.current = true;
        }
        selectingRef.current = { 
          isSelecting: true, 
          start: { x: g.startVirtualX, y: g.startVirtualY } 
        };
        setSelectionRect({ x: g.startVirtualX, y: g.startVirtualY, w: 0, h: 0 });
        
        // Double vibration to indicate selection activated
        if (navigator.vibrate) {
          try {
            navigator.vibrate([10, 50, 10]);
          } catch (e) {
            // Ignore
          }
        }
      }, SELECTION_DELAY);
    }
  }, [clearTouchGesture, isSelectionActiveRef, setSelectionRect]);
  
  // Check if we should activate pan based on movement
  const checkPanActivation = useCallback((currentTouch) => {
    const gesture = touchGestureRef.current;
    if (!gesture.active || gesture.gestureDecided) return;
    
    const elapsed = Date.now() - gesture.startTime;
    
    // Only activate pan if:
    // 1. At least PAN_DELAY ms have passed
    // 2. Movement exceeds threshold
    if (elapsed >= PAN_DELAY && gesture.maxMovement > MOVEMENT_THRESHOLD) {
      gesture.gestureDecided = true;
      gesture.gestureType = 'pan';
      
      // Clear selection timer since we're panning
      if (gesture.selectionTimerId) {
        clearTimeout(gesture.selectionTimerId);
        gesture.selectionTimerId = null;
      }
      
      // Tell useCanvasZoom to activate panning
      if (activateSingleFingerPan) {
        activateSingleFingerPan();
      }
    }
  }, [activateSingleFingerPan]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(pointer: coarse)');
    const update = (event) => setIsTouchDevice(event.matches);
    update(media);
    if (media.addEventListener) {
      media.addEventListener('change', update);
    } else {
      media.addListener(update);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', update);
      } else {
        media.removeListener(update);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      clearTouchGesture();
    };
  }, [clearTouchGesture]);

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
    if (pos) {
      handleCreateElement(pos);
    }
  };

  const handleStageTap = (e) => {
    // Handle tap on touch devices (works like click but more reliable for touch)
    if (e.target.name() !== 'background') {
      return;
    }
    const pos = getVirtualPointerPosition();
    if (pos) {
      handleCreateElement(pos);
    }
  };

  const handlePointerMove = (e) => {
    const pos = getVirtualPointerPosition();
    if (!pos) return;
    
    // Two-finger panning is handled in useCanvasZoom hook
    // No need to handle it here in Stage handlers
    
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
    const isSelectionActive = isSelectionActiveRef?.current || false;
    
    // Track movement for touch gesture detection - using native touch events
    // Note: Konva's onTouchMove doesn't give us screen coordinates directly,
    // so movement tracking is done in onTouchMove handler below
    
    if (mode === 'select') {
      if (selectingRef.current.isSelecting && selectingRef.current.start) {
        const start = selectingRef.current.start;
        setSelectionRect({ x: start.x, y: start.y, w: pos.x - start.x, h: pos.y - start.y });
      }
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

    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      handleZoom(delta, { clientX: e.clientX, clientY: e.clientY });
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
      const maxScrollX = Math.max(0, (virtualCanvasDimensions.width) - (stageDimensions.width / zoomLevel));
      const maxScrollY = Math.max(0, (virtualCanvasDimensions.height) - (stageDimensions.height / zoomLevel));
      const clamped = (val, max) => Math.max(0, Math.min(val, max));
      const next = { ...prev };
      if (axis === 'x') next.x = clamped(newScrollValue, maxScrollX);
      if (axis === 'y') next.y = clamped(newScrollValue, maxScrollY);
      return next;
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
        overflow: 'hidden',
        touchAction: isTouchDevice ? 'none' : 'auto',
      }}
    >
      <Stage
        ref={stageRef}
        width={stageDimensions.width}
        height={stageDimensions.height}
        // Ensure pointer events are allowed even when overlapped by other fixed UI
        listening={true}
        onClick={handleStageClick}
        onTap={handleStageTap}
        onMouseMove={handlePointerMove}
        onTouchMove={(e) => {
          // Get touches from native event (Konva wraps it in evt) or directly from e (for tests)
          const touches = (e.evt && e.evt.touches) || e.touches;
          
          // Track movement for touch gesture detection using screen coordinates
          if (isTouchDevice) {
            const gesture = touchGestureRef.current;
            if (gesture.active && !gesture.gestureDecided && touches && touches.length === 1) {
              const touch = touches[0];
              const movementX = touch.clientX - gesture.startX;
              const movementY = touch.clientY - gesture.startY;
              const distance = Math.hypot(movementX, movementY);
              gesture.maxMovement = Math.max(gesture.maxMovement, distance);
              
              console.log('[TouchGesture] Move:', { distance, maxMovement: gesture.maxMovement, gestureDecided: gesture.gestureDecided });
              
              // Check if we should activate pan
              checkPanActivation();
            }
          }
          
          // Continue with regular pointer move handling
          handlePointerMove(e);
        }}
        onMouseDown={(e) => {
          if (mode !== 'select') return;
          if (e.target && e.target.name && e.target.name() !== 'background') return;
          const start = getVirtualPointerPosition();
          if (!start) return;
          selectingRef.current = { isSelecting: true, start };
          setSelectionRect({ x: start.x, y: start.y, w: 0, h: 0 });
        }}
        onTouchStart={(e) => {
          const isBackground = e.target && e.target.name && e.target.name() === 'background';
          
          // Get touches from native event (Konva wraps it in evt) or directly from e (for tests)
          const touches = (e.evt && e.evt.touches) || e.touches;
          
          // Handle single-finger touch gestures
          if (touches && touches.length === 1) {
            const touch = touches[0];
            const pos = getVirtualPointerPosition();
            if (!pos) return;
            
            // In select mode on background: start gesture for potential selection
            // In other modes on background: start gesture for potential pan
            if (isBackground) {
              startTouchGesture(touch, pos, mode === 'select');
            } else {
              // Touching an element, clear any gesture
              clearTouchGesture();
            }
          } else {
            // Multi-touch or no touches - clear gesture
            clearTouchGesture();
          }
          // Two-finger panning is handled in useCanvasZoom hook
        }}
        onMouseUp={() => {
          if (mode !== 'select') return;
          if (!selectingRef.current.isSelecting || !selectionRect) return;
          const newSelection = buildSelectionFromRect(elements, selectionRect);
          setSelection(newSelection);
          selectingRef.current = { isSelecting: false, start: null };
          setSelectionRect(null);
        }}
        onTouchEnd={(e) => {
          console.log('[TouchGesture] TouchEnd');
          
          // Handle touch end for selection mode
          if (mode === 'select') {
            // If selection was activated and we have a selection rect, finalize it
            if (selectingRef.current.isSelecting && selectionRect) {
              const newSelection = buildSelectionFromRect(elements, selectionRect);
              setSelection(newSelection);
              selectingRef.current = { isSelecting: false, start: null };
              setSelectionRect(null);
            }
          }
          
          // Clear the gesture state in all modes
          clearTouchGesture();
          
          if (mode === 'arc' && arcStart) {
            // If touch ends during arc creation, check if it ended on an element
            // If not, clear the temporary arc after a small delay to allow element handlers to complete
            setTimeout(() => {
              // Check again if arcStart still exists (arc wasn't completed by element handler)
              if (mode === 'arc' && arcStart) {
                const stage = stageRef.current;
                if (stage) {
                  const pointerPos = stage.getPointerPosition();
                  if (pointerPos) {
                    const shape = stage.getIntersection(pointerPos);
                    // If touch didn't end on a place or transition, clear the arc
                    if (!shape || (shape.attrs.elementType !== 'place' && shape.attrs.elementType !== 'transition')) {
                      setArcStart(null);
                      setTempArcEnd(null);
                    }
                  } else {
                    // No pointer position available, clear the arc
                    setArcStart(null);
                    setTempArcEnd(null);
                  }
                } else {
                  // No stage available, clear the arc
                  setArcStart(null);
                  setTempArcEnd(null);
                }
              }
            }, 20); // Small delay to allow element touch handlers to complete first
          }
        }}
        // Apply zoom and pan using scale and position (ensure exact edge scrolling)
        scaleX={zoomLevel}
        scaleY={zoomLevel}
        x={-canvasScroll.x * zoomLevel}
        y={-canvasScroll.y * zoomLevel}
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
            onTap={() => {
              if (mode === 'arc' && arcStart) {
                setArcStart(null);
                setTempArcEnd(null);
              }
              setSelectedElement(null);
            }}
            onTouchEnd={() => {
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
      {!isTouchDevice && stageDimensions.width > 0 && virtualCanvasDimensions.width > stageDimensions.width / zoomLevel && (
          <CustomScrollbar
              orientation="horizontal"
              contentSize={virtualCanvasDimensions.width}
              viewportSize={stageDimensions.width / zoomLevel}
              scrollPosition={canvasScroll.x}
              onScroll={(newScroll) => handleScroll('x', newScroll)}
          />
      )}
      {!isTouchDevice && stageDimensions.height > 0 && virtualCanvasDimensions.height > stageDimensions.height / zoomLevel && (
          <CustomScrollbar
              orientation="vertical"
              contentSize={virtualCanvasDimensions.height}
              viewportSize={stageDimensions.height / zoomLevel}
              scrollPosition={canvasScroll.y}
              onScroll={(newScroll) => {
                logger.debug('Vertical scroll callback:', {
                  newScroll,
                  currentScroll: canvasScroll.y,
                  maxScroll: Math.max(0, virtualCanvasDimensions.height - (stageDimensions.height / zoomLevel))
                });
                handleScroll('y', newScroll);
              }}
          />
      )}
    </div>
  );
};

export default CanvasManager;
