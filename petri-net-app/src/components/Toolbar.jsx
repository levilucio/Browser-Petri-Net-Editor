import React, { useState, useEffect, useMemo } from 'react';
import FileControls from './toolbar/FileControls.jsx';
import ModeButtons from './toolbar/ModeButtons.jsx';
import HistoryButtons from './toolbar/HistoryButtons.jsx';
import SettingsButton from './toolbar/SettingsButton.jsx';
import AdtDialog from './AdtDialog';
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
  resetEditor
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isAdtOpen, setIsAdtOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Handlers moved to hook for clarity
  const { saveFileHandle, setSaveFileHandle } = (() => { try { return usePetriNet(); } catch (_) { return { saveFileHandle: null, setSaveFileHandle: () => {} }; } })();

  const { handleSave, handleSaveAs, handleLoad, handleClear, handleOpenAdtManager } = useToolbarActions({
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
  });
  
  // Auto-dismiss success messages after 5 seconds
  useEffect(() => {
    if (!success) return;
    const timeoutId = setTimeout(() => setSuccess(null), 5000);
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

  const createButtonStyle = (variant = 'desktop') => (isSelected) => ({
    padding: '0.375rem 0.5rem',
    borderRadius: '0.25rem',
    backgroundColor: isSelected ? '#4338ca' : 'white',
    color: isSelected ? 'rgba(255, 255, 255, 0.85)' : 'rgba(31, 41, 55, 0.7)',
    border: isSelected ? '1px solid #3730a3' : '1px solid #d1d5db',
    borderBottom: isSelected ? '2px solid #312e81' : '2px solid #9ca3af',
    margin: variant === 'mobile' ? '0 0 0.5rem 0' : '0 0.125rem',
    minWidth: variant === 'mobile' ? '100%' : '80px',
    width: variant === 'mobile' ? '100%' : '80px',
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
  });

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
            canSaveAs={!!saveFileHandle}
            onLoad={handleLoad} 
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
    <div className="flex flex-col space-y-6">
      <div className="file-operations">
        <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">File</h3>
        <FileControls
          isLoading={isLoading}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          canSaveAs={!!saveFileHandle}
          onLoad={handleLoad}
          onClear={handleClear}
          buttonStyle={mobileButtonStyle}
        />
      </div>
      <div className="editing-tools">
        <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">Editing</h3>
        <div className="flex flex-col gap-3">
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
          <ModeButtons mode={mode} setMode={setMode} buttonStyle={mobileButtonStyle} />
        </div>
      </div>
      <div className="adt-tools">
        <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">ADT Manager</h3>
        <button
          style={mobileButtonStyle(false)}
          onClick={() => {
            setIsMobileMenuOpen(false);
            handleOpenAdtManager();
          }}
          title="Open ADT Manager"
          data-testid="toolbar-adt-manager-mobile"
        >
          ADT
        </button>
      </div>
      <div className="history-tools">
        <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">History</h3>
        <HistoryButtons
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo}
          onRedo={onRedo}
          buttonStyle={mobileButtonStyle}
        />
      </div>
      <div className="settings-tools">
        <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">Settings</h3>
        <SettingsButton
          onOpenSettings={() => {
            setIsMobileMenuOpen(false);
            onOpenSettings();
          }}
          buttonStyle={mobileButtonStyle}
        />
      </div>
    </div>
  );

  return (
    <div className="toolbar-container flex flex-col p-2 bg-gray-50 border-b border-gray-200 shadow-sm" style={{ minHeight: '70px' }}>
      <div className="hidden lg:block">
        {renderDesktopGroups()}
      </div>
      <div className="lg:hidden flex items-center justify-between px-1">
        <div>
          <p className="text-sm font-semibold text-gray-700">Editor Controls</p>
          <p className="text-xs text-gray-500">Tap to open full toolbar</p>
        </div>
        <button
          className="p-2 rounded-md border border-gray-200 shadow-sm bg-white"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Open toolbar menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
      
      {/* ADT Dialog */}
      {isAdtOpen && (
        <AdtDialog isOpen={isAdtOpen} onClose={() => setIsAdtOpen(false)} />
      )}

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

      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black bg-opacity-40" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute top-12 left-0 right-0 mx-4 bg-white rounded-2xl shadow-2xl p-5 max-h-[calc(100vh-100px)] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Toolbar</h2>
              <button
                className="p-2 rounded-full bg-gray-100 hover:bg-gray-200"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close toolbar menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {renderMobileGroups()}
          </div>
        </div>
      )}
    </div>
  );
};

export default Toolbar;
