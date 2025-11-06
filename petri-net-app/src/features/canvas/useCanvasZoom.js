import { useEffect, useRef } from 'react';

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

  const handleZoom = (delta) => {
    setZoomLevel(prevZoom => {
      const newZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prevZoom + delta));
      if (newZoomLevel !== prevZoom && localCanvasContainerDivRef.current) {
        const container = localCanvasContainerDivRef.current;
        const viewportWidth = container.clientWidth;
        const viewportHeight = container.clientHeight;
        const viewportCenterXVirtual = (canvasScroll.x + viewportWidth / 2) / prevZoom;
        const viewportCenterYVirtual = (canvasScroll.y + viewportHeight / 2) / prevZoom;
        let newScrollX = (viewportCenterXVirtual * newZoomLevel) - (viewportWidth / 2);
        let newScrollY = (viewportCenterYVirtual * newZoomLevel) - (viewportHeight / 2);
        const maxScrollX = Math.max(0, (virtualCanvasDimensions.width * newZoomLevel) - viewportWidth);
        const maxScrollY = Math.max(0, (virtualCanvasDimensions.height * newZoomLevel) - viewportHeight);
        newScrollX = Math.max(0, Math.min(maxScrollX, newScrollX));
        newScrollY = Math.max(0, Math.min(maxScrollY, newScrollY));
        setCanvasScroll({ x: newScrollX, y: newScrollY });
      }
      return newZoomLevel;
    });
  };

  const handleNativeCanvasScroll = (event) => {
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
  };

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

  return { localCanvasContainerDivRef, handleZoom, handleNativeCanvasScroll };
}

export default useCanvasZoom;



