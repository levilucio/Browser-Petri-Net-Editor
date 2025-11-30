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
        console.log('[Inertia] applyPanDelta blocked:', { 
          hasContainer: !!localCanvasContainerDivRef.current, 
          hasVirtualDims: !!virtualCanvasDimensions,
          zoomValue 
        });
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
    let lastTime = null; // Will be initialized on first frame to avoid negative deltaTime
    let frameCount = 0;

    const animate = (currentTime) => {
      console.log('[Inertia] animate() called, lastTime:', lastTime, 'currentTime:', currentTime?.toFixed(0));
      
      // Initialize lastTime on first frame to avoid negative deltaTime issues
      if (lastTime === null) {
        lastTime = currentTime;
        console.log('[Inertia] First frame - initializing timing');
        // Request next frame - first frame just initializes timing
        inertiaAnimationRef.current = requestAnimationFrame(animate);
        return;
      }
      
      frameCount++;
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      
      // Skip if deltaTime is invalid (shouldn't happen after first frame fix)
      if (deltaTime <= 0 || deltaTime > 100) {
        inertiaAnimationRef.current = requestAnimationFrame(animate);
        return;
      }

      // Log first few frames for debugging
      if (frameCount <= 3) {
        console.log('[Inertia] Frame', frameCount, ':', { deltaTime: deltaTime.toFixed(1), vx: vx.toFixed(4), vy: vy.toFixed(4) });
      }

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
      
      // Log when actually applying delta
      if (frameCount <= 3) {
        console.log('[Inertia] Applying delta:', { deltaX: deltaX.toFixed(2), deltaY: deltaY.toFixed(2), zoom: zoomLevelRef.current });
      }
      
      applyPanDelta(deltaX, deltaY, zoomLevelRef.current);

      // Continue animation
      inertiaAnimationRef.current = requestAnimationFrame(animate);
    };

    inertiaAnimationRef.current = requestAnimationFrame(animate);
    console.log('[Inertia] Animation frame requested');
  }, [applyPanDelta]);

  // Stop inertia animation (does NOT clear velocity history - that's separate)
  const stopInertiaAnimation = useCallback(() => {
    if (inertiaAnimationRef.current) {
      console.log('[Inertia] Stopping animation (RAF ID:', inertiaAnimationRef.current, ')');
      cancelAnimationFrame(inertiaAnimationRef.current);
      inertiaAnimationRef.current = null;
    }
    // Don't clear velocity history here - it might be needed for the next gesture
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
      console.log('[Inertia] handleTouchStart called:', { touchCount: event.touches.length });
      
      // Stop any ongoing inertia animation (but don't clear velocity history yet)
      stopInertiaAnimation();
      
      // Only clear velocity history if there's been a significant gap since last touch activity
      // This prevents clearing during multi-finger gestures or rapid interactions
      const now = performance.now();
      const lastVelocityEntry = velocityHistoryRef.current[velocityHistoryRef.current.length - 1];
      const timeSinceLastVelocity = lastVelocityEntry ? (now - lastVelocityEntry.time) : Infinity;
      if (timeSinceLastVelocity > 500) {
        // More than 500ms since last touch move - this is a new gesture, clear old data
        velocityHistoryRef.current = [];
        console.log('[Inertia] Cleared stale velocity history (gap:', timeSinceLastVelocity.toFixed(0), 'ms)');
      }

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
        // Don't clear velocity history here - it might be needed if user lifts one finger
        // Only clear if we're actually starting a new two-finger gesture
        // velocityHistoryRef.current = [];
        return;
      }

      if (event.touches.length === 1) {
        panStateRef.current = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
        pinchStateRef.current = { active: false };

        // Check isDragging synchronously via ref and cooldown period
        const timeSinceDragEnd = performance.now() - dragEndTimestampRef.current;
        const isInCooldown = timeSinceDragEnd < DRAG_END_COOLDOWN_MS;
        
        const touch = event.touches[0];
        
        // Check if this is a new touch (different identifier) or continuation
        const isNewTouch = singleFingerPanRef.current.touchId === null || 
                           singleFingerPanRef.current.touchId !== touch.identifier;
        
        // Only clear velocity history if this is a completely new touch gesture
        // Don't clear if we're just continuing the same touch
        if (isNewTouch && !isDraggingRef.current && !isInCooldown) {
          // New touch - start fresh but only if not in cooldown/dragging
          singleFingerPanRef.current = {
            active: false,
            touchId: touch.identifier,
            startX: touch.clientX,
            startY: touch.clientY,
            lastX: touch.clientX,
            lastY: touch.clientY,
          };
          // Don't clear velocity history here - it might be from a previous gesture that just ended
          console.log('[Inertia] TouchStart tracked (new):', { touchId: touch.identifier });
        } else if (!isNewTouch) {
          // Same touch continuing - just update position
          singleFingerPanRef.current.lastX = touch.clientX;
          singleFingerPanRef.current.lastY = touch.clientY;
          console.log('[Inertia] TouchStart (continuing):', { touchId: touch.identifier });
        } else {
          // New touch but blocked - still track it
          singleFingerPanRef.current = {
            active: false,
            touchId: touch.identifier,
            startX: touch.clientX,
            startY: touch.clientY,
            lastX: touch.clientX,
            lastY: touch.clientY,
          };
          console.log('[Inertia] TouchStart (blocked but tracking):', { touchId: touch.identifier, isDragging: isDraggingRef.current, isInCooldown });
        }
        
        return;
      }

      // No touches or more than two - reset everything
      clearSingleFingerPan();
      pinchStateRef.current = { active: false };
      panStateRef.current = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
      // Don't clear velocity history here either - might be valid from previous gesture
    };

    const handleTouchMove = (event) => {
      console.log('[Inertia] handleTouchMove called:', { touchCount: event.touches.length });
      
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
        
        // Always track velocity if we have a touch, even if touchId doesn't match yet
        // This handles cases where touchId might not be set or synced properly
        if (singlePan.touchId === null) {
          // If touchId not set, try to match with current touch
          singlePan.touchId = touch.identifier;
          singlePan.lastX = touch.clientX;
          singlePan.lastY = touch.clientY;
        }
        
        // Track velocity for any single touch movement
        if (touch.identifier === singlePan.touchId || singlePan.touchId === null) {
          const now = performance.now();
          velocityHistoryRef.current.push({
            x: touch.clientX,
            y: touch.clientY,
            time: now
          });
          if (velocityHistoryRef.current.length > MAX_VELOCITY_HISTORY) {
            velocityHistoryRef.current.shift();
          }
          console.log('[Inertia] Velocity tracked:', { 
            touchId: touch.identifier, 
            panTouchId: singlePan.touchId,
            historyLength: velocityHistoryRef.current.length,
            x: touch.clientX,
            y: touch.clientY
          });
        } else {
          console.log('[Inertia] Touch ID mismatch:', { 
            touchId: touch.identifier, 
            panTouchId: singlePan.touchId 
          });
        }
        
        if (isDraggingRef.current || isInCooldown || selectionActive) {
          // Don't clear velocity history here - we want to track it even during selection
          // clearSingleFingerPan();
          return;
        }
        
        if (touch.identifier !== singlePan.touchId && singlePan.touchId !== null) {
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
      console.log('[Inertia] handleTouchEnd called:', { 
        remainingTouches: event.touches?.length || 0,
        changedTouches: event.changedTouches?.length || 0,
        velocityHistoryLength: velocityHistoryRef.current.length
      });
      
      // Only process if this is the end of a single-finger touch
      // If there are still touches remaining, don't process inertia yet
      if (event.touches && event.touches.length > 0) {
        console.log('[Inertia] Touch end but other touches still active, skipping');
        return;
      }
      
      // Check if we should start inertia animation
      const panWasActive = panStateRef.current.active || singleFingerPanRef.current.active;
      
      // Calculate velocity BEFORE clearing any state
      // Make a copy of the history to prevent race conditions
      const velocityHistorySnapshot = [...velocityHistoryRef.current];
      let velocity = { vx: 0, vy: 0 };
      const hasVelocityHistory = velocityHistorySnapshot.length >= 2;
      
      if (hasVelocityHistory) {
        // Temporarily restore history for calculation
        const originalHistory = velocityHistoryRef.current;
        velocityHistoryRef.current = velocityHistorySnapshot;
        velocity = calculateVelocity();
        velocityHistoryRef.current = originalHistory;
        
        const speed = Math.hypot(velocity.vx, velocity.vy);
        
        // Very lenient threshold for mobile - 0.01 px/ms = 10 px/s
        const MIN_INERTIA_SPEED = 0.01;
        
        console.log('[Inertia] Touch end:', {
          historyLength: velocityHistorySnapshot.length,
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
        console.log('[Inertia] No velocity history:', velocityHistorySnapshot.length);
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
      // Don't clear velocity history here - let it persist for the next gesture
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



