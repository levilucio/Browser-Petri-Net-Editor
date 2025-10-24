import React, { useState, useEffect } from 'react';
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
  
  
  // Styles for the separator
  const separatorStyle = {
    width: '3px',
    backgroundColor: '#6b7280', // gray-500 for even better visibility
    margin: '0 15px',
    height: '36px', // Fixed height to match buttons
    alignSelf: 'center', // Center in container
    boxShadow: '0 0 3px rgba(0, 0, 0, 0.3)', // Stronger shadow for depth
    display: 'block' // Ensure it's displayed as a block element
  };

  // Common button style
  const buttonStyle = (isSelected) => ({
    padding: '0.375rem 0.5rem',
    borderRadius: '0.25rem',
    backgroundColor: isSelected ? '#4338ca' : 'white', // indigo-700 or white
    color: isSelected ? 'rgba(255, 255, 255, 0.85)' : 'rgba(31, 41, 55, 0.7)', // Slightly less faded text
    border: isSelected ? '1px solid #3730a3' : '1px solid #d1d5db', // border color
    borderBottom: isSelected ? '2px solid #312e81' : '2px solid #9ca3af', // darker bottom border for 3D effect
    margin: '0 0.125rem', // Tighter spacing between buttons
    minWidth: '80px', // Fixed minimum width for all buttons
    width: '80px', // Fixed width for all buttons
    fontSize: '0.75rem', // Smaller font size
    fontWeight: 600, // Bolder text for better visibility
    cursor: 'pointer',
    transition: 'all 0.15s ease-in-out',
    textAlign: 'center',
    height: '28px', // Fixed height for all buttons
    boxShadow: isSelected ? 
      'inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)' : 
      'inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 2px 4px rgba(0, 0, 0, 0.1)', // Inner highlight and outer shadow
    position: 'relative',
    top: '0',
    transform: isSelected ? 'translateY(1px)' : 'translateY(0)', // Pressed effect for selected buttons
    textShadow: isSelected ? 
      '0 -1px 1px rgba(0, 0, 0, 0.5), 0 1px 0 rgba(255, 255, 255, 0.15)' : // Carved-in effect for selected buttons
      '0 1px 0 rgba(255, 255, 255, 0.5), 0 -1px 0 rgba(0, 0, 0, 0.2)', // Engraved effect for non-selected buttons
  });
  
  // Open in-app ADT dialog
  // Open ADT dialog now handled by hook

  // Additional style for button hover state - will be applied via JavaScript
  document.addEventListener('DOMContentLoaded', () => {
    // Add hover effects to all buttons in the toolbar
    const buttons = document.querySelectorAll('.toolbar button');
    buttons.forEach(button => {
      button.addEventListener('mouseenter', () => {
        if (!button.disabled) {
          button.style.boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 3px 5px rgba(0, 0, 0, 0.15)';
          button.style.transform = 'translateY(-1px)';
          // Brighten text slightly on hover
          const isSelected = button.classList.contains('selected');
          button.style.color = isSelected ? 'rgba(255, 255, 255, 0.9)' : 'rgba(31, 41, 55, 0.8)';
        }
      });
      button.addEventListener('mouseleave', () => {
        const isSelected = button.classList.contains('selected');
        button.style.boxShadow = isSelected ? 
          'inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)' : 
          'inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 2px 4px rgba(0, 0, 0, 0.1)';
        button.style.transform = isSelected ? 'translateY(1px)' : 'translateY(0)';
        // Return to original text color
        button.style.color = isSelected ? 'rgba(255, 255, 255, 0.85)' : 'rgba(31, 41, 55, 0.7)';
      });
      button.addEventListener('mousedown', () => {
        if (!button.disabled) {
          button.style.transform = 'translateY(1px)';
          button.style.boxShadow = 'inset 0 1px 3px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.1)';
          // Darken text slightly when pressed
          const isSelected = button.classList.contains('selected');
          button.style.color = isSelected ? 'rgba(255, 255, 255, 0.75)' : 'rgba(31, 41, 55, 0.6)';
          button.style.textShadow = 'none'; // Remove text shadow when pressed
        }
      });
      button.addEventListener('mouseup', () => {
        if (!button.disabled) {
          button.style.transform = 'translateY(-1px)';
          button.style.boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 3px 5px rgba(0, 0, 0, 0.15)';
          // Brighten text slightly when released
          const isSelected = button.classList.contains('selected');
          button.style.color = isSelected ? 'rgba(255, 255, 255, 0.9)' : 'rgba(31, 41, 55, 0.8)';
          // Restore text shadow
          button.style.textShadow = isSelected ? 
            '0 -1px 1px rgba(0, 0, 0, 0.5), 0 1px 0 rgba(255, 255, 255, 0.15)' : 
            '0 1px 0 rgba(255, 255, 255, 0.5), 0 -1px 0 rgba(0, 0, 0, 0.2)';
        }
      });
    });
  });

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

  return (
    <div className="toolbar-container flex flex-col p-2 bg-gray-50 border-b border-gray-200 shadow-sm" style={{ minHeight: '70px' }}>
      <div className="flex items-start">
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
            buttonStyle={buttonStyle} 
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
          <div className="flex items-center">
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
            <ModeButtons mode={mode} setMode={setMode} buttonStyle={buttonStyle} />
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
              style={buttonStyle(false)}
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
          <HistoryButtons canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} buttonStyle={buttonStyle} />
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
          <SettingsButton onOpenSettings={onOpenSettings} buttonStyle={buttonStyle} />
        </div>
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
    </div>
  );
};

export default Toolbar;
