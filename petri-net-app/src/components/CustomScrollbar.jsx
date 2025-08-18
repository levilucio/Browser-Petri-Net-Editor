import React, { useState, useRef, useEffect, useCallback } from 'react';

const CustomScrollbar = ({
  orientation,
  contentSize,
  viewportSize,
  scrollPosition,
  onScroll,
}) => {
  const trackRef = useRef(null);
  const thumbRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const initialScrollPositionRef = useRef(0);
  const dragStartPosRef = useRef(0);

  const isHorizontal = orientation === 'horizontal';

  const handleThumbMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    initialScrollPositionRef.current = scrollPosition;
    dragStartPosRef.current = isHorizontal ? e.clientX : e.clientY;
  }, [isHorizontal, scrollPosition]);

  const handleTrackClick = useCallback((e) => {
      if (trackRef.current && thumbRef.current && !thumbRef.current.contains(e.target)) {
          const { left, top, width, height } = trackRef.current.getBoundingClientRect();
          const trackSize = isHorizontal ? width : height;
          const thumbSize = Math.max(20, trackSize * (viewportSize / contentSize));
          const maxScroll = contentSize - viewportSize;
          
          const mousePosition = isHorizontal ? e.clientX - left : e.clientY - top;
          let newScrollPosition = ((mousePosition - thumbSize / 2) / (trackSize - thumbSize)) * maxScroll;
          newScrollPosition = Math.max(0, Math.min(newScrollPosition, maxScroll));
          onScroll(newScrollPosition);
      }
  }, [contentSize, viewportSize, isHorizontal, onScroll]);

  useEffect(() => {
    const handleDragMove = (e) => {
        if (!isDragging || !trackRef.current) return;
        
        const currentPos = isHorizontal ? e.clientX : e.clientY;
        const delta = currentPos - dragStartPosRef.current;

        const trackSize = isHorizontal ? trackRef.current.clientWidth : trackRef.current.clientHeight;
        const thumbSize = Math.max(20, trackSize * (viewportSize / contentSize));
        const maxScroll = contentSize - viewportSize;
        const maxThumbPosition = trackSize - thumbSize;

        if (maxThumbPosition <= 0) return;

        const scrollPerPixel = maxScroll / maxThumbPosition;
        const newScroll = initialScrollPositionRef.current + (delta * scrollPerPixel);
        
        onScroll(Math.max(0, Math.min(newScroll, maxScroll)));
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isHorizontal ? 'ew-resize' : 'ns-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
  }, [isDragging, isHorizontal, onScroll, contentSize, viewportSize]);

  if (contentSize <= viewportSize) {
    return null;
  }

  const trackSize = trackRef.current ? (isHorizontal ? trackRef.current.clientWidth : trackRef.current.clientHeight) : 0;
  const thumbSize = trackSize > 0 ? Math.max(20, trackSize * (viewportSize / contentSize)) : 0;
  const maxScroll = contentSize - viewportSize;
  const maxThumbPosition = trackSize > thumbSize ? trackSize - thumbSize : 0;
  const thumbPosition = maxScroll > 0 ? (scrollPosition / maxScroll) * maxThumbPosition : 0;

  const toolbarOffset = 64; // keep scrollbar below fixed toolbar
  const rightSidebarOffset = 320; // approximate width of right sidebar
  const scrollbarStyle = {
    position: 'absolute',
    zIndex: 10,
    ...(isHorizontal
      ? { left: '10px', right: `${rightSidebarOffset - 5}px`, bottom: '5px', height: '10px' }
      : { top: `${toolbarOffset}px`, bottom: '20px', right: '5px', width: '10px' }),
  };

  const trackStyle = {
    position: 'relative',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: '5px',
  };

  const thumbStyle = {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: '5px',
    cursor: 'pointer',
    ...(isHorizontal
      ? { left: `${thumbPosition}px`, top: 0, width: `${thumbSize}px`, height: '100%' }
      : { top: `${thumbPosition}px`, left: 0, height: `${thumbSize}px`, width: '100%' }),
  };

  return (
    <div style={scrollbarStyle} ref={trackRef} onMouseDown={handleTrackClick}>
        <div
          ref={thumbRef}
          style={thumbStyle}
          onMouseDown={handleThumbMouseDown}
        />
    </div>
  );
};

export default CustomScrollbar;
