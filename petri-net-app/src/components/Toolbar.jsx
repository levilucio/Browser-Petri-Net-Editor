import React, { useState, useEffect, useMemo } from 'react';
import FileControls from './toolbar/FileControls.jsx';
import ModeButtons from './toolbar/ModeButtons.jsx';
import HistoryButtons from './toolbar/HistoryButtons.jsx';
import SettingsButton from './toolbar/SettingsButton.jsx';
import AdtDialog from './AdtDialog';
import ExamplesDialog from './ExamplesDialog';
import useToolbarActions from './toolbar/useToolbarActions';
import { usePetriNet } from '../contexts/PetriNetContext';

const Toolbar = ({ 
  mode, 
  setMode, 
  gridSnappingEnabled, 
  onToggleGridSnapping, 
  canUndo, 
  canRedo, 
  onUndo, 
  onRedo, 
  elements, 
  setElements, 
  updateHistory,
  simulationSettings,
  setSimulationSettings,
  simulationMode,
  setSimulationMode,
  isSimulating,
  startSimulation,
  stopSimulation,
  clearCanvas,
  onOpenSettings,
  resetEditor,
  debugConsoleRef
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isAdtOpen, setIsAdtOpen] = useState(false);
  const [isExamplesOpen, setIsExamplesOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Handlers moved to hook for clarity
  const { saveFileHandle, setSaveFileHandle } = (() => { try { return usePetriNet(); } catch (_) { return { saveFileHandle: null, setSaveFileHandle: () => {} }; } })();

  const { handleSave, handleSaveAs, handleLoad, handleClear, handleOpenAdtManager, handleLoadExample } = useToolbarActions({
    elements,
    setElements,
    updateHistory,
    simulationSettings,
    setSimulationSettings,
    resetEditor,
    setIsLoading,
    setError,
    setSuccess,
    setIsAdtOpen,
    saveFileHandle,
    setSaveFileHandle,
    setIsMobileMenuOpen,
  });

  const handleOpenExamples = () => {
    setIsExamplesOpen(true);
  };

  const handleSelectExample = (filename) => {
    handleLoadExample(filename);
  };
  
  // Auto-dismiss success messages after 2 seconds
  useEffect(() => {
    if (!success) return;
    const timeoutId = setTimeout(() => setSuccess(null), 2000);
    return () => clearTimeout(timeoutId);
  }, [success]);
  
  
  const mobileQuery = useMemo(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 1024px)')
      : null
  ), []);

  useEffect(() => {
    if (!mobileQuery) return;
    const handler = (event) => {
      if (event.matches) {
        setIsMobileMenuOpen(false);
      }
    };
    if (mobileQuery.addEventListener) {
      mobileQuery.addEventListener('change', handler);
    } else {
      mobileQuery.addListener(handler);
    }
    return () => {
      if (mobileQuery.removeEventListener) {
        mobileQuery.removeEventListener('change', handler);
      } else {
        mobileQuery.removeListener(handler);
      }
    };
  }, [mobileQuery]);

  const createButtonStyle = (variant = 'desktop') => (isSelected, buttonType = 'default') => {
    // For mobile/touch devices, use gradient styling with button types
    if (variant === 'mobile') {
      const colorSchemes = {
        file: {
          gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          hover: 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)',
          shadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
          hoverShadow: '0 6px 20px rgba(102, 126, 234, 0.5)',
        },
        settings: {
          gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          hover: 'linear-gradient(135deg, #e879f9 0%, #ef4444 100%)',
          shadow: '0 4px 15px rgba(245, 87, 108, 0.4)',
          hoverShadow: '0 6px 20px rgba(245, 87, 108, 0.5)',
        },
        adt: {
          gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          hover: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
          shadow: '0 4px 15px rgba(79, 172, 254, 0.4)',
          hoverShadow: '0 6px 20px rgba(79, 172, 254, 0.5)',
        },
        debug: {
          gradient: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
          hover: 'linear-gradient(135deg, #9333ea 0%, #db2777 100%)',
          shadow: '0 4px 15px rgba(168, 85, 247, 0.4)',
          hoverShadow: '0 6px 20px rgba(168, 85, 247, 0.5)',
        },
        default: {
          gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          hover: 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)',
          shadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
          hoverShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
        },
      };

      const scheme = colorSchemes[buttonType] || colorSchemes.default;

      return {
        padding: '0.5rem 1rem',
        borderRadius: '0.5rem',
        background: isSelected ? scheme.gradient : 'white',
        color: isSelected ? 'white' : '#374151',
        border: 'none',
        margin: '0 0 0.5rem 0',
        minWidth: '100%',
        width: '100%',
        fontSize: '0.8125rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        textAlign: 'center',
        height: '36px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.375rem',
        boxShadow: isSelected
          ? `${scheme.shadow}, inset 0 2px 4px rgba(255, 255, 255, 0.2)`
          : '0 2px 8px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
        position: 'relative',
        overflow: 'hidden',
        // Store scheme for hover effects
        '--scheme-gradient': scheme.gradient,
        '--scheme-hover': scheme.hover,
        '--scheme-shadow': scheme.shadow,
        '--scheme-hover-shadow': scheme.hoverShadow,
      };
    }

    // Desktop styling remains unchanged
    return {
      padding: '0.375rem 0.5rem',
      borderRadius: '0.25rem',
      backgroundColor: isSelected ? '#4338ca' : 'white',
      color: isSelected ? 'rgba(255, 255, 255, 0.85)' : 'rgba(31, 41, 55, 0.7)',
      border: isSelected ? '1px solid #3730a3' : '1px solid #d1d5db',
      borderBottom: isSelected ? '2px solid #312e81' : '2px solid #9ca3af',
      margin: '0 0.125rem',
      minWidth: '80px',
      width: '80px',
      fontSize: '0.75rem',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.15s ease-in-out',
      textAlign: 'center',
      height: '32px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: isSelected
        ? 'inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)'
        : 'inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 2px 4px rgba(0, 0, 0, 0.1)',
      position: 'relative',
      top: '0',
      transform: isSelected ? 'translateY(1px)' : 'translateY(0)',
      textShadow: isSelected
        ? '0 -1px 1px rgba(0, 0, 0, 0.5), 0 1px 0 rgba(255, 255, 255, 0.15)'
        : '0 1px 0 rgba(255, 255, 255, 0.5), 0 -1px 0 rgba(0, 0, 0, 0.2)',
    };
  };

  const desktopButtonStyle = useMemo(() => createButtonStyle('desktop'), []);
  const mobileButtonStyle = useMemo(() => createButtonStyle('mobile'), []);

  const separatorStyle = {
    width: '3px',
    backgroundColor: '#6b7280',
    margin: '0 15px',
    height: '36px',
    alignSelf: 'center',
    boxShadow: '0 0 3px rgba(0, 0, 0, 0.3)',
    display: 'block'
  };
  
  // Style for messages
  const messageStyle = (isError) => ({
    padding: '0.5rem',
    marginTop: '0.5rem',
    borderRadius: '0.25rem',
    backgroundColor: isError ? '#fee2e2' : '#d1fae5', // red-100 or green-100
    color: isError ? '#b91c1c' : '#047857', // red-700 or green-700
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.875rem'
  });

  const renderDesktopGroups = () => (
    <div className="hidden lg:flex items-start">
        {/* File Operations Group */}
        <div className="file-operations p-2">
          <h3 className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">File</h3>
          <FileControls 
            isLoading={isLoading} 
            onSave={handleSave} 
            onSaveAs={handleSaveAs}
            canSaveAs={true}
            onLoad={handleLoad} 
            onExamples={handleOpenExamples}
            onClear={handleClear} 
            buttonStyle={desktopButtonStyle} 
          />
        </div>
        
        {/* Visual separator - engraved effect */}
        <div className="h-full" style={{ 
          borderRight: '1px solid rgba(180, 180, 190, 0.9)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.9)',
          margin: '0 12px',
          height: '50px',
          alignSelf: 'center',
          opacity: 0.85
        }}></div>
        
        {/* Editing Tools Group */}
        <div className="editing-tools p-2">
          <h3 className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Editing</h3>
          <div className="flex items-center flex-wrap gap-2">
            {/* Grid Snapping Toggle */}
            <div className="flex items-center mr-4">
              <input
                type="checkbox"
                id="grid-snap-toggle"
                data-testid="grid-snap-toggle"
                checked={gridSnappingEnabled}
                onChange={onToggleGridSnapping}
                className="mr-1"
              />
              <label htmlFor="grid-snap-toggle" className="text-xs text-gray-700">Snap to Grid</label>
            </div>
            <ModeButtons mode={mode} setMode={setMode} buttonStyle={desktopButtonStyle} />
          </div>
        </div>
        
        {/* Visual separator between Editing and ADT Manager */}
        <div className="h-full" style={{ 
          borderRight: '1px solid rgba(180, 180, 190, 0.9)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.9)',
          margin: '0 12px',
          height: '50px',
          alignSelf: 'center',
          opacity: 0.85
        }}></div>
        
        {/* ADT Manager Group */}
        <div className="adt-tools p-2">
          <h3 className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">ADT Manager</h3>
          <div className="flex justify-between">
            <button
              style={desktopButtonStyle(false)}
              onClick={handleOpenAdtManager}
              title="Open ADT Manager"
              data-testid="toolbar-adt-manager"
            >
              ADT
            </button>
          </div>
        </div>

        {/* Visual separator between ADT Manager and History */}
        <div className="h-full" style={{ 
          borderRight: '1px solid rgba(180, 180, 190, 0.9)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.9)',
          margin: '0 12px',
          height: '50px',
          alignSelf: 'center',
          opacity: 0.85
        }}></div>

        {/* History Group */}
        <div className="history-tools p-2">
          <h3 className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">History</h3>
          <HistoryButtons canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} buttonStyle={desktopButtonStyle} />
        </div>
        
        {/* Visual separator between history and settings */}
        <div className="h-full" style={{ 
          borderRight: '1px solid rgba(180, 180, 190, 0.9)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.9)',
          margin: '0 12px',
          height: '50px',
          alignSelf: 'center',
          opacity: 0.85
        }}></div>
        
        {/* Settings Group */}
        <div className="settings-tools p-2 ml-auto">
          <h3 className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Settings</h3>
          <SettingsButton onOpenSettings={onOpenSettings} buttonStyle={desktopButtonStyle} />
        </div>
      </div>
  );

  const renderMobileGroups = () => (
    <div className="flex flex-col space-y-5">
      <div className="file-operations">
        <h3 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wider">File</h3>
        <FileControls
          isLoading={isLoading}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          canSaveAs={true}
          onLoad={handleLoad}
          onExamples={handleOpenExamples}
          onClear={handleClear}
          buttonStyle={mobileButtonStyle}
          isMobile={true}
        />
      </div>
      <div className="editing-tools">
        <h3 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wider">Editing</h3>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="grid-snap-toggle-mobile"
            data-testid="grid-snap-toggle-mobile"
            checked={gridSnappingEnabled}
            onChange={onToggleGridSnapping}
            className="mr-2"
          />
          <label htmlFor="grid-snap-toggle-mobile" className="text-sm text-gray-700">Snap to Grid</label>
        </div>
        {/* ModeButtons removed - now available as floating controls on canvas */}
      </div>
      <div className="adt-tools">
        <h3 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wider">ADT Manager</h3>
        <button
          className="menu-button-hover"
          style={mobileButtonStyle(false, 'adt')}
          onClick={() => {
            setIsMobileMenuOpen(false);
            handleOpenAdtManager();
          }}
          title="Open ADT Manager"
          data-testid="toolbar-adt-manager-mobile"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          ADT Manager
        </button>
      </div>
      <div className="settings-tools">
        <h3 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wider">Settings</h3>
        <SettingsButton
          onOpenSettings={() => {
            setIsMobileMenuOpen(false);
            onOpenSettings();
          }}
          buttonStyle={mobileButtonStyle}
          isMobile={true}
        />
      </div>
      <div className="debug-tools">
        <h3 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wider">Developer</h3>
        <button
          className="menu-button-hover"
          style={mobileButtonStyle(false, 'debug')}
          onClick={() => {
            if (debugConsoleRef?.current) {
              const currentlyEnabled = debugConsoleRef.current.isEnabled();
              if (currentlyEnabled) {
                debugConsoleRef.current.disable();
              } else {
                debugConsoleRef.current.enable();
              }
            }
            setIsMobileMenuOpen(false);
          }}
          title={debugConsoleRef?.current?.isEnabled() ? "Deactivate Debug Console" : "Activate Debug Console"}
          data-testid="debug-console-mobile"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {debugConsoleRef?.current?.isEnabled() ? 'Deactivate debug' : 'Activate debug'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        .menu-button-hover {
          transition: all 0.1s ease-out;
          -webkit-tap-highlight-color: transparent;
        }
        .menu-button-hover:active {
          transform: scale(0.88) !important;
          filter: brightness(0.8);
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.1) !important;
        }
        @media (hover: hover) and (pointer: fine) {
          .menu-button-hover:hover {
            transform: translateY(-1px) scale(1.01);
            box-shadow: var(--scheme-hover-shadow, 0 6px 20px rgba(0, 0, 0, 0.15)) !important;
          }
        }
      `}</style>
      <div className="toolbar-container flex flex-col p-2 bg-gray-50 border-b border-gray-200 shadow-sm" style={{ minHeight: '70px' }}>
      <div className="hidden lg:block">
        {renderDesktopGroups()}
      </div>
      <div className="lg:hidden flex items-center gap-3 px-2 py-1">
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 shadow-sm bg-white font-semibold text-gray-700"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Open toolbar menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span>Menu</span>
        </button>
        
        {/* Undo/Redo Group */}
        <div className="flex items-center gap-2 ml-2">
          <button
            type="button"
            className={`p-2 rounded-md border border-gray-200 shadow-sm bg-white text-gray-700 transition-all ${!canUndo ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 active:scale-95'}`}
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo"
            aria-label="Undo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
          </button>
          <button
            type="button"
            className={`p-2 rounded-md border border-gray-200 shadow-sm bg-white text-gray-700 transition-all ${!canRedo ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 active:scale-95'}`}
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo"
            aria-label="Redo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* ADT Dialog */}
      {isAdtOpen && (
        <AdtDialog isOpen={isAdtOpen} onClose={() => setIsAdtOpen(false)} />
      )}

      {/* Examples Dialog */}
      <ExamplesDialog 
        isOpen={isExamplesOpen} 
        onClose={() => setIsExamplesOpen(false)} 
        onSelectExample={handleSelectExample}
      />

      {/* Messages */}
      {error && (
        <div style={messageStyle(true)}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '0.5rem' }}>×</button>
        </div>
      )}
      {success && (
        <div style={messageStyle(false)}>
          {success}
          <button onClick={() => setSuccess(null)} style={{ marginLeft: '0.5rem' }}>×</button>
        </div>
      )}

      {/* Left-side drawer - always rendered for smooth animation */}
      <div className="lg:hidden fixed inset-0 z-50 pointer-events-none">
        {/* Backdrop */}
        <div 
          className={`absolute inset-0 bg-black transition-opacity duration-300 ease-in-out ${isMobileMenuOpen ? 'opacity-40 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setIsMobileMenuOpen(false)} 
        />
        {/* Left-side drawer */}
        <div 
          className={`fixed w-72 left-0 top-16 bottom-0 z-50 bg-gradient-to-b from-gray-50 to-white backdrop-blur-sm shadow-2xl overflow-y-auto transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} pointer-events-auto border-r border-gray-200`}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="p-4">
            <div className="mb-6 border-b border-gray-200 pb-3">
              <h2 className="text-xl font-bold text-gray-800">Menu</h2>
            </div>
            {renderMobileGroups()}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default Toolbar;
