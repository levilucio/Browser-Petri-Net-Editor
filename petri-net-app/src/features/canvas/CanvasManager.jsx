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

const CanvasManager = ({ handleZoom, ZOOM_STEP, isSingleFingerPanningActive }) => {
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
  
  // Double tap detection for rectangle selection
  const doubleTapRef = useRef({
    firstTap: null, // { time, x, y }
    secondTap: null, // { time, x, y, touchId }
    isDoubleTapActive: false,
    holdTimer: null,
    resetTimer: null, // Timer to reset first tap if too much time passes
  });
  
  const DOUBLE_TAP_TIME_WINDOW = 300; // ms between taps
  const DOUBLE_TAP_DISTANCE_THRESHOLD = 50; // pixels - max distance between taps
  const HOLD_DELAY = 100; // ms to hold after second tap before selection can start
  const RESET_TIMEOUT = 1000; // ms to reset first tap if no second tap

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
    // Cancel selection if single-finger panning becomes active
    if (isSingleFingerPanningActive) {
      if (selectingRef.current.isSelecting) {
        selectingRef.current = { isSelecting: false, start: null };
        setSelectionRect(null);
      }
      return;
    }
    
    // Only update selection rectangle if:
    // 1. In select mode
    // 2. Selection is active
    // 3. Double tap selection is active (for touch devices) OR mouse is being used
    const doubleTap = doubleTapRef.current;
    const isTouchSelection = isTouchDevice && doubleTap.isDoubleTapActive;
    const isMouseSelection = !isTouchDevice;
    
    if (mode === 'select' && 
        selectingRef.current.isSelecting && 
        selectingRef.current.start &&
        (isTouchSelection || isMouseSelection)) {
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
        onTouchMove={handlePointerMove}
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
          
          // Don't start selection if single-finger panning is active
          if (isSingleFingerPanningActive) {
            // Cancel any ongoing selection
            selectingRef.current = { isSelecting: false, start: null };
            setSelectionRect(null);
            // Reset double tap state
            if (doubleTapRef.current.holdTimer) {
              clearTimeout(doubleTapRef.current.holdTimer);
            }
            doubleTapRef.current = {
              firstTap: null,
              secondTap: null,
              isDoubleTapActive: false,
              holdTimer: null,
            };
            return;
          }
          
          // Only handle double tap selection in select mode on background
          if (mode === 'select' && isBackground && e.touches.length === 1) {
            const touch = e.touches[0];
            const pos = getVirtualPointerPosition();
            if (!pos) return;
            
            const now = Date.now();
            const doubleTap = doubleTapRef.current;
            
            // Check if this is a second tap (double tap)
            if (doubleTap.firstTap && 
                (now - doubleTap.firstTap.time) < DOUBLE_TAP_TIME_WINDOW) {
              // Check if taps are close enough
              const distance = Math.hypot(
                pos.x - doubleTap.firstTap.x,
                pos.y - doubleTap.firstTap.y
              );
              
              if (distance < DOUBLE_TAP_DISTANCE_THRESHOLD) {
                // This is a double tap!
                // Clear reset timer since we got the second tap
                if (doubleTap.resetTimer) {
                  clearTimeout(doubleTap.resetTimer);
                  doubleTap.resetTimer = null;
                }
                
                doubleTap.secondTap = {
                  time: now,
                  x: pos.x,
                  y: pos.y,
                  touchId: touch.identifier,
                };
                doubleTap.isDoubleTapActive = false; // Will be activated after hold
                
                // Set timer to activate selection after hold delay
                const savedTouchId = touch.identifier;
                const savedPos = { x: pos.x, y: pos.y };
                doubleTap.holdTimer = setTimeout(() => {
                  // Activate double tap selection
                  // The actual position will be updated on the next touch move
                  doubleTap.isDoubleTapActive = true;
                  // Start selection at the second tap position
                  selectingRef.current = { 
                    isSelecting: true, 
                    start: savedPos
                  };
                  setSelectionRect({ x: savedPos.x, y: savedPos.y, w: 0, h: 0 });
                }, HOLD_DELAY);
              } else {
                // Too far apart, treat as new first tap
                if (doubleTap.resetTimer) {
                  clearTimeout(doubleTap.resetTimer);
                }
                doubleTap.firstTap = { time: now, x: pos.x, y: pos.y };
                doubleTap.secondTap = null;
                doubleTap.isDoubleTapActive = false;
                doubleTap.resetTimer = setTimeout(() => {
                  doubleTap.firstTap = null;
                  doubleTap.resetTimer = null;
                }, RESET_TIMEOUT);
              }
            } else {
              // First tap or too much time passed
              doubleTap.firstTap = { time: now, x: pos.x, y: pos.y };
              doubleTap.secondTap = null;
              doubleTap.isDoubleTapActive = false;
              if (doubleTap.holdTimer) {
                clearTimeout(doubleTap.holdTimer);
                doubleTap.holdTimer = null;
              }
              // Set timer to reset first tap if no second tap comes
              if (doubleTap.resetTimer) {
                clearTimeout(doubleTap.resetTimer);
              }
              doubleTap.resetTimer = setTimeout(() => {
                doubleTap.firstTap = null;
                doubleTap.resetTimer = null;
              }, RESET_TIMEOUT);
            }
          } else {
            // Not in select mode or not background - reset double tap
            const doubleTap = doubleTapRef.current;
            if (doubleTap.holdTimer) {
              clearTimeout(doubleTap.holdTimer);
            }
            if (doubleTap.resetTimer) {
              clearTimeout(doubleTap.resetTimer);
            }
            doubleTapRef.current = {
              firstTap: null,
              secondTap: null,
              isDoubleTapActive: false,
              holdTimer: null,
              resetTimer: null,
            };
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
          // Pan state is reset in useCanvasZoom hook
          
          // Clean up double tap timers if touch ends
          const doubleTap = doubleTapRef.current;
          if (doubleTap.holdTimer) {
            clearTimeout(doubleTap.holdTimer);
            doubleTap.holdTimer = null;
          }
          if (doubleTap.resetTimer) {
            clearTimeout(doubleTap.resetTimer);
            doubleTap.resetTimer = null;
          }
          
          // If touch ends before double tap selection activates, reset
          if (doubleTap.secondTap && !doubleTap.isDoubleTapActive) {
            doubleTap.firstTap = null;
            doubleTap.secondTap = null;
            doubleTap.isDoubleTapActive = false;
          }
          
          if (mode === 'select') {
            if (!selectingRef.current.isSelecting || !selectionRect) {
              // Reset double tap state if selection wasn't completed
              doubleTap.firstTap = null;
              doubleTap.secondTap = null;
              doubleTap.isDoubleTapActive = false;
              return;
            }
            const newSelection = buildSelectionFromRect(elements, selectionRect);
            setSelection(newSelection);
            selectingRef.current = { isSelecting: false, start: null };
            setSelectionRect(null);
            
            // Reset double tap state after selection completes
            doubleTap.firstTap = null;
            doubleTap.secondTap = null;
            doubleTap.isDoubleTapActive = false;
            if (doubleTap.resetTimer) {
              clearTimeout(doubleTap.resetTimer);
              doubleTap.resetTimer = null;
            }
          } else if (mode === 'arc' && arcStart) {
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
