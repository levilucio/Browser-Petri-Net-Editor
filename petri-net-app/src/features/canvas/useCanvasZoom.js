import { useCallback, useEffect, useRef } from 'react';

export function useCanvasZoom({
  MIN_ZOOM,
  MAX_ZOOM,
  zoomLevel,
  setZoomLevel,
  virtualCanvasDimensions,
  canvasScroll,
  setCanvasScroll,
  setContainerRef,
}) {
  const localCanvasContainerDivRef = useRef(null);
  const programmaticScrollRef = useRef(false);
  const pinchStateRef = useRef({ active: false });
  const panStateRef = useRef({ active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 });
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
        event.preventDefault(); // Only prevent default for pinch gestures
        event.stopPropagation(); // Stop propagation for pinch to avoid conflicts
        pinchStateRef.current = {
          active: true,
          startDistance: getDistance(event.touches),
          startZoom: zoomLevelRef.current,
          lastCenter: getCenter(event.touches),
        };
        panStateRef.current = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
      } else if (event.touches.length === 1) {
        // Track single finger touch for potential panning
        const touch = event.touches[0];
        panStateRef.current = {
          active: false, // Will be activated after drag threshold
          startX: touch.clientX,
          startY: touch.clientY,
          lastX: touch.clientX,
          lastY: touch.clientY,
        };
      }
      // Don't prevent default initially - let taps work, we'll prevent on move if panning
    };

    const handleTouchMove = (event) => {
      const pinchState = pinchStateRef.current;
      
      // Handle two-finger pinch zoom
      if (pinchState.active) {
        if (event.touches.length !== 2) {
          pinchStateRef.current = { active: false };
          return;
        }
        // Only prevent default for active pinch gestures
        event.preventDefault();
        event.stopPropagation();
        const center = getCenter(event.touches);
        const distance = getDistance(event.touches);
        const ratio = pinchState.startDistance === 0 ? 1 : distance / pinchState.startDistance;
        const targetZoom = clampZoom(pinchState.startZoom * ratio);
        handleZoomTo(targetZoom, center);

        const deltaX = center.clientX - pinchState.lastCenter.clientX;
        const deltaY = center.clientY - pinchState.lastCenter.clientY;
        pinchStateRef.current = {
          ...pinchState,
          active: true,
          startDistance: pinchState.startDistance,
          startZoom: pinchState.startZoom,
          lastCenter: center,
        };
        if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
          applyPanDelta(deltaX, deltaY, targetZoom);
        }
        return;
      }

      // Handle single-finger panning
      if (event.touches.length === 1) {
        const panState = panStateRef.current;
        const touch = event.touches[0];
        const deltaX = touch.clientX - panState.lastX;
        const deltaY = touch.clientY - panState.lastY;
        const totalDeltaX = touch.clientX - panState.startX;
        const totalDeltaY = touch.clientY - panState.startY;
        const dragDistance = Math.hypot(totalDeltaX, totalDeltaY);
        
        // Activate panning after 10px drag threshold to distinguish from taps
        const PAN_THRESHOLD = 10;
        if (!panState.active && dragDistance > PAN_THRESHOLD) {
          panStateRef.current = { ...panState, active: true };
        }
        
        if (panState.active) {
          // Prevent default to stop scrolling and allow smooth panning
          event.preventDefault();
          // Apply pan delta - when dragging right, we want to see content to the left (increase scroll)
          // applyPanDelta does prev.x - deltaX/zoom, so we pass negative deltaX to increase scroll
          applyPanDelta(-deltaX, -deltaY, zoomLevelRef.current);
        }
        
        // Update last position
        panStateRef.current = {
          ...panState,
          lastX: touch.clientX,
          lastY: touch.clientY,
        };
      }
    };

    const handleTouchEnd = () => {
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
  }, [applyPanDelta, clampZoom, handleZoomTo]);

  return { localCanvasContainerDivRef, handleZoom, handleNativeCanvasScroll };
}

export default useCanvasZoom;



