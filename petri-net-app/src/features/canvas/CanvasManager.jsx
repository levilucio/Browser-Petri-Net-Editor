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
import { remapIdsForPaste } from '../selection/clipboard-utils';
import { v4 as uuidv4 } from 'uuid';

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
    elements, setElements,
    enabledTransitionIds,
    snapToGrid,
    selectedElements, setSelection,
    isDragging,
    pasteMode, setPasteMode,
    getClipboard,
    netMode,
    onClipboardMismatch,
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
  const justCompletedSelectionRef = useRef(false); // Prevents tap from clearing selection right after rectangle select
  
  // Inertia/momentum scrolling for mouse wheel
  const wheelVelocityHistoryRef = useRef([]);
  const wheelInertiaAnimationRef = useRef(null);
  const wheelInertiaTimeoutRef = useRef(null);
  const MAX_WHEEL_VELOCITY_HISTORY = 3;
  
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
    gestureStartTimerId: null,  // Timer to delay starting gesture detection
    gestureDecided: false,  // true once we've decided pan vs selection
    gestureType: null,  // 'pan' | 'selection' | null
    isQuickTap: false,  // true if this is likely a quick tap (not a gesture)
  });
  
  const SELECTION_DELAY = 500; // ms to hold before selection activates
  const PAN_DELAY = 0; // Start panning immediately when swipe detected (like laptop touchpad)
  const MOVEMENT_THRESHOLD = 10; // pixels - reduced threshold for faster pan activation
  const TAP_THRESHOLD = 10; // pixels - movement below this is considered a tap
  const GESTURE_START_DELAY = 0; // Start gesture detection immediately (like laptop touchpad)
  
  const clearTouchGesture = useCallback(() => {
    const gesture = touchGestureRef.current;
    if (gesture.selectionTimerId) {
      clearTimeout(gesture.selectionTimerId);
    }
    if (gesture.gestureStartTimerId) {
      clearTimeout(gesture.gestureStartTimerId);
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
      gestureStartTimerId: null,
      gestureDecided: false,
      gestureType: null,
      isQuickTap: false,
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
    gesture.isQuickTap = true; // Assume it's a quick tap until proven otherwise
    
    console.log('[TouchGesture] Started:', { touchId: touch.identifier, startX: touch.clientX, startY: touch.clientY, isSelectMode });
    
    // Delay starting gesture detection to allow quick taps to complete
    gesture.gestureStartTimerId = setTimeout(() => {
      const g = touchGestureRef.current;
      
      // If touch already ended or moved significantly, don't start gesture detection
      if (!g.active || g.gestureDecided) {
        return;
      }
      
      // If we moved beyond tap threshold, it's not a quick tap - start gesture detection
      if (g.maxMovement > TAP_THRESHOLD) {
        g.isQuickTap = false;
        // Movement already detected, pan will activate on next move check
        return;
      }
      
      // Touch is held but hasn't moved - start selection timer if in select mode
      if (isSelectMode) {
        g.isQuickTap = false;
        // Set timer to activate selection at 500ms if we haven't moved much
        g.selectionTimerId = setTimeout(() => {
          const g2 = touchGestureRef.current;
          
          console.log('[TouchGesture] Timer fired:', { active: g2.active, gestureDecided: g2.gestureDecided, maxMovement: g2.maxMovement });
          
          // If gesture already decided (e.g., pan activated), skip
          if (g2.gestureDecided || !g2.active) {
            console.log('[TouchGesture] Selection cancelled - gesture already decided or inactive');
            return;
          }
          
          // If we moved too much, don't activate selection
          if (g2.maxMovement > MOVEMENT_THRESHOLD) {
            console.log('[TouchGesture] Selection cancelled - moved too much:', g2.maxMovement);
            return;
          }
          
          // Activate selection!
          console.log('[TouchGesture] Selection ACTIVATED!');
          g2.gestureDecided = true;
          g2.gestureType = 'selection';
          g2.selectionTimerId = null;
          
          if (isSelectionActiveRef) {
            isSelectionActiveRef.current = true;
          }
          selectingRef.current = { 
            isSelecting: true, 
            start: { x: g2.startVirtualX, y: g2.startVirtualY } 
          };
          setSelectionRect({ x: g2.startVirtualX, y: g2.startVirtualY, w: 0, h: 0 });
          
          // Double vibration to indicate selection activated
          if (navigator.vibrate) {
            try {
              navigator.vibrate([10, 50, 10]);
            } catch (e) {
              // Ignore
            }
          }
        }, SELECTION_DELAY - GESTURE_START_DELAY); // Adjust delay since we already waited
      }
    }, GESTURE_START_DELAY);
  }, [clearTouchGesture, isSelectionActiveRef, setSelectionRect]);
  
  // Check if we should activate pan based on movement
  const checkPanActivation = useCallback((currentTouch) => {
    const gesture = touchGestureRef.current;
    if (!gesture.active || gesture.gestureDecided) return;
    
    // If it's still a quick tap (hasn't moved much), don't activate pan
    if (gesture.isQuickTap && gesture.maxMovement <= TAP_THRESHOLD) {
      return;
    }
    
    // Mark as not a quick tap once we move beyond threshold
    if (gesture.maxMovement > TAP_THRESHOLD) {
      gesture.isQuickTap = false;
    }
    
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
      
      // Clear gesture start timer
      if (gesture.gestureStartTimerId) {
        clearTimeout(gesture.gestureStartTimerId);
        gesture.gestureStartTimerId = null;
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

  // Clear touch gesture state when isDragging changes
  // This prevents stale gesture state when transitioning between element drag and canvas pan
  useEffect(() => {
    // When dragging ends (isDragging becomes false), clear any pending gesture state
    // to ensure a clean slate for the next touch interaction
    if (!isDragging) {
      clearTouchGesture();
    }
  }, [isDragging, clearTouchGesture]);

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
    
    // Skip if we just completed a rectangle selection (prevents clearing it immediately)
    if (justCompletedSelectionRef.current) {
      return;
    }
    
    // Handle paste mode - paste at clicked location
    if (pasteMode) {
      const pos = getVirtualPointerPosition();
      if (pos) {
        const localMode = netMode || 'pt';
        const clipEntry = typeof getClipboard === 'function' ? getClipboard() : null;
        if (!clipEntry) {
          setPasteMode(false);
          return;
        }
        const payload = clipEntry.payload || clipEntry;
        if (!payload) {
          setPasteMode(false);
          return;
        }
        const clipboardMode = clipEntry.netMode || localMode;
        if (clipboardMode && localMode && clipboardMode !== localMode) {
          if (typeof onClipboardMismatch === 'function') {
            onClipboardMismatch(clipboardMode, localMode, clipEntry);
          } else {
            console.warn(`Blocked paste: shared clipboard contains ${clipboardMode} net, editor mode is ${localMode}.`);
          }
          setPasteMode(false);
          return;
        }
        
        // Calculate offset from clipboard's original position to tap position
        // Use first element's position as reference
        let offsetX = 40;
        let offsetY = 40;
        if (payload.places && payload.places.length > 0) {
          offsetX = pos.x - payload.places[0].x;
          offsetY = pos.y - payload.places[0].y;
        } else if (payload.transitions && payload.transitions.length > 0) {
          offsetX = pos.x - payload.transitions[0].x;
          offsetY = pos.y - payload.transitions[0].y;
        }
        
        const { newPlaces, newTransitions, newArcs, newSelection } = remapIdsForPaste(payload, uuidv4, { x: offsetX, y: offsetY });
        setElements(prev => ({
          ...prev,
          places: [...prev.places, ...newPlaces],
          transitions: [...prev.transitions, ...newTransitions],
          arcs: [...prev.arcs, ...newArcs],
        }));
        // Immediately transfer selection to the freshly pasted elements
        setSelection(newSelection);
        setPasteMode(false);
      }
      return;
    }
    
    // In select mode, clicking empty canvas clears selection
    if (mode === 'select') {
      setSelection([]);
      setSelectedElement(null);
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
    
    // Skip if we just completed a rectangle selection (prevents clearing it immediately)
    if (justCompletedSelectionRef.current) {
      return;
    }
    
    // Handle paste mode - paste at tapped location
    if (pasteMode) {
      const pos = getVirtualPointerPosition();
      if (pos) {
        const localMode = netMode || 'pt';
        const clipEntry = typeof getClipboard === 'function' ? getClipboard() : null;
        if (!clipEntry) {
          setPasteMode(false);
          return;
        }
        const payload = clipEntry.payload || clipEntry;
        if (!payload) {
          setPasteMode(false);
          return;
        }
        const clipboardMode = clipEntry.netMode || localMode;
        if (clipboardMode && localMode && clipboardMode !== localMode) {
          if (typeof onClipboardMismatch === 'function') {
            onClipboardMismatch(clipboardMode, localMode, clipEntry);
          } else {
            console.warn(`Blocked paste: shared clipboard contains ${clipboardMode} net, editor mode is ${localMode}.`);
          }
          setPasteMode(false);
          return;
        }
        
        // Calculate offset from clipboard's original position to tap position
        // Use first element's position as reference
        let offsetX = 40;
        let offsetY = 40;
        if (payload.places && payload.places.length > 0) {
          offsetX = pos.x - payload.places[0].x;
          offsetY = pos.y - payload.places[0].y;
        } else if (payload.transitions && payload.transitions.length > 0) {
          offsetX = pos.x - payload.transitions[0].x;
          offsetY = pos.y - payload.transitions[0].y;
        }
        
        const { newPlaces, newTransitions, newArcs, newSelection } = remapIdsForPaste(payload, uuidv4, { x: offsetX, y: offsetY });
        setElements(prev => ({
          ...prev,
          places: [...prev.places, ...newPlaces],
          transitions: [...prev.transitions, ...newTransitions],
          arcs: [...prev.arcs, ...newArcs],
        }));
        // Immediately transfer selection to the freshly pasted elements
        setSelection(newSelection);
        setPasteMode(false);
      }
      return;
    }
    
    // In select mode, tapping empty canvas clears selection
    if (mode === 'select') {
      setSelection([]);
      setSelectedElement(null);
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

  // Calculate wheel velocity and start inertia
  const calculateWheelVelocity = useCallback(() => {
    const history = wheelVelocityHistoryRef.current;
    if (history.length < 2) {
      return { vx: 0, vy: 0 };
    }

    // Use the last two samples
    const [first, second] = history.slice(-2);
    const dt = second.time - first.time;
    
    if (dt <= 0) {
      return { vx: 0, vy: 0 };
    }

    const vx = (second.deltaX - first.deltaX) / dt;
    const vy = (second.deltaY - first.deltaY) / dt;

    return { vx, vy };
  }, []);

  // Start wheel inertia animation
  const startWheelInertia = useCallback((initialVx, initialVy) => {
    // Cancel any existing animation
    if (wheelInertiaAnimationRef.current) {
      cancelAnimationFrame(wheelInertiaAnimationRef.current);
    }
    if (wheelInertiaTimeoutRef.current) {
      clearTimeout(wheelInertiaTimeoutRef.current);
    }

    const DECELERATION = 0.95;
    const MIN_VELOCITY = 0.01;
    const FRAME_TIME = 16;

    let vx = initialVx / zoomLevel; // Convert to virtual coordinates
    let vy = initialVy / zoomLevel;
    let lastTime = performance.now();

    const animate = (currentTime) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      // Apply deceleration
      vx *= Math.pow(DECELERATION, deltaTime / FRAME_TIME);
      vy *= Math.pow(DECELERATION, deltaTime / FRAME_TIME);

      // Check if we should stop
      const speed = Math.hypot(vx, vy);
      if (speed < MIN_VELOCITY) {
        wheelInertiaAnimationRef.current = null;
        return;
      }

      // Apply pan delta
      setCanvasScroll(prev => {
        if (!virtualCanvasDimensions || !stageDimensions) return prev;
        
        const maxScrollX = Math.max(0, virtualCanvasDimensions.width - (stageDimensions.width / zoomLevel));
        const maxScrollY = Math.max(0, virtualCanvasDimensions.height - (stageDimensions.height / zoomLevel));
        
        return {
          x: Math.max(0, Math.min(maxScrollX, prev.x + vx * deltaTime)),
          y: Math.max(0, Math.min(maxScrollY, prev.y + vy * deltaTime))
        };
      });

      // Continue animation
      wheelInertiaAnimationRef.current = requestAnimationFrame(animate);
    };

    wheelInertiaAnimationRef.current = requestAnimationFrame(animate);
  }, [zoomLevel, setCanvasScroll, virtualCanvasDimensions, stageDimensions]);

  // Stop wheel inertia
  const stopWheelInertia = useCallback(() => {
    if (wheelInertiaAnimationRef.current) {
      cancelAnimationFrame(wheelInertiaAnimationRef.current);
      wheelInertiaAnimationRef.current = null;
    }
    if (wheelInertiaTimeoutRef.current) {
      clearTimeout(wheelInertiaTimeoutRef.current);
      wheelInertiaTimeoutRef.current = null;
    }
    wheelVelocityHistoryRef.current = [];
  }, []);

  const handleWheelEvent = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.ctrlKey || e.metaKey) {
      // Zoom - no inertia
      stopWheelInertia();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      handleZoom(delta, { clientX: e.clientX, clientY: e.clientY });
    } else {
      // Pan - track velocity for inertia
      const deltaX = e.deltaX / zoomLevel;
      const deltaY = e.deltaY / zoomLevel;

      // Track velocity
      const now = performance.now();
      wheelVelocityHistoryRef.current.push({
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        time: now
      });
      if (wheelVelocityHistoryRef.current.length > MAX_WHEEL_VELOCITY_HISTORY) {
        wheelVelocityHistoryRef.current.shift();
      }

      // Clear any existing timeout
      if (wheelInertiaTimeoutRef.current) {
        clearTimeout(wheelInertiaTimeoutRef.current);
      }

      // Stop any ongoing inertia animation
      if (wheelInertiaAnimationRef.current) {
        cancelAnimationFrame(wheelInertiaAnimationRef.current);
        wheelInertiaAnimationRef.current = null;
      }

      setCanvasScroll(prev => {
        if (!virtualCanvasDimensions || !stageDimensions) return prev;
        
        const maxScrollX = Math.max(0, virtualCanvasDimensions.width - (stageDimensions.width / zoomLevel));
        const maxScrollY = Math.max(0, virtualCanvasDimensions.height - (stageDimensions.height / zoomLevel));
        
        return {
          x: Math.max(0, Math.min(maxScrollX, prev.x + deltaX)),
          y: Math.max(0, Math.min(maxScrollY, prev.y + deltaY))
        };
      });

      // Start inertia after wheel stops (150ms delay)
      wheelInertiaTimeoutRef.current = setTimeout(() => {
        const velocity = calculateWheelVelocity();
        const speed = Math.hypot(velocity.vx, velocity.vy);
        
        if (speed > 0.1) {
          startWheelInertia(velocity.vx, velocity.vy);
        }
        wheelInertiaTimeoutRef.current = null;
      }, 150);
    }
  }, [ZOOM_STEP, handleZoom, setCanvasScroll, zoomLevel, virtualCanvasDimensions, stageDimensions, calculateWheelVelocity, startWheelInertia, stopWheelInertia]);

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
      // Clean up inertia animation on unmount
      stopWheelInertia();
    };
  }, [handleWheelEvent, stopWheelInertia]);

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
              
              // Mark as not a quick tap once we move beyond threshold
              if (gesture.maxMovement > TAP_THRESHOLD) {
                gesture.isQuickTap = false;
              }
              
              console.log('[TouchGesture] Move:', { distance, maxMovement: gesture.maxMovement, gestureDecided: gesture.gestureDecided, isQuickTap: gesture.isQuickTap });
              
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
          
          // Prevent the subsequent click event from clearing the selection
          justCompletedSelectionRef.current = true;
          setTimeout(() => {
            justCompletedSelectionRef.current = false;
          }, 100);
        }}
        onTouchEnd={(e) => {
          console.log('[TouchGesture] TouchEnd');
          
          const gesture = touchGestureRef.current;
          const wasQuickTap = gesture.isQuickTap && gesture.maxMovement <= TAP_THRESHOLD;
          
          // If it was a quick tap, clear gesture early to let onTap handle it
          // But continue with other touch end logic (arc handling, etc.)
          if (wasQuickTap) {
            clearTouchGesture();
          }
          
          // Handle touch end for selection mode (only if not a quick tap)
          if (mode === 'select' && !wasQuickTap) {
            // If selection was activated and we have a selection rect, finalize it
            if (selectingRef.current.isSelecting && selectionRect) {
              const newSelection = buildSelectionFromRect(elements, selectionRect);
              setSelection(newSelection);
              selectingRef.current = { isSelecting: false, start: null };
              setSelectionRect(null);
              
              // Prevent the subsequent tap event from clearing the selection
              justCompletedSelectionRef.current = true;
              setTimeout(() => {
                justCompletedSelectionRef.current = false;
              }, 100);
            }
          }
          
          // Clear the gesture state if not already cleared
          if (!wasQuickTap) {
            clearTouchGesture();
          }
          
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
