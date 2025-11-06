import React, { createContext, useContext, useState, useRef } from 'react';

export const EditorUIContext = createContext();

export const EditorUIProvider = ({ children }) => {
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 3.0;

  // UI state: zoom, scroll, grid
  const [stageDimensions, setStageDimensions] = useState({ width: 800, height: 600 });
  const [virtualCanvasDimensions, setVirtualCanvasDimensions] = useState({ width: 10000, height: 7500 });
  const [canvasScroll, setCanvasScroll] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [gridSnappingEnabled, setGridSnappingEnabled] = useState(true);
  const gridSize = 20;

  // UI refs
  const appRef = useRef(null);
  const [containerRefValue, setContainerRefValue] = useState(null);
  const stageRef = useRef(null);

  // UI state tracking
  const [isDragging, setIsDragging] = useState(false);
  const [snapIndicator, setSnapIndicator] = useState({ visible: false, position: null, elementType: null });
  const prevModeRef = useRef('select');

  const toggleGridSnapping = () => {
    setGridSnappingEnabled(prev => !prev);
  };

  const value = {
    // Dimensions
    stageDimensions,
    setStageDimensions,
    virtualCanvasDimensions,
    setVirtualCanvasDimensions,
    canvasScroll,
    setCanvasScroll,
    zoomLevel,
    setZoomLevel,
    
    // Grid
    gridSnappingEnabled,
    toggleGridSnapping,
    gridSize,
    
    // Zoom limits
    MIN_ZOOM,
    MAX_ZOOM,
    
    // Refs
    appRef,
    containerRef: containerRefValue,
    setContainerRef: setContainerRefValue,
    stageRef,
    
    // UI state
    isDragging,
    setIsDragging,
    snapIndicator,
    setSnapIndicator,
    prevModeRef,
  };

  return (
    <EditorUIContext.Provider value={value}>
      {children}
    </EditorUIContext.Provider>
  );
};

export const useEditorUI = () => {
  const context = useContext(EditorUIContext);
  if (context === undefined) {
    throw new Error('useEditorUI must be used within an EditorUIProvider');
  }
  return context;
};

