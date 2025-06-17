import React, { useState, useEffect, useRef } from 'react';
import { 
  initializeSimulator, 
  getEnabledTransitions, 
  fireTransition, 
  updateSimulator,
  findNonConflictingTransitions,
  fireMultipleTransitions
} from '../utils/simulator';
import MarkingsPanel from './MarkingsPanel';
import EnabledTransitionsPanel from './EnabledTransitionsPanel';

const ExecutionPanel = ({ elements, onUpdateElements, onEnabledTransitionsChange, simulationSettings }) => {
  const { places, transitions, arcs } = elements;
  const [enabledTransitions, setEnabledTransitions] = useState([]);
  const [isSimulatorReady, setIsSimulatorReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [simulationMode, setSimulationMode] = useState('step'); // Only 'step' mode is used now
  const [isSimulating, setIsSimulating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const simulationIntervalRef = useRef(null);
  const simulationIterationCountRef = useRef(0);
  
  // State for panels
  const [isMarkingsPanelOpen, setIsMarkingsPanelOpen] = useState(false);
  const [isEnabledTransitionsPanelOpen, setIsEnabledTransitionsPanelOpen] = useState(false);
  
  // Initialize the simulator when the elements change or simulation settings change
  useEffect(() => {
    const initSimulator = async () => {
      if (places.length === 0 && transitions.length === 0) {
        setIsSimulatorReady(false);
        setEnabledTransitions([]);
        
        // Clear enabled transitions in parent component
        if (onEnabledTransitionsChange) {
          onEnabledTransitionsChange([]);
        }
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Pass simulation settings to the simulator initialization
        await initializeSimulator(elements, {
          maxTokens: simulationSettings.maxTokens
        });
        setIsSimulatorReady(true);
        
        // Compute enabled transitions
        const enabled = await getEnabledTransitions();
        setEnabledTransitions(enabled);
        
        // Notify parent component about enabled transitions
        if (onEnabledTransitionsChange) {
          onEnabledTransitionsChange(enabled);
        }
      } catch (err) {
        console.error('Error initializing simulator:', err);
        setError('Failed to initialize simulator');
        setIsSimulatorReady(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    initSimulator();
  }, [elements, simulationSettings.maxTokens]);  // Add simulationSettings.maxTokens to dependencies
  
  // Handle firing a transition
  const handleFireTransition = async (transitionId) => {
    if (!isSimulatorReady) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Fire the transition and get the updated Petri net
      const updatedPetriNet = await fireTransition(transitionId);
      
      // Update the simulator with the new state
      await updateSimulator(updatedPetriNet);
      
      // Update the elements in the parent component
      if (onUpdateElements) {
        onUpdateElements(updatedPetriNet);
      }
      
      // Compute the new enabled transitions
      const newEnabledTransitions = await getEnabledTransitions();
      setEnabledTransitions(newEnabledTransitions);
      
      // Notify parent component about enabled transitions
      if (onEnabledTransitionsChange) {
        onEnabledTransitionsChange(newEnabledTransitions);
      }
    } catch (err) {
      console.error(`Error firing transition ${transitionId}:`, err);
      setError(`Failed to fire transition ${transitionId}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Clean up simulation interval when component unmounts
  useEffect(() => {
    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, []);

  // Handle firing all non-conflicting enabled transitions simultaneously
  const handleFirePetriNet = async () => {
    if (!isSimulatorReady || enabledTransitions.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Find all non-conflicting transitions to fire simultaneously
      const transitionsToFire = await findNonConflictingTransitions(enabledTransitions, places, arcs);
      
      if (transitionsToFire.length === 0) {
        setError('No transitions to fire');
        return;
      }
      
      // If there's only one transition to fire, use the original method for consistency
      if (transitionsToFire.length === 1) {
        await handleFireTransition(transitionsToFire[0]);
      } else {
        // Fire multiple transitions simultaneously
        const updatedPetriNet = await fireMultipleTransitions(transitionsToFire);
        
        // Update the elements in the parent component
        if (onUpdateElements) {
          onUpdateElements(updatedPetriNet);
        }
        
        // Compute the new enabled transitions
        const newEnabledTransitions = await getEnabledTransitions();
        setEnabledTransitions(newEnabledTransitions);
        
        // Notify parent component about enabled transitions
        if (onEnabledTransitionsChange) {
          onEnabledTransitionsChange(newEnabledTransitions);
        }
      }
    } catch (err) {
      console.error('Error firing transitions:', err);
      setError('Failed to fire transitions');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper to stop the simulation or run
  const stopSimulation = () => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    setIsSimulating(false);
    setIsRunning(false);
    // Simulation or run stopped
  };

  // One simulation step
  const simulateOneStep = async () => {
    try {
      // Increment the iteration counter
      simulationIterationCountRef.current++;
      // Simulation iteration tracking
      
      // Safety check - if we've exceeded the maximum number of iterations, force stop
      const maxIterations = simulationSettings?.maxIterations || 100; // Default to 100 if settings not provided
      if (maxIterations !== Infinity && simulationIterationCountRef.current > maxIterations) {
        // Maximum simulation iterations reached, stopping
        return false;
      }
      
      // Check for enabled transitions
      const currentEnabled = await getEnabledTransitions();
      // Track currently enabled transitions
      
      // Don't proceed if there are no enabled transitions
      if (currentEnabled.length === 0) {
        // No enabled transitions to fire, stopping simulation
        return false;
      }
      
      // Try to fire transitions
      try {
        // Fire transitions using the regular fire button logic
        await handleFirePetriNet();
        
        // Check if there are still enabled transitions after firing
        const afterFiringEnabled = await getEnabledTransitions();
        
        // Important: We want to continue even if only one transition is enabled
        // Only stop if there are NO enabled transitions
        if (afterFiringEnabled.length === 0) {
          // No transitions enabled after firing, stopping simulation
          return false;
        } else {
          // Transitions still enabled, continuing simulation
        }
        
        // Continue simulation
        return true;
      } catch (error) {
        console.warn('Error during transition firing:', error);
        
        // Try to check if any transitions are still enabled
        try {
          const errorCheckEnabled = await getEnabledTransitions();
          if (errorCheckEnabled.length === 0) {
            // No enabled transitions after error, stopping simulation
            return false;
          }
          // If we still have enabled transitions, continue despite the error
          return true;
        } catch (checkError) {
          console.error('Error checking transitions after firing error:', checkError);
          return false;
        }
      }
    } catch (error) {
      console.error('Simulation step error:', error);
      return false;
    }
  };
  
  // Start or stop automatic simulation
  const handleSimulate = () => {
    if (isSimulating) {
      // Stop simulation
      stopSimulation();
    } else {
      // Start simulation
      setIsSimulating(true);
      
      // Reset counters
      simulationIterationCountRef.current = 0;
      
      // Starting simulation
      
      // Run the first step immediately
      simulateOneStep().then(canContinue => {
        if (canContinue) {
          // Set up interval for continuous firing
          simulationIntervalRef.current = setInterval(() => {
            simulateOneStep().then(canContinue => {
              if (!canContinue) {
                stopSimulation();
              }
            }).catch(error => {
              console.error('Error in simulation step:', error);
              stopSimulation();
            });
          }, 500);
        } else {
          stopSimulation();
        }
      }).catch(error => {
        console.error('Error starting simulation:', error);
        stopSimulation();
      });
    }
  };
  
  // Handle full-speed run without displaying intermediate states
  const handleRun = async () => {
    if (isRunning) {
      // Stop run
      stopSimulation();
    } else {
      try {
        // Start run
        setIsRunning(true);
        
        // Reset counters
        simulationIterationCountRef.current = 0;
        
        // Starting full-speed run
        
        // Check if there are any enabled transitions
        const currentEnabled = await getEnabledTransitions();
        // Run starting with enabled transitions
        
        if (currentEnabled.length === 0) {
          // No enabled transitions to run
          setIsRunning(false);
          return;
        }
        
        // Simple execution approach - keep firing transitions until none are enabled
        let iterationCount = 0;
        let canContinue = true;
        
        // Get max iterations from settings, default to 1000 if not provided
        const maxIterations = simulationSettings?.maxIterations || 1000;
        const iterationLimit = maxIterations === Infinity ? 1000 : maxIterations;
        
        while (canContinue && iterationCount < iterationLimit) {
          iterationCount++;
          
          // Get current enabled transitions
          const enabled = await getEnabledTransitions();
          
          if (enabled.length === 0) {
            // No more enabled transitions
            break;
          }
          
          // Find non-conflicting transitions to fire - this is the same logic used by the Fire button
          const transitionsToFire = await findNonConflictingTransitions(enabled, places, arcs);
          
          if (transitionsToFire.length === 0) {
            // No transitions to fire
            break;
          }
          
          // Fire the transitions using the same logic as the Fire button
          // Firing selected transitions
          const updatedPetriNet = await fireMultipleTransitions(transitionsToFire);
          
          // Update the elements in the parent component
          if (onUpdateElements) {
            onUpdateElements(updatedPetriNet);
          }
          
          // Check if there are still enabled transitions
          const afterFiringEnabled = await getEnabledTransitions();
          canContinue = afterFiringEnabled.length > 0;
          
          // Add a small delay every few iterations to prevent browser freezing
          if (iterationCount % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
        
        // Log if we hit the iteration limit
        if (maxIterations !== Infinity && iterationCount >= iterationLimit) {
          console.warn(`Run hit the maximum iteration limit (${iterationLimit})`);
        }
        
        // Run completed
      } catch (error) {
        console.error('Error during run:', error);
      } finally {
        // Always ensure we reset the running state
        setIsRunning(false);
      }
    }
  };  

  return (
    <div data-testid="execution-panel" className="execution-panel w-full px-4 py-2 mx-0">
      <h2 className="text-lg font-semibold mb-2">Execution</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="flex flex-col space-y-3 mb-4">
        {/* Control panel container with walkman-style appearance */}
        <div className="bg-gray-200 p-3 rounded-lg shadow-lg border border-gray-300">
          {/* First row with Fire, Simulate and Run buttons - all same size */}
          <div className="flex items-center justify-between space-x-3 mb-3">
            <button
              data-testid="sim-fire"
              className="flex-1 h-12 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex flex-col items-center justify-center transition-all shadow-md"
              onClick={handleFirePetriNet}
              disabled={!isSimulatorReady || enabledTransitions.length === 0 || isLoading || isSimulating || isRunning}
              title="Execute one step"
            >
              <div style={{ height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </div>
              <span className="text-xs font-bold">Fire</span>
            </button>
            <button
              data-testid="sim-simulate"
              className="flex-1 h-12 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 flex flex-col items-center justify-center transition-all shadow-md"
              onClick={handleSimulate}
              disabled={!isSimulatorReady || enabledTransitions.length === 0 || isLoading || isSimulating || isRunning}
              title="Simulate with animation"
            >
              <div style={{ height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18V6l8 6-8 6z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-xs font-bold">Simulate</span>
            </button>
            <button
              data-testid="sim-run"
              className="flex-1 h-12 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:bg-gray-400 flex flex-col items-center justify-center transition-all shadow-md"
              onClick={handleRun}
              disabled={!isSimulatorReady || enabledTransitions.length === 0 || isLoading || isSimulating || isRunning}
              title="Run to completion"
            >
              <div style={{ height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7" />
                </svg>
              </div>
              <span className="text-xs font-bold">Run</span>
            </button>
          </div>
          
          {/* Second row with just the Stop button - full width */}
          <div>
            <button
              data-testid="sim-stop"
              className="w-full h-10 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 flex items-center justify-center space-x-2 transition-all shadow-md"
              onClick={stopSimulation}
              disabled={!isSimulating && !isRunning}
              title="Stop simulation or run"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <rect x="7" y="7" width="10" height="10" />
              </svg>
              <span className="text-sm font-bold">STOP</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Panels Section */}
      <div className="mt-4 flex flex-col space-y-4">
        {/* Markings Panel */}
        <div>
          {!isMarkingsPanelOpen ? (
            <button
              data-testid="show-markings"
              className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded flex items-center space-x-1"
              onClick={() => setIsMarkingsPanelOpen(true)}
            >
              <span>Show Markings</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </button>
          ) : (
            <MarkingsPanel 
              places={places.map(place => ({
                ...place,
                label: place.label || place.name || place.id.substring(6, 12)
              }))} 
              isLoading={isLoading} 
              isOpen={isMarkingsPanelOpen} 
              onClose={() => setIsMarkingsPanelOpen(false)} 
            />
          )}
        </div>
        
        {/* Enabled Transitions Panel */}
        <div>
          {!isEnabledTransitionsPanelOpen ? (
            <button
              data-testid="show-enabled-transitions"
              className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded flex items-center space-x-1"
              onClick={() => setIsEnabledTransitionsPanelOpen(true)}
            >
              <span>Show Enabled Transitions</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
              </svg>
            </button>
          ) : (
            <EnabledTransitionsPanel
              enabledTransitions={enabledTransitions}
              isLoading={isLoading}
              isOpen={isEnabledTransitionsPanelOpen}
              onClose={() => setIsEnabledTransitionsPanelOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ExecutionPanel;
