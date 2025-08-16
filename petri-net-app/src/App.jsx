import React, { useEffect, useState, useRef } from 'react';
// Konva imports removed as CanvasManager handles them
import Toolbar from './components/Toolbar';
import PropertiesPanel from './components/PropertiesPanel';
import SimulationManager from './features/simulation/SimulationManager';
// Element/Grid components imports removed as CanvasManager handles them
import SettingsDialog from './components/SettingsDialog';
import { v4 as uuidv4 } from 'uuid'; // Keep for element creation if any remains here, or for other UUID needs.
import CanvasManager from './features/canvas/CanvasManager'; // Import CanvasManager
import { useElementManager } from './features/elements/useElementManager'; // Import the new hook

import { applyAutoLayout } from './utils/autoLayout';

import { PetriNetProvider, usePetriNet } from './contexts/PetriNetContext';

// Create a wrapper component that provides the context
const AppWrapper = () => {
  // Define AppContent inside AppWrapper to ensure context is available
  const AppContent = () => {
    const ZOOM_STEP = 0.1;
    const localCanvasContainerDivRef = useRef(null);
    const programmaticScrollRef = useRef(false);
    const {
      elements, setElements,
      selectedElement, setSelectedElement,
      mode, setMode,
      arcStart, setArcStart,
      tempArcEnd, setTempArcEnd,

      isSettingsDialogOpen, setIsSettingsDialogOpen,
      simulationSettings, setSimulationSettings,
      stageDimensions, setStageDimensions,
      virtualCanvasDimensions, setVirtualCanvasDimensions,
      canvasScroll, setCanvasScroll,
      zoomLevel, setZoomLevel,
      gridSnappingEnabled, toggleGridSnapping,
      gridSize,
      MIN_ZOOM, // Added MIN_ZOOM from context
      MAX_ZOOM, // Added MAX_ZOOM from context
      historyManagerRef, // Direct access to ref, consider if needed
      canUndo, // Removed setCanUndo, managed by context
      canRedo, // Removed setCanRedo, managed by context
      handleUndo, // Use context action
      handleRedo, // Use context action
      updateHistory, // Use context action
      snapToGrid, // Use context utility
      appRef, // Context ref
      containerRef, // Context ref (value)
      setContainerRef, // Context ref setter
      stageRef, // Context ref

      handleSaveSettings // Function from context
    } = usePetriNet();

    const { handleDeleteElement, clearAllElements } = useElementManager();

    // Removed draggedElement state, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP constants - managed by CanvasManager
    // Removed expansionThreshold, expansionAmount constants - managed by CanvasManager or context
    // Removed handleAddAnglePoint, handleDragAnglePoint, handleDeleteAnglePoint - managed by CanvasManager
    // Removed useEffect for virtualCanvasDimensions update - this logic should be in context or CanvasManager if dependent on its state

    // Function to handle auto-layout of Petri net elements
    const handleAutoLayout = () => {
      if (!elements || (!elements.places.length && !elements.transitions.length)) {
        // console.log("Auto-layout skipped: No elements to layout.");
        return;
      }
      if (!virtualCanvasDimensions || !virtualCanvasDimensions.width || !virtualCanvasDimensions.height) {
        console.error("Auto-layout skipped: Virtual canvas dimensions are not available.");
        return;
      }
      
      const layoutDimensions = {
        width: virtualCanvasDimensions.width,
        height: virtualCanvasDimensions.height,
      };
      
      // Ensure applyAutoLayout is imported: import { applyAutoLayout } from './utils/autoLayout';
      // Ensure applyAutoLayout is imported: import { applyAutoLayout } from './utils/autoLayout';
      // TODO: Make sure applyAutoLayout is actually imported at the top of the file.
      try {
        const newElementsState = applyAutoLayout(
          JSON.parse(JSON.stringify(elements)), 
          layoutDimensions
        );
        setElements(newElementsState);
        updateHistory(newElementsState);
      } catch (error) {
        console.error("Error during auto-layout:", error);
      }
    };

    // Expose Petri net state for e2e testing
    useEffect(() => {
      // Always expose state for tests, regardless of environment
      window.__PETRI_NET_STATE__ = {
        places: elements.places,
        transitions: elements.transitions,
        arcs: elements.arcs
      };
    }, [elements.places, elements.transitions, elements.arcs]);

    // Removed handleScroll and handleZoom functions - managed by CanvasManager

    // Removed useEffect for updateDimensions (window resize) - managed by CanvasManager
    // Removed useEffect for wheel event listener - managed by CanvasManager

    const handleZoom = (delta) => { // Removed 'point' as it's not used by buttons
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
          
          setCanvasScroll({
            x: newScrollX,
            y: newScrollY
          });
        }
        return newZoomLevel;
      });
    };

    const handleNativeCanvasScroll = (event) => {
      if (programmaticScrollRef.current) {
        programmaticScrollRef.current = false; // Reset the flag
        return; // Ignore programmatically triggered scroll events
      }
      console.log('Native scroll event:', event.target.scrollLeft, event.target.scrollTop);
      if (setCanvasScroll) {
        setCanvasScroll({
          x: event.target.scrollLeft,
          y: event.target.scrollTop,
        });
      }
    };

    // Effect to synchronize native scroll position with canvasScroll state
    useEffect(() => {
      if (localCanvasContainerDivRef.current) {
        programmaticScrollRef.current = true; // Set flag before programmatic scroll
        
        if (localCanvasContainerDivRef.current.scrollLeft !== canvasScroll.x) {
          localCanvasContainerDivRef.current.scrollLeft = canvasScroll.x;
        }
        if (localCanvasContainerDivRef.current.scrollTop !== canvasScroll.y) {
          localCanvasContainerDivRef.current.scrollTop = canvasScroll.y;
        }
      }
      // It's important to reset the flag if the effect completes without scrolling,
      // or ensure it's reset by the scroll handler. Here, we rely on the scroll handler.
      // requestAnimationFrame(() => { programmaticScrollRef.current = false; }); // Alternative reset, but handler reset is cleaner
    }, [canvasScroll, localCanvasContainerDivRef]);

    // Effect to update the containerRef in context when the local div ref is mounted
    useEffect(() => {
      if (localCanvasContainerDivRef.current && setContainerRef) {
        setContainerRef(localCanvasContainerDivRef.current);
      }
    }, [localCanvasContainerDivRef, setContainerRef]);

    const handleFileOpen = async (event) => {
      console.warn("handleFileOpen function called - placeholder, no action.");
      // Actual implementation would involve reading file content and calling setElements
      // Example: const file = event.target.files[0]; ... reader.onload ... setElements(...);
    };

    const handleFileSave = () => {
      console.warn("handleFileSave function called - placeholder, no action.");
      // Actual implementation would involve creating a JSON file from 'elements' and triggering download
    };

    // Handle scroll events on fixed elements without using preventDefault
    const handlePreventScroll = (e) => {
      // Only use stopPropagation as preventDefault causes errors with passive listeners
      e.stopPropagation();
      // We can control scrolling behavior through CSS instead
    };

    const handleKeyDown = (event) => {
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable) {
        return; // Don't interfere with text input
      }

      if (event.ctrlKey) {
        if (event.key === 'z' || event.key === 'Z') {
          event.preventDefault();
          handleUndo();
        } else if (event.key === 'y' || event.key === 'Y') {
          event.preventDefault();
          handleRedo();
        }
      } else {
        switch (event.key) {
          case 'Delete':
          case 'Backspace':
            if (selectedElement) {
              event.preventDefault();
              handleDeleteElement();
            }
            break;
          case 'p': case 'P':
            event.preventDefault(); setMode('place'); break;
          case 't': case 'T':
            event.preventDefault(); setMode('transition'); break;
          case 'a': case 'A':
            event.preventDefault(); setMode('arc'); break;
          case 's': case 'S': 
            event.preventDefault(); setMode('select'); break;
          case 'Escape':
            event.preventDefault();
            setMode('select');
            if (arcStart) {
              setArcStart(null);
              setTempArcEnd(null);
            }
            setSelectedElement(null);
            break;
          default: break;
        }
      }
    };

    return (
      <div ref={appRef} className="app-container h-screen max-h-screen overflow-hidden" tabIndex={-1} onKeyDown={handleKeyDown}>
        {/* Toolbar - fixed at the top */}
        <div 
          className="fixed top-0 left-0 right-0 z-30 bg-white" 
          onWheel={handlePreventScroll}
        >
          <Toolbar 
            mode={mode}
            setMode={setMode} 
            onNew={clearAllElements}
            onOpen={handleFileOpen}
            onSave={handleFileSave}
            onUndo={handleUndo} 
            canUndo={canUndo}   
            onRedo={handleRedo} 
            canRedo={canRedo}   
            onAutoLayout={handleAutoLayout}
            gridSnappingEnabled={gridSnappingEnabled} 
            onToggleGridSnapping={toggleGridSnapping} 
            onOpenSettings={() => setIsSettingsDialogOpen(true)} 
            elements={elements}
            setElements={setElements}
            updateHistory={updateHistory}
          />
        </div>
        
        {/* RIGHT SIDE: Side panels with properties and execution controls */}
        <div 
          className="fixed w-80 right-0 top-16 bottom-0 z-10 bg-gray-100 overflow-y-auto shadow-lg pt-4"
          onWheel={handlePreventScroll}
        >
          {/* Properties panel */}
          <PropertiesPanel 
            selectedElement={selectedElement} 
            elements={elements}
            setElements={setElements}
            updateHistory={updateHistory}
            simulationSettings={simulationSettings}
          />
          
          {/* Simulation Manager */}
          <div className="border-t-2 border-gray-200 w-full"></div>
          <SimulationManager />
        </div>
        
        {/* Canvas Area - positioned in the remaining space with its own scrolling context */}
        <div className="fixed top-16 left-0 right-80 bottom-0">
          {/* Scrollable canvas container */}
          <div 
            className="absolute inset-0 overflow-auto stage-container bg-gray-200 dark:bg-gray-700"
            data-testid="canvas-container"
            ref={localCanvasContainerDivRef}
            onScroll={handleNativeCanvasScroll}
          >
            <CanvasManager handleZoom={handleZoom} ZOOM_STEP={ZOOM_STEP} />
          </div>
          
          {/* Zoom controls - fixed position in the right side of the canvas area, properly positioned below the toolbar */}
          <div className="fixed top-24 right-[336px] z-20 flex flex-col space-y-2">
            <button 
              className="bg-white p-2 rounded-full shadow-md hover:bg-gray-100 focus:outline-none"
              onClick={() => handleZoom(ZOOM_STEP)}
              title="Zoom In"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
            <button 
              className="bg-white p-2 rounded-full shadow-md hover:bg-gray-100 focus:outline-none"
              onClick={() => handleZoom(-ZOOM_STEP)}
              title="Zoom Out"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
              </svg>
            </button>
            <button 
              className="bg-white p-2 rounded-full shadow-md hover:bg-gray-100 focus:outline-none text-xs font-mono"
              onClick={() => {
                setZoomLevel(1.0);
                setCanvasScroll({ x: 0, y: 0 }); 
              }}
              title="Reset Zoom"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
          </div>
        </div>
        
        {/* Settings Dialog */}
        <SettingsDialog 
          isOpen={isSettingsDialogOpen}
          onClose={() => setIsSettingsDialogOpen(false)}
          settings={simulationSettings}
          onSave={handleSaveSettings}
        />
      </div>
    );
  };

  return (
    <PetriNetProvider>
      <AppContent />
    </PetriNetProvider>
  );
};

// Export the wrapper as the main App component
export default AppWrapper;
