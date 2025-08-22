import React, { useState, useEffect } from 'react';
import { exportToPNML, importFromPNML } from '../utils/python/index';
// Import icons for simulation controls
import { simulatorCore } from '../features/simulation';

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
  simulationMode,
  setSimulationMode,
  isSimulating,
  startSimulation,
  stopSimulation,
  clearCanvas,
  onAutoLayout,
  onOpenSettings
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Auto-dismiss success messages after 5 seconds
  useEffect(() => {
    if (!success) return;
    const timeoutId = setTimeout(() => setSuccess(null), 5000);
    return () => clearTimeout(timeoutId);
  }, [success]);
  
  // Function to handle saving the Petri net as PNML XML
  const handleSave = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      
      // Convert the Petri net to PNML
      const pnmlString = await exportToPNML(elements);
      
      // Create a blob and download link
      const blob = new Blob([pnmlString], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      
      // Create a download link and trigger it
      const a = document.createElement('a');
      a.href = url;
      a.download = 'petri-net.pnml';
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Show success message
      setSuccess('Petri net saved successfully as PNML file.');
    } catch (error) {
      console.error('Error saving Petri net:', error);
      setError(`Error saving Petri net: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to handle loading a Petri net from PNML XML
  const handleLoad = () => {
    // Create a file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pnml,.xml';
    
    // Handle file selection
    fileInput.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      try {
        setIsLoading(true);
        setError(null);
        setSuccess(null);
        
        // Read the file
        const fileContent = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsText(file);
        });
        
        // Validate that the file content is not empty
        if (!fileContent || fileContent.trim() === '') {
          throw new Error('The selected file is empty');
        }
        
        // Basic XML validation
        if (!fileContent.includes('<pnml') && !fileContent.includes('<PNML')) {
          throw new Error('The file does not appear to be a valid PNML file');
        }
        
        // File content loaded, converting PNML to JSON
        
        // Convert the PNML to JSON with a timeout to prevent UI freezing
        const petriNetJsonPromise = importFromPNML(fileContent);
        
        // Set a timeout to detect if the operation is taking too long
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Operation timed out. The file may be too large or invalid.')), 10000);
        });
        
        // Race the promises to handle timeouts
        const petriNetJson = await Promise.race([petriNetJsonPromise, timeoutPromise]);
        
        // PNML converted to JSON successfully
        
        // Validate the result structure
        if (!petriNetJson || typeof petriNetJson !== 'object') {
          throw new Error('Invalid data structure in the imported file');
        }
        
        // Use our arc debugging tool if available
        if (window.analyzePNML) {
          // Running enhanced PNML analysis on the imported file
          const analysis = window.analyzePNML(fileContent);
          // Analysis complete
          // Enhanced PNML analysis completed
          
          // Check for specific arc issues
          if (analysis && analysis.differences && analysis.differences.foundButNotParsed.length > 0) {
            console.warn(`Warning: ${analysis.differences.foundButNotParsed.length} arcs were found in the PNML but not properly parsed`);
          }
          
          // Try to recover arcs if our analysis found more than the parser did
          if (analysis && analysis.directAnalysis.arcs > 0 && 
             (petriNetJson.arcs.length === 0 || analysis.directAnalysis.arcs > petriNetJson.arcs.length)) {
            // Attempting to recover missing arcs from direct analysis
            const recoveredArcs = analysis.directAnalysis.details.map(arc => ({
              id: arc.id,
              source: arc.source,
              target: arc.target,
              type: arc.type || 'place-to-transition', // Default type if unknown
              weight: 1,
              sourceDirection: 'north',
              targetDirection: 'south'
            }));
            
            // Add recovered arcs to the result - create a new object instead of reassigning
            const enhancedPetriNetJson = {
              places: petriNetJson.places || [],
              transitions: petriNetJson.transitions || [],
              arcs: recoveredArcs
            };
            
            // Use the enhanced version from now on
            // Recovered arcs from direct analysis
            
            // Continue with the enhanced version
            return enhancedPetriNetJson;
          }
        }
        
        // Ensure the required arrays exist
        const safeJson = {
          places: Array.isArray(petriNetJson.places) ? petriNetJson.places : [],
          transitions: Array.isArray(petriNetJson.transitions) ? petriNetJson.transitions : [],
          arcs: Array.isArray(petriNetJson.arcs) ? petriNetJson.arcs : []
        };
        
        // About to update Petri net state
        
        // Verify the structure of the imported data
        if (safeJson.places && safeJson.places.length > 0) {
          // Places found in imported file
          // First place processed
        } else {
          console.warn('No places found in imported data');
        }
        
        if (safeJson.transitions && safeJson.transitions.length > 0) {
          // Transitions found in imported file
          // First transition processed
        } else {
          console.warn('No transitions found in imported data');
        }
        
        if (safeJson.arcs && safeJson.arcs.length > 0) {
          // Arcs found before validation
          // First arc processed
          
          // Filter out arcs with undefined or invalid source/target
          const validArcs = safeJson.arcs.filter(arc => {
            // Skip arcs with undefined or missing source/target
            if (arc.source === 'undefined' || arc.target === 'undefined' || 
                !arc.source || !arc.target) {
              console.warn(`Skipping invalid arc ${arc.id} - has undefined or missing source/target`);
              return false;
            }
            
            // Skip arcs with source/target that don't reference existing places/transitions
            const sourceExists = safeJson.places.some(p => p.id === arc.source) || 
                             safeJson.transitions.some(t => t.id === arc.source);
            const targetExists = safeJson.places.some(p => p.id === arc.target) || 
                             safeJson.transitions.some(t => t.id === arc.target);
            
            if (!sourceExists || !targetExists) {
              console.warn(`Skipping invalid arc ${arc.id} - references non-existent elements`);
              return false;
            }
            
            return true;
          });
          
          // Filtered out invalid arcs
          safeJson.arcs = validArcs;
          // Valid arcs count after filtering
          
          // Ensure all arcs have a valid type property
          safeJson.arcs = safeJson.arcs.map(arc => {
            if (!arc.type || (arc.type !== 'place-to-transition' && arc.type !== 'transition-to-place')) {
              // Try to infer type from source and target IDs
              const sourceIsPlace = safeJson.places.some(p => p.id === arc.source);
              const targetIsPlace = safeJson.places.some(p => p.id === arc.target);
              
              if (sourceIsPlace && !targetIsPlace) {
                // Fixed arc type to place-to-transition
                return { ...arc, type: 'place-to-transition' };
              } else if (!sourceIsPlace && targetIsPlace) {
                // Fixed arc type to transition-to-place
                return { ...arc, type: 'transition-to-place' };
              } else {
                // Default to place-to-transition as fallback
                console.warn(`Could not determine type for arc ${arc.id}, defaulting to place-to-transition`);
                return { ...arc, type: 'place-to-transition' };
              }
            }
            return arc;
          });
        } else {
          console.warn('No arcs found in imported data');
        }
        
        // Update the Petri net state
        setElements(safeJson);
        
        // Verify the state was updated by exposing it to the window for debugging
        // State prepared for loading
        
        // Add to history
        if (updateHistory) {
          // Adding imported state to history
          updateHistory(safeJson);
        } else {
          console.warn('updateHistory function not available');
        }
        
        // Show success message
        setSuccess(`Petri net loaded successfully with ${safeJson.places.length} places, ${safeJson.transitions.length} transitions, and ${safeJson.arcs.length} arcs.`);
      } catch (error) {
        console.error('Error loading Petri net:', error);
        setError(`Error loading Petri net: ${error.message}`);
        
        // Ensure the canvas is not left in an inconsistent state
        // by keeping the current state if there's an error
      } finally {
        setIsLoading(false);
      }
    };
    
    // Trigger the file input
    fileInput.click();
  };
  
  // Function to clear the canvas
  const handleClear = () => {
    const emptyState = {
      places: [],
      transitions: [],
      arcs: []
    };
    
    try {
      // Ensure simulator is fully reset so no stale enabled transitions remain
      simulatorCore.deactivateSimulation?.();
      simulatorCore.reset?.();
    } catch (e) {
      console.warn('Simulator reset on clear failed or not available:', e);
    }

    setElements(emptyState);
    
    // Add to history
    if (updateHistory) {
      updateHistory(emptyState);
    }
    
    // Show success message
    setSuccess('Canvas cleared successfully.');
  };
  
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
          <div className="flex justify-between">
            <button 
              style={{ ...buttonStyle(false), opacity: isLoading ? 0.5 : 1 }}
              onClick={handleSave}
              disabled={isLoading}
              title="Save as PNML"
            >
              Save
            </button>
            <button 
              style={{ ...buttonStyle(false), opacity: isLoading ? 0.5 : 1 }}
              onClick={handleLoad}
              disabled={isLoading}
              title="Load PNML file"
            >
              Load
            </button>
            <button 
              style={{ ...buttonStyle(false) }}
              onClick={handleClear}
              title="Clear canvas"
            >
              Clear
            </button>
          </div>
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
            <div className="flex justify-between">
              <button 
                style={{ ...buttonStyle(mode === 'select') }}
                data-testid="toolbar-select"
                onClick={() => {
                  // Use immediate state update for better responsiveness
                  if (mode !== 'select') {
                    setMode('select');
                  }
                }}
              >
                Select
              </button>
              <button 
                style={buttonStyle(mode === 'place')}
                data-testid="toolbar-place"
                onClick={() => {
                  // Use immediate state update for better responsiveness
                  if (mode !== 'place') {
                    setMode('place');
                  }
                }}
              >
                Place
              </button>
              <button 
                style={buttonStyle(mode === 'transition')}
                data-testid="toolbar-transition"
                onClick={() => {
                  // Use immediate state update for better responsiveness
                  if (mode !== 'transition') {
                    setMode('transition');
                  }
                }}
              >
                Transition
              </button>
              <button 
                style={buttonStyle(mode === 'arc')}
                data-testid="toolbar-arc"
                onClick={() => {
                  // Use immediate state update for better responsiveness
                  if (mode !== 'arc') {
                    setMode('arc');
                  }
                }}
              >
                Arc
              </button>
              <button 
                style={{ ...buttonStyle(false), opacity: 0.5 }}
                data-testid="toolbar-auto-layout"
                onClick={onAutoLayout}
                title="Auto-arrange elements for better visualization"
                disabled={true}
              >
                Auto
              </button>
            </div>
          </div>
        </div>
        
        {/* Visual separator before history tools */}
        <div className="h-full" style={{ 
          borderRight: '1px solid rgba(180, 180, 190, 0.9)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.9)',
          margin: '0 12px',
          height: '50px',
          alignSelf: 'center',
          opacity: 0.85
        }}></div>

        <div className="history-tools p-2">
          <h3 className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">History</h3>
          <div className="flex justify-between">
            <button 
              style={{ ...buttonStyle(false), opacity: canUndo ? 1 : 0.5 }}
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              Undo
            </button>
            <button 
              style={{ ...buttonStyle(false), opacity: canRedo ? 1 : 0.5 }}
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
            >
              Redo
            </button>
          </div>
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
          <div className="flex justify-between">
            <button 
              style={buttonStyle(false)}
              onClick={onOpenSettings}
              title="Simulation Settings"
              data-testid="toolbar-settings"
            >
              Settings
            </button>
          </div>
        </div>
      </div>
      
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
