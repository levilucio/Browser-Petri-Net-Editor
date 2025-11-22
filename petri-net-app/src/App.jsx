import React, { useEffect, useState, useRef } from 'react';
import Toolbar from './components/Toolbar';
import PropertiesPanel from './components/PropertiesPanel';
import PetriNetPanel from './components/PetriNetPanel';
import SimulationManager from './features/simulation/SimulationManager';
import SettingsDialog from './components/SettingsDialog';
import CanvasManager from './features/canvas/CanvasManager';
import FloatingEditorControls from './components/FloatingEditorControls';
import { useElementManager } from './features/elements/useElementManager';
import { useKeyboardShortcuts } from './features/keymap/useKeyboardShortcuts';
import { useCanvasZoom } from './features/canvas/useCanvasZoom';
import { syncWindowGlobals } from './utils/testGlobals';

// Auto layout removed

import { PetriNetProvider, usePetriNet } from './contexts/PetriNetContext';
import { AdtProvider } from './contexts/AdtContext';
import { EditorUIProvider, useEditorUI } from './contexts/EditorUIContext';

const DEFAULT_MAX_STEPS = 200000;

// Create a wrapper component that provides the context
const AppContent = () => {
    const ZOOM_STEP = 0.1;
    // Get UI state from EditorUIContext
    const {
      stageDimensions,
      virtualCanvasDimensions,
      canvasScroll,
      setCanvasScroll,
      zoomLevel,
      setZoomLevel,
      gridSnappingEnabled,
      toggleGridSnapping,
      MIN_ZOOM,
      MAX_ZOOM,
      appRef,
      containerRef,
      setContainerRef,
      stageRef,
    } = useEditorUI();
    
    // Get core editor state from PetriNetContext
    const {
      elements, setElements,
      selectedElement, setSelectedElement,
      selectedElements,
      mode, setMode,
      arcStart, setArcStart,
      tempArcEnd, setTempArcEnd,
      clearSelection,
      setSelection,

      isSettingsDialogOpen, setIsSettingsDialogOpen,
      simulationSettings, setSimulationSettings,
      historyManagerRef,
      canUndo,
      canRedo,
      handleUndo,
      handleRedo,
      updateHistory,
      snapToGrid,
      resetEditor,
      simulatorCore,
      enabledTransitionIds,
      clipboardRef,
      setClipboard,
      getClipboard,
      isShiftPressedRef
    } = usePetriNet();

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const { localCanvasContainerDivRef, handleZoom, handleNativeCanvasScroll } = useCanvasZoom({
      MIN_ZOOM,
      MAX_ZOOM,
      zoomLevel,
      setZoomLevel,
      virtualCanvasDimensions,
      canvasScroll,
      setCanvasScroll,
      setContainerRef,
    });

    const { handleDeleteElement, clearAllElements } = useElementManager();

    // handleAutoLayout removed

    useEffect(() => {
      syncWindowGlobals({
        elements,
        selectedElements,
        mode,
        clipboardRef,
        simulationSettings,
        simulatorCore,
      });
    }, [
      elements.places,
      elements.transitions,
      elements.arcs,
      selectedElements,
      mode,
      simulationSettings?.useNonVisualRun,
      simulationSettings?.batchMode,
      simulationSettings?.limitIterations,
      simulationSettings?.maxIterations,
      clipboardRef,
      simulatorCore,
    ]);

    // Keyboard shortcuts: consolidate via useKeyboardShortcuts
    useKeyboardShortcuts({
      elements,
      setElements,
      selectedElement,
      selectedElements,
      clearSelection,
      setSelection,
      clipboardRef,
      netMode: simulationSettings?.netMode || 'pt',
      setClipboard,
      getClipboard,
      onClipboardMismatch: undefined,
      handleUndo,
      handleRedo,
      setMode,
      arcStart,
      setArcStart,
      setTempArcEnd,
      setSelectedElement,
      isShiftPressedRef,
    });

    return (
      <div ref={appRef} className="app-container h-screen max-h-screen overflow-hidden" tabIndex={-1}>
        {/* Mobile Sidebar Toggle */}
        <button
          className="fixed top-2.5 right-2 z-50 p-2 bg-white rounded-md shadow-md lg:hidden"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </button>

        {/* Toolbar - fixed at the top */}
        <div 
          className="fixed top-0 left-0 right-0 z-40 bg-white" 
          onWheel={(e) => e.stopPropagation()}
        >
          <Toolbar 
            mode={mode}
            setMode={setMode} 
            onNew={clearAllElements}
            onUndo={handleUndo} 
            canUndo={canUndo}   
            onRedo={handleRedo} 
            canRedo={canRedo}   
            
            gridSnappingEnabled={gridSnappingEnabled} 
            onToggleGridSnapping={toggleGridSnapping} 
            onOpenSettings={() => setIsSettingsDialogOpen(true)} 
            elements={elements}
            setElements={setElements}
            updateHistory={updateHistory}
            simulationSettings={simulationSettings}
            setSimulationSettings={setSimulationSettings}
            resetEditor={resetEditor}
          />
        </div>
        
        {/* RIGHT SIDE: Side panels with properties and execution controls */}
        <div 
          className={`fixed w-80 right-0 top-16 bottom-0 z-30 bg-gray-100 shadow-lg pt-4 flex flex-col overflow-hidden transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0`}
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Properties panel (scrollable top) */}
          <div className="overflow-y-auto pr-2">
            <PropertiesPanel 
              selectedElement={selectedElement} 
              elements={elements}
              setElements={setElements}
              updateHistory={updateHistory}
              simulationSettings={simulationSettings}
            />
          </div>

          {/* Petri Net panel in the middle, fills remaining space */}
          <div className="flex-1 overflow-y-auto pr-2 border-t-2 border-gray-200">
            <PetriNetPanel elements={elements} enabledTransitionIds={enabledTransitionIds} />
          </div>
          
          {/* Simulation Manager pinned at bottom */}
          <div className="border-t-2 border-gray-200 w-full"></div>
          <div className="mt-auto sticky bottom-0 bg-gray-100">
            <SimulationManager />
          </div>
        </div>
        
        {/* Canvas Area */}
        <div className="fixed top-20 left-0 bottom-0 right-0 lg:right-80 transition-all duration-300">
          <div 
            className="absolute inset-0 overflow-hidden stage-container bg-gray-200 dark:bg-gray-700"
            data-testid="canvas-container"
            ref={localCanvasContainerDivRef}
            onScroll={handleNativeCanvasScroll}
          >
            <CanvasManager handleZoom={handleZoom} ZOOM_STEP={ZOOM_STEP} />
          </div>
          {/* Zoom controls - hidden on mobile, visible on desktop */}
          <div className="hidden lg:flex fixed top-24 right-[336px] z-10 flex-col space-y-2 pointer-events-auto">
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
          <FloatingEditorControls />
        </div>
        
        {/* Settings Dialog */}
        <SettingsDialog 
          isOpen={isSettingsDialogOpen}
          onClose={() => setIsSettingsDialogOpen(false)}
        />
      </div>
    );
  };

const AppWrapper = () => (
  <AdtProvider>
    <EditorUIProvider>
      <PetriNetProvider>
        <AppContent />
      </PetriNetProvider>
    </EditorUIProvider>
  </AdtProvider>
);

export default AppWrapper;
