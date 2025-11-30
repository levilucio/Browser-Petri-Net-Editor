import { useCallback, useEffect, useRef, useState } from 'react';

const createSingleFingerPanState = () => ({
  active: false,
  touchId: null,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
});

export function useCanvasZoom({
  MIN_ZOOM,
  MAX_ZOOM,
  zoomLevel,
  setZoomLevel,
  virtualCanvasDimensions,
  canvasScroll,
  setCanvasScroll,
  setContainerRef,
  isDragging = false,
  isSelectionActiveRef = null, // Ref to check if selection is active (read dynamically)
}) {
  // Use state to track the container element, ensuring effects run when it changes
  const [containerEl, setContainerEl] = useState(null);
  const localCanvasContainerDivRef = useRef(null);
  
  // Callback ref to handle container updates robustly
  const refCallback = useCallback((node) => {
    localCanvasContainerDivRef.current = node;
    setContainerEl(node);
    if (setContainerRef) {
      setContainerRef(node);
    }
  }, [setContainerRef]);

  const programmaticScrollRef = useRef(false);
  const pinchStateRef = useRef({ active: false });
  const panStateRef = useRef({ active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 });
  const [isSingleFingerPanningActive, setIsSingleFingerPanningActive] = useState(false);
  const singleFingerPanRef = useRef(createSingleFingerPanState());
  const zoomLevelRef = useRef(zoomLevel);
  
  // Ref to track isDragging synchronously (avoids race conditions with async state updates)
  const isDraggingRef = useRef(false);
  // Ref to prevent pan from starting immediately after drag ends (allows RAF callbacks to complete)
  const dragEndTimestampRef = useRef(0);
  const DRAG_END_COOLDOWN_MS = 100; // Wait 100ms after drag ends before allowing pan
  
  // Inertia/momentum scrolling state
  const inertiaAnimationRef = useRef(null);
  const velocityHistoryRef = useRef([]); // Array of {x, y, time} for velocity calculation
  const MAX_VELOCITY_HISTORY = 12; // Keep last ~10-12 samples (~100-200ms) for better velocity averaging

  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  // Update isDraggingRef synchronously when prop changes
  useEffect(() => {
    isDraggingRef.current = isDragging;
    // Record timestamp when dragging ends to enforce cooldown
    if (!isDragging) {
      dragEndTimestampRef.current = performance.now();
    }
  }, [isDragging]);

  const clampZoom = useCallback(
    (value) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value)),
    [MIN_ZOOM, MAX_ZOOM]
  );

  const adjustScrollForZoom = useCallback(
    (prevZoom, nextZoom, focalPoint) => {
      if (!localCanvasContainerDivRef.current || !virtualCanvasDimensions) return;
      const container = localCanvasContainerDivRef.current;
      const viewportWidth = container.clientWidth || 1;
      const viewportHeight = container.clientHeight || 1;
      const rect = container.getBoundingClientRect();
      const pointerX = focalPoint
        ? Math.min(Math.max(focalPoint.clientX - rect.left, 0), viewportWidth)
        : viewportWidth / 2;
      const pointerY = focalPoint
        ? Math.min(Math.max(focalPoint.clientY - rect.top, 0), viewportHeight)
        : viewportHeight / 2;

      const pointerVirtualX = (canvasScroll.x + pointerX) / prevZoom;
      const pointerVirtualY = (canvasScroll.y + pointerY) / prevZoom;

      const maxScrollX = Math.max(
        0,
        virtualCanvasDimensions.width - viewportWidth / nextZoom
      );
      const maxScrollY = Math.max(
        0,
        virtualCanvasDimensions.height - viewportHeight / nextZoom
      );

      const newScrollX = Math.max(
        0,
        Math.min(maxScrollX, pointerVirtualX * nextZoom - pointerX)
      );
      const newScrollY = Math.max(
        0,
        Math.min(maxScrollY, pointerVirtualY * nextZoom - pointerY)
      );
      setCanvasScroll({ x: newScrollX, y: newScrollY });
    },
    [canvasScroll, setCanvasScroll, virtualCanvasDimensions]
  );

  const applyPanDelta = useCallback(
    (deltaX, deltaY, zoomValue) => {
      if (
        !localCanvasContainerDivRef.current ||
        !virtualCanvasDimensions ||
        !Number.isFinite(zoomValue) ||
        zoomValue <= 0
      ) {
        return;
      }
      const container = localCanvasContainerDivRef.current;
      const viewportWidth = container.clientWidth || 1;
      const viewportHeight = container.clientHeight || 1;
      const maxScrollX = Math.max(
        0,
        virtualCanvasDimensions.width - viewportWidth / zoomValue
      );
      const maxScrollY = Math.max(
        0,
        virtualCanvasDimensions.height - viewportHeight / zoomValue
      );

      setCanvasScroll((prev) => {
        const nextX = Math.max(
          0,
          Math.min(maxScrollX, prev.x - deltaX / zoomValue)
        );
        const nextY = Math.max(
          0,
          Math.min(maxScrollY, prev.y - deltaY / zoomValue)
        );
        if (nextX === prev.x && nextY === prev.y) {
          return prev;
        }
        return { x: nextX, y: nextY };
      });
    },
    [setCanvasScroll, virtualCanvasDimensions]
  );

  // Calculate velocity from recent history
  const calculateVelocity = useCallback(() => {
    const history = velocityHistoryRef.current;
    if (history.length < 2) {
      return { vx: 0, vy: 0 };
    }

    // Use the oldest and newest samples in our limited history
    // This gives an average velocity over the recorded window (~100-200ms)
    const last = history[history.length - 1];
    const first = history[0];

    const dt = last.time - first.time;

    // Ignore extremely short or long intervals
    if (dt <= 10 || dt > 300) {
      // Fallback: try using just the last two samples if the full window is too short/long
      if (history.length >= 2) {
        const lastTwo = history.slice(-2);
        const dt2 = lastTwo[1].time - lastTwo[0].time;
        if (dt2 > 0 && dt2 <= 100) {
          return {
            vx: (lastTwo[1].x - lastTwo[0].x) / dt2,
            vy: (lastTwo[1].y - lastTwo[0].y) / dt2
          };
        }
      }
      return { vx: 0, vy: 0 };
    }

    const vx = (last.x - first.x) / dt;
    const vy = (last.y - first.y) / dt;

    return { vx, vy };
  }, []);

  // Start inertia animation with deceleration
  const startInertiaAnimation = useCallback((initialVx, initialVy) => {
    // Cancel any existing animation
    if (inertiaAnimationRef.current) {
      cancelAnimationFrame(inertiaAnimationRef.current);
    }

    console.log('[Inertia] Animation starting with velocity:', { vx: initialVx.toFixed(4), vy: initialVy.toFixed(4) });

    const DECELERATION = 0.985; // Deceleration factor per frame (0.985 = slower deceleration for longer inertia on mobile)
    const MIN_VELOCITY = 0.005; // Lower threshold to allow inertia to continue longer
    const FRAME_TIME = 16; // Approximate frame time in ms (60fps)

    let vx = initialVx;
    let vy = initialVy;
    let lastTime = performance.now();
    let frameCount = 0;

    const animate = (currentTime) => {
      frameCount++;
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      // Apply deceleration
      vx *= Math.pow(DECELERATION, deltaTime / FRAME_TIME);
      vy *= Math.pow(DECELERATION, deltaTime / FRAME_TIME);

      // Check if we should stop
      const speed = Math.hypot(vx, vy);
      if (speed < MIN_VELOCITY) {
        console.log('[Inertia] Animation stopped after', frameCount, 'frames, final speed:', speed.toFixed(4));
        inertiaAnimationRef.current = null;
        return;
      }

      // Apply pan delta based on velocity
      // Use positive delta to match the reversed panning direction
      const deltaX = vx * deltaTime;
      const deltaY = vy * deltaTime;
      applyPanDelta(deltaX, deltaY, zoomLevelRef.current);

      // Continue animation
      inertiaAnimationRef.current = requestAnimationFrame(animate);
    };

    inertiaAnimationRef.current = requestAnimationFrame(animate);
    console.log('[Inertia] Animation frame requested');
  }, [applyPanDelta]);

  // Stop inertia animation
  const stopInertiaAnimation = useCallback(() => {
    if (inertiaAnimationRef.current) {
      cancelAnimationFrame(inertiaAnimationRef.current);
      inertiaAnimationRef.current = null;
    }
    velocityHistoryRef.current = [];
  }, []);

  const applyZoom = useCallback(
    (computeNextZoom, focalPoint) => {
      setZoomLevel((prevZoom) => {
        const nextZoom = clampZoom(computeNextZoom(prevZoom));
        if (nextZoom !== prevZoom) {
          adjustScrollForZoom(prevZoom, nextZoom, focalPoint);
        }
        return nextZoom;
      });
    },
    [adjustScrollForZoom, clampZoom, setZoomLevel]
  );

  const handleZoom = useCallback(
    (delta, focalPoint) => {
      if (typeof delta !== 'number' || Number.isNaN(delta) || delta === 0) {
        return;
      }
      applyZoom((prevZoom) => prevZoom + delta, focalPoint);
    },
    [applyZoom]
  );

  const handleZoomTo = useCallback(
    (targetZoom, focalPoint) => {
      if (typeof targetZoom !== 'number' || Number.isNaN(targetZoom)) return;
      applyZoom(() => targetZoom, focalPoint);
    },
    [applyZoom]
  );

  const handleNativeCanvasScroll = useCallback(
    (event) => {
      if (programmaticScrollRef.current) {
        programmaticScrollRef.current = false;
        return;
      }
      if (setCanvasScroll) {
        setCanvasScroll({
          x: event.target.scrollLeft,
          y: event.target.scrollTop,
        });
      }
    },
    [setCanvasScroll]
  );

  useEffect(() => {
    if (localCanvasContainerDivRef.current) {
      programmaticScrollRef.current = true;
      if (localCanvasContainerDivRef.current.scrollLeft !== canvasScroll.x) {
        localCanvasContainerDivRef.current.scrollLeft = canvasScroll.x;
      }
      if (localCanvasContainerDivRef.current.scrollTop !== canvasScroll.y) {
        localCanvasContainerDivRef.current.scrollTop = canvasScroll.y;
      }
    }
  }, [canvasScroll, localCanvasContainerDivRef]);

  useEffect(() => {
    // We use containerEl state to trigger this effect when the container mounts/updates
    const container = containerEl;
    if (!container) return;

    const getDistance = (touches) => {
      const [t1, t2] = touches;
      return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    };

    const getCenter = (touches) => {
      const [t1, t2] = touches;
      return {
        clientX: (t1.clientX + t2.clientX) / 2,
        clientY: (t1.clientY + t2.clientY) / 2,
      };
    };

    const clearSingleFingerPan = () => {
      // Don't clear velocity history here - let inertia use it
      singleFingerPanRef.current = createSingleFingerPanState();
      setIsSingleFingerPanningActive(false);
    };

    const handleTouchStart = (event) => {
      // Stop any ongoing inertia animation
      stopInertiaAnimation();

      if (event.touches.length === 2) {
        clearSingleFingerPan();

        const center = getCenter(event.touches);
        const distance = getDistance(event.touches);

        pinchStateRef.current = {
          active: false,
          startDistance: distance,
          startZoom: zoomLevelRef.current,
          lastCenter: center,
        };
        panStateRef.current = {
          active: false,
          startX: center.clientX,
          startY: center.clientY,
          lastX: center.clientX,
          lastY: center.clientY,
        };
        // Reset velocity history
        velocityHistoryRef.current = [];
        return;
      }

      if (event.touches.length === 1) {
        panStateRef.current = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
        pinchStateRef.current = { active: false };

        // Check isDragging synchronously via ref and cooldown period
        const timeSinceDragEnd = performance.now() - dragEndTimestampRef.current;
        const isInCooldown = timeSinceDragEnd < DRAG_END_COOLDOWN_MS;
        
        // Don't start pan tracking if dragging or in cooldown
        if (isDraggingRef.current || isInCooldown) {
          clearSingleFingerPan();
          velocityHistoryRef.current = [];
          return;
        }

        // Single-finger pan/selection decision is now handled by CanvasManager
        // We just track the touch position for when panning is activated
        const touch = event.touches[0];
        singleFingerPanRef.current = {
          active: false,
          touchId: touch.identifier,
          startX: touch.clientX,
          startY: touch.clientY,
          lastX: touch.clientX,
          lastY: touch.clientY,
        };
        // Reset velocity history
        velocityHistoryRef.current = [];
        return;
      }

      // No touches or more than two - reset everything
      clearSingleFingerPan();
      pinchStateRef.current = { active: false };
      panStateRef.current = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
      velocityHistoryRef.current = [];
    };

    const handleTouchMove = (event) => {
      if (event.touches.length === 2) {
        clearSingleFingerPan();

        const center = getCenter(event.touches);
        const distance = getDistance(event.touches);
        const pinchState = pinchStateRef.current;

        const distanceRatio = pinchState.startDistance > 0
          ? distance / pinchState.startDistance
          : 1;
        const distanceChange = Math.abs(distanceRatio - 1);

        const ZOOM_THRESHOLD = 0.05;

        if (distanceChange > ZOOM_THRESHOLD) {
          if (!pinchState.active) {
            pinchStateRef.current = { ...pinchState, active: true };
          }

          event.preventDefault();
          event.stopPropagation();

          const targetZoom = clampZoom(pinchState.startZoom * distanceRatio);
          handleZoomTo(targetZoom, center);

          pinchStateRef.current = {
            ...pinchState,
            active: true,
            startDistance: pinchState.startDistance,
            startZoom: pinchState.startZoom,
            lastCenter: center,
          };
        } else {
          const panState = panStateRef.current;
          const nextPanState = { ...panState };
          const deltaX = center.clientX - nextPanState.lastX;
          const deltaY = center.clientY - nextPanState.lastY;
          const totalDeltaX = center.clientX - nextPanState.startX;
          const totalDeltaY = center.clientY - nextPanState.startY;
          const dragDistance = Math.hypot(totalDeltaX, totalDeltaY);

          const PAN_THRESHOLD = 5;
          if (!nextPanState.active && dragDistance > PAN_THRESHOLD) {
            nextPanState.active = true;
          }

          if (nextPanState.active) {
            event.preventDefault();
            event.stopPropagation();
            // Use positive delta to match laptop touchpad "natural" scrolling direction
            applyPanDelta(deltaX, deltaY, zoomLevelRef.current);
            
            // Track velocity for inertia
            const now = performance.now();
            velocityHistoryRef.current.push({
              x: center.clientX,
              y: center.clientY,
              time: now
            });
            // Keep only recent history
            if (velocityHistoryRef.current.length > MAX_VELOCITY_HISTORY) {
              velocityHistoryRef.current.shift();
            }
          }

          panStateRef.current = {
            ...nextPanState,
            lastX: center.clientX,
            lastY: center.clientY,
          };
        }
        return;
      }

      if (event.touches.length === 1) {
        const selectionActive = isSelectionActiveRef?.current || false;
        
        // Check isDragging synchronously via ref (avoids race condition with async state)
        // Also enforce cooldown period after drag ends to allow RAF callbacks to complete
        const timeSinceDragEnd = performance.now() - dragEndTimestampRef.current;
        const isInCooldown = timeSinceDragEnd < DRAG_END_COOLDOWN_MS;
        
        // Track velocity FIRST (before any blocking checks) for mobile inertia
        // This ensures velocity is captured even when gesture state isn't perfectly synced
        const touch = event.touches[0];
        const singlePan = singleFingerPanRef.current;
        
        if (singlePan.touchId !== null && touch.identifier === singlePan.touchId) {
          const now = performance.now();
          velocityHistoryRef.current.push({
            x: touch.clientX,
            y: touch.clientY,
            time: now
          });
          if (velocityHistoryRef.current.length > MAX_VELOCITY_HISTORY) {
            velocityHistoryRef.current.shift();
          }
        }
        
        if (isDraggingRef.current || isInCooldown || selectionActive) {
          clearSingleFingerPan();
          return;
        }
        
        if (touch.identifier !== singlePan.touchId) {
          return;
        }
        
        // If panning is active, apply pan delta
        if (singlePan.active) {
          const deltaX = touch.clientX - singlePan.lastX;
          const deltaY = touch.clientY - singlePan.lastY;

          event.preventDefault();
          event.stopPropagation();
          // Use positive delta to match laptop touchpad "natural" scrolling direction
          applyPanDelta(deltaX, deltaY, zoomLevelRef.current);
        }
        
        // Always track position for when panning activates
        singlePan.lastX = touch.clientX;
        singlePan.lastY = touch.clientY;
        return;
      }

      clearSingleFingerPan();
      pinchStateRef.current = { active: false };
      panStateRef.current = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
    };

    const handleTouchEnd = (event) => {
      // Check if we should start inertia animation
      const panWasActive = panStateRef.current.active || singleFingerPanRef.current.active;
      
      // Calculate velocity before clearing state
      let velocity = { vx: 0, vy: 0 };
      const hasVelocityHistory = velocityHistoryRef.current.length >= 2;
      
      if (hasVelocityHistory) {
        velocity = calculateVelocity();
        const speed = Math.hypot(velocity.vx, velocity.vy);
        
        // Very lenient threshold for mobile - 0.01 px/ms = 10 px/s
        // This should catch even slow swipes
        const MIN_INERTIA_SPEED = 0.01;
        
        console.log('[Inertia] Touch end:', {
          historyLength: velocityHistoryRef.current.length,
          velocity: { vx: velocity.vx.toFixed(4), vy: velocity.vy.toFixed(4) },
          speed: speed.toFixed(4),
          panWasActive,
          willStart: speed > MIN_INERTIA_SPEED
        });
        
        if (speed > MIN_INERTIA_SPEED) {
          console.log('[Inertia] Starting animation');
          startInertiaAnimation(velocity.vx, velocity.vy);
        } else {
          console.log('[Inertia] Speed too low:', speed, '<', MIN_INERTIA_SPEED);
        }
      } else {
        console.log('[Inertia] No velocity history:', velocityHistoryRef.current.length);
      }

      clearSingleFingerPan();
      pinchStateRef.current = { active: false };
      panStateRef.current = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
      // Don't clear velocity history immediately - let inertia use it
      // Clear it after a delay to allow inertia to start
      setTimeout(() => {
        if (!inertiaAnimationRef.current) {
          velocityHistoryRef.current = [];
        }
      }, 100);
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
      // Clean up inertia animation on unmount
      stopInertiaAnimation();
    };
  }, [applyPanDelta, clampZoom, handleZoomTo, isDragging, isSelectionActiveRef, containerEl, calculateVelocity, startInertiaAnimation, stopInertiaAnimation]);

  // Clear pan state when isDragging changes
  // This prevents crashes from stale state when transitioning between element drag and canvas pan
  useEffect(() => {
    // Only stop inertia when dragging STARTS (not when it ends)
    // When dragging starts: prevents stale pan state from interfering with element drag
    // When dragging ends: allow inertia to continue if it was already running
    if (isDragging) {
      stopInertiaAnimation();
      velocityHistoryRef.current = [];
    }
    
    singleFingerPanRef.current = createSingleFingerPanState();
    setIsSingleFingerPanningActive(false);
    pinchStateRef.current = { active: false };
    panStateRef.current = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
    
    // Update ref immediately for synchronous checks in touch handlers
    isDraggingRef.current = isDragging;
    if (!isDragging) {
      dragEndTimestampRef.current = performance.now();
    }
  }, [isDragging, stopInertiaAnimation]);

  // Function to activate single-finger panning from CanvasManager
  const activateSingleFingerPan = useCallback(() => {
    const singlePan = singleFingerPanRef.current;
    if (singlePan.touchId !== null && !singlePan.active) {
      singlePan.active = true;
      setIsSingleFingerPanningActive(true);
      // No vibration - pan activates silently like laptop touchpad
    }
  }, []);

  return { 
    localCanvasContainerDivRef: refCallback, 
    handleZoom, 
    handleNativeCanvasScroll,
    isSingleFingerPanningActive,
    activateSingleFingerPan, // Function to activate panning from CanvasManager
  };
}

export default useCanvasZoom;



