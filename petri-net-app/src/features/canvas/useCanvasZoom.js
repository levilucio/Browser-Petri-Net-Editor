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
      singleFingerPanRef.current = createSingleFingerPanState();
      setIsSingleFingerPanningActive(false);
    };

    const handleTouchStart = (event) => {
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
        return;
      }

      if (event.touches.length === 1) {
        panStateRef.current = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
        pinchStateRef.current = { active: false };

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
        return;
      }

      // No touches or more than two - reset everything
      clearSingleFingerPan();
      pinchStateRef.current = { active: false };
      panStateRef.current = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
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
            applyPanDelta(-deltaX, -deltaY, zoomLevelRef.current);
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
        if (isDragging || selectionActive) {
          clearSingleFingerPan();
          return;
        }

        const touch = event.touches[0];
        const singlePan = singleFingerPanRef.current;
        
        // Track position for potential panning
        if (touch.identifier === singlePan.touchId) {
          singlePan.lastX = touch.clientX;
          singlePan.lastY = touch.clientY;
        }
        
        // If panning is active, apply pan delta
        if (singlePan.active && touch.identifier === singlePan.touchId) {
          const deltaX = touch.clientX - singlePan.lastX;
          const deltaY = touch.clientY - singlePan.lastY;

          event.preventDefault();
          event.stopPropagation();
          applyPanDelta(-deltaX, -deltaY, zoomLevelRef.current);

          singlePan.lastX = touch.clientX;
          singlePan.lastY = touch.clientY;
        }
        return;
      }

      clearSingleFingerPan();
      pinchStateRef.current = { active: false };
      panStateRef.current = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
    };

    const handleTouchEnd = () => {
      clearSingleFingerPan();
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
  }, [applyPanDelta, clampZoom, handleZoomTo, isDragging, isSelectionActiveRef, containerEl]);

  // Function to activate single-finger panning from CanvasManager
  const activateSingleFingerPan = useCallback(() => {
    const singlePan = singleFingerPanRef.current;
    if (singlePan.touchId !== null && !singlePan.active) {
      singlePan.active = true;
      setIsSingleFingerPanningActive(true);
      
      // Single vibration to indicate pan activated
      if (navigator.vibrate) {
        try {
          navigator.vibrate(10);
        } catch (e) {
          // Ignore
        }
      }
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



