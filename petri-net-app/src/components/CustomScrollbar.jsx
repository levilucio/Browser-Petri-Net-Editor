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
          const maxScroll = Math.max(0, contentSize - viewportSize);
          const maxThumbPosition = Math.max(0, trackSize - thumbSize);
          
          const mousePosition = isHorizontal ? e.clientX - left : e.clientY - top;
          let newScrollPosition = ((mousePosition - thumbSize / 2) / maxThumbPosition) * maxScroll;
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
        const maxScroll = Math.max(0, contentSize - viewportSize);
        const maxThumbPosition = Math.max(0, trackSize - thumbSize);

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
  const calculatedThumbSize = trackSize > 0 ? trackSize * (viewportSize / contentSize) : 0;
  const thumbSize = Math.max(20, Math.min(calculatedThumbSize, trackSize));
  const maxScroll = Math.max(0, contentSize - viewportSize);
  const maxThumbPosition = Math.max(0, trackSize - thumbSize);
  // Clamp thumb position; allow exact 0 and max alignment
  const safeScroll = Math.max(0, Math.min(scrollPosition, maxScroll));
  const thumbPosition = maxScroll > 0 ? Math.min((safeScroll / maxScroll) * maxThumbPosition, maxThumbPosition) : 0;

  const toolbarOffset = 0; // no offset; Canvas container already sits below toolbar
  const rightSidebarOffset = 0; // no offset inside canvas container
  const scrollbarStyle = {
    position: 'absolute',
    zIndex: 50,
    padding: 0,
    margin: 0,
    ...(isHorizontal
      ? { left: '0px', right: '0px', bottom: '0px', height: '10px' }
      : { top: '0px', bottom: '0px', right: '0px', width: '10px' }),
  };

  const trackStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: '6px',
    overflow: 'hidden',
  };

  const thumbStyle = {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: '6px',
    cursor: 'pointer',
    willChange: 'transform',
    ...(isHorizontal
      ? { left: `${Math.round(thumbPosition)}px`, top: '0px', width: `${Math.round(thumbSize)}px`, height: '100%' }
      : { top: `${Math.round(thumbPosition)}px`, left: '0px', height: `${Math.round(thumbSize)}px`, width: '100%' }),
  };

  return (
    <div style={scrollbarStyle}>
        <div
          ref={trackRef}
          style={trackStyle}
          onMouseDown={handleTrackClick}
        >
          <div
            ref={thumbRef}
            style={thumbStyle}
            onMouseDown={handleThumbMouseDown}
          />
        </div>
    </div>
  );
};

export default CustomScrollbar;
