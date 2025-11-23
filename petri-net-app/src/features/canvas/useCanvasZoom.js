import { useCallback, useEffect, useRef, useState } from 'react';

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
}) {
  const localCanvasContainerDivRef = useRef(null);
  const programmaticScrollRef = useRef(false);
  const pinchStateRef = useRef({ active: false });
  const panStateRef = useRef({ active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 });
  const [isSingleFingerPanningActive, setIsSingleFingerPanningActive] = useState(false);
  const singleFingerPanRef = useRef({ 
    active: false, 
    startX: 0, 
    startY: 0, 
    lastX: 0, 
    lastY: 0,
    holdTimer: null,
    touchId: null
  });
  const zoomLevelRef = useRef(zoomLevel);

  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

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
    if (localCanvasContainerDivRef.current && setContainerRef) {
      setContainerRef(localCanvasContainerDivRef.current);
    }
  }, [localCanvasContainerDivRef, setContainerRef]);

  useEffect(() => {
    const container = localCanvasContainerDivRef.current;
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

    const handleTouchStart = (event) => {
      if (event.touches.length === 2) {
        // Clear single-finger pan state
        if (singleFingerPanRef.current.holdTimer) {
          clearTimeout(singleFingerPanRef.current.holdTimer);
          singleFingerPanRef.current.holdTimer = null;
        }
        singleFingerPanRef.current = { 
          active: false, 
          startX: 0, 
          startY: 0, 
          lastX: 0, 
          lastY: 0,
          holdTimer: null,
          touchId: null
        };
        
        const center = getCenter(event.touches);
        const distance = getDistance(event.touches);
        
        // Initialize both pinch and pan state for two-finger gestures
        pinchStateRef.current = {
          active: false, // Will be activated if distance changes significantly
          startDistance: distance,
          startZoom: zoomLevelRef.current,
          lastCenter: center,
        };
        panStateRef.current = {
          active: false, // Will be activated if distance stays relatively constant
          startX: center.clientX,
          startY: center.clientY,
          lastX: center.clientX,
          lastY: center.clientY,
        };
      } else if (event.touches.length === 1) {
        // Single finger - set up delayed panning
        // BUT: Don't activate panning if elements are being dragged
        if (isDragging) {
          // Clear any existing pan timer
          const singlePan = singleFingerPanRef.current;
          if (singlePan.holdTimer) {
            clearTimeout(singlePan.holdTimer);
            singlePan.holdTimer = null;
          }
          singlePan.active = false;
          setIsSingleFingerPanningActive(false);
          return;
        }
        
        const touch = event.touches[0];
        const singlePan = singleFingerPanRef.current;
        
        // Clear any existing timer
        if (singlePan.holdTimer) {
          clearTimeout(singlePan.holdTimer);
        }
        
        // Reset two-finger states
        panStateRef.current = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
        pinchStateRef.current = { active: false };
        
        // Initialize single-finger pan state (not active yet)
        singlePan.startX = touch.clientX;
        singlePan.startY = touch.clientY;
        singlePan.lastX = touch.clientX;
        singlePan.lastY = touch.clientY;
        singlePan.active = false;
        singlePan.touchId = touch.identifier;
        
        // Set timer to activate panning after 0.5 seconds
        singlePan.holdTimer = setTimeout(() => {
          // Only activate if:
          // 1. Still a single touch and same touch ID
          // 2. Elements are NOT being dragged
          if (!isDragging &&
              event.touches.length === 1 && 
              event.touches[0].identifier === singlePan.touchId) {
            singlePan.active = true;
            setIsSingleFingerPanningActive(true);
          }
        }, 500); // 0.5 second delay
      } else {
        // No touches or more than 2 - reset everything
        if (singleFingerPanRef.current.holdTimer) {
          clearTimeout(singleFingerPanRef.current.holdTimer);
          singleFingerPanRef.current.holdTimer = null;
        }
        singleFingerPanRef.current = { 
          active: false, 
          startX: 0, 
          startY: 0, 
          lastX: 0, 
          lastY: 0,
          holdTimer: null,
          touchId: null
        };
        setIsSingleFingerPanningActive(false);
        panStateRef.current = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
        pinchStateRef.current = { active: false };
      }
      // Don't prevent default initially - let taps work, we'll prevent on move if panning/zooming
    };

    const handleTouchMove = (event) => {
      if (event.touches.length === 2) {
        // Clear single-finger pan if active
        if (singleFingerPanRef.current.holdTimer) {
          clearTimeout(singleFingerPanRef.current.holdTimer);
          singleFingerPanRef.current.holdTimer = null;
        }
        singleFingerPanRef.current.active = false;
        setIsSingleFingerPanningActive(false);
        
        const center = getCenter(event.touches);
        const distance = getDistance(event.touches);
        const pinchState = pinchStateRef.current;
        
        // Calculate distance change ratio
        const distanceRatio = pinchState.startDistance > 0 
          ? distance / pinchState.startDistance 
          : 1;
        const distanceChange = Math.abs(distanceRatio - 1);
        
        // Threshold to distinguish zoom (distance changing) from pan (distance constant)
        const ZOOM_THRESHOLD = 0.05; // 5% change in distance = zoom gesture
        
        if (distanceChange > ZOOM_THRESHOLD) {
          // Distance is changing significantly = pinch zoom
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
          // Distance is relatively constant = two-finger pan
          const panState = panStateRef.current;
          const deltaX = center.clientX - panState.lastX;
          const deltaY = center.clientY - panState.lastY;
          const totalDeltaX = center.clientX - panState.startX;
          const totalDeltaY = center.clientY - panState.startY;
          const dragDistance = Math.hypot(totalDeltaX, totalDeltaY);
          
          // Activate panning after small threshold
          const PAN_THRESHOLD = 5;
          if (!panState.active && dragDistance > PAN_THRESHOLD) {
            panStateRef.current = { ...panState, active: true };
          }
          
          if (panState.active) {
            event.preventDefault();
            event.stopPropagation();
            // Apply pan delta using center point movement
            // applyPanDelta does prev.x - deltaX/zoom, so we pass negative deltaX to increase scroll
            applyPanDelta(-deltaX, -deltaY, zoomLevelRef.current);
          }
          
          // Update pan state
          panStateRef.current = {
            ...panState,
            lastX: center.clientX,
            lastY: center.clientY,
          };
        }
        return;
      } else if (event.touches.length === 1) {
        // Single finger - check if panning is active (after delay)
        // BUT: Don't pan if elements are being dragged
        if (isDragging) {
          // Cancel panning if dragging starts
          const singlePan = singleFingerPanRef.current;
          if (singlePan.holdTimer) {
            clearTimeout(singlePan.holdTimer);
            singlePan.holdTimer = null;
          }
          if (singlePan.active) {
            singlePan.active = false;
            setIsSingleFingerPanningActive(false);
          }
          return;
        }
        
        const singlePan = singleFingerPanRef.current;
        const touch = event.touches[0];
        
        // Only pan if the hold timer has completed and panning is active
        if (singlePan.active && touch.identifier === singlePan.touchId) {
          const deltaX = touch.clientX - singlePan.lastX;
          const deltaY = touch.clientY - singlePan.lastY;
          
          // Prevent default to stop scrolling/selection
          event.preventDefault();
          event.stopPropagation();
          
          // Apply pan delta
          // applyPanDelta does prev.x - deltaX/zoom, so we pass negative deltaX to increase scroll
          applyPanDelta(-deltaX, -deltaY, zoomLevelRef.current);
          
          // Update last position
          singlePan.lastX = touch.clientX;
          singlePan.lastY = touch.clientY;
        } else {
          // Panning not active yet - update last position for when it becomes active
          if (touch.identifier === singlePan.touchId) {
            singlePan.lastX = touch.clientX;
            singlePan.lastY = touch.clientY;
          }
        }
      } else {
        // No touches or more than 2 - reset states
        if (singleFingerPanRef.current.holdTimer) {
          clearTimeout(singleFingerPanRef.current.holdTimer);
          singleFingerPanRef.current.holdTimer = null;
        }
        singleFingerPanRef.current = { 
          active: false, 
          startX: 0, 
          startY: 0, 
          lastX: 0, 
          lastY: 0,
          holdTimer: null,
          touchId: null
        };
        setIsSingleFingerPanningActive(false);
        pinchStateRef.current = { active: false };
        panStateRef.current = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
      }
    };

    const handleTouchEnd = () => {
      // Clear single-finger pan timer and reset state
      if (singleFingerPanRef.current.holdTimer) {
        clearTimeout(singleFingerPanRef.current.holdTimer);
        singleFingerPanRef.current.holdTimer = null;
      }
      singleFingerPanRef.current = { 
        active: false, 
        startX: 0, 
        startY: 0, 
        lastX: 0, 
        lastY: 0,
        holdTimer: null,
        touchId: null
      };
      setIsSingleFingerPanningActive(false);
      
      pinchStateRef.current = { active: false };
      panStateRef.current = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [applyPanDelta, clampZoom, handleZoomTo, isDragging]);

  return { 
    localCanvasContainerDivRef, 
    handleZoom, 
    handleNativeCanvasScroll,
    isSingleFingerPanningActive
  };
}

export default useCanvasZoom;



