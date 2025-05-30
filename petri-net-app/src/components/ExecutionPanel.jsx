import React, { useState, useEffect, useRef } from 'react';
import { 
  initializeSimulator, 
  getEnabledTransitions, 
  fireTransition, 
  updateSimulator,
  findNonConflictingTransitions,
  fireMultipleTransitions
} from '../utils/simulator';

const ExecutionPanel = ({ elements, onUpdateElements, onEnabledTransitionsChange }) => {
  const { places, transitions, arcs } = elements;
  const [enabledTransitions, setEnabledTransitions] = useState([]);
  const [isSimulatorReady, setIsSimulatorReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [simulationMode, setSimulationMode] = useState('step'); // Only 'step' mode is used now
  const [isSimulating, setIsSimulating] = useState(false);
  const simulationIntervalRef = useRef(null);
  
  // Initialize the simulator when the elements change
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
        await initializeSimulator(elements);
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
  }, [elements]);  // Remove onEnabledTransitionsChange from dependencies to prevent loops
  
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
  
  // Start or stop automatic simulation
  const handleSimulate = () => {
    if (isSimulating) {
      // Stop simulation
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      setIsSimulating(false);
    } else {
      // Start simulation
      setIsSimulating(true);
      
      // Define a function to handle a single simulation step
      const simulationStep = async () => {
        try {
          // First, explicitly check the current state of enabled transitions
          // This is important in case the state wasn't correctly updated
          const currentEnabled = await getEnabledTransitions();
          
          // Only continue if there are enabled transitions
          if (currentEnabled.length === 0 || enabledTransitions.length === 0) {
            // No more enabled transitions, stop simulation
            console.log('No enabled transitions, stopping simulation');
            if (simulationIntervalRef.current) {
              clearInterval(simulationIntervalRef.current);
              simulationIntervalRef.current = null;
            }
            setIsSimulating(false);
            return false; // Indicate simulation should stop
          }
          
          // Wrap the fire call in try-catch to continue simulation even if errors occur
          try {
            // Simply call handleFirePetriNet directly - this ensures exact same behavior
            // as clicking the "Fire" button
            await handleFirePetriNet();
          } catch (fireError) {
            // Log the error but continue simulation
            console.warn('Error during firing, continuing simulation:', fireError);
          }
          
          // After firing, explicitly check again if there are any enabled transitions left
          const remainingEnabled = await getEnabledTransitions();
          if (remainingEnabled.length === 0) {
            console.log('No remaining enabled transitions after firing, stopping simulation');
            return false; // No more enabled transitions, should stop
          }
          
          return true; // Continue simulation if there are still enabled transitions
        } catch (err) {
          console.error('Error during simulation step:', err);
          
          // Check enabled transitions directly as a safety measure
          try {
            const checkEnabled = await getEnabledTransitions();
            return checkEnabled.length > 0;
          } catch (checkErr) {
            console.error('Error checking enabled transitions:', checkErr);
            return false; // Stop on error
          }
        }
      };
      
      // First firing immediately
      simulationStep().then(canContinue => {
        if (canContinue) {
          // Then set up interval for subsequent firings
          simulationIntervalRef.current = setInterval(async () => {
            try {
              const canContinue = await simulationStep();
              if (!canContinue && simulationIntervalRef.current) {
                clearInterval(simulationIntervalRef.current);
                simulationIntervalRef.current = null;
                setIsSimulating(false);
              }
            } catch (intervalError) {
              console.error('Error in simulation interval:', intervalError);
              // Check if we should continue despite the error
              if (enabledTransitions.length === 0) {
                if (simulationIntervalRef.current) {
                  clearInterval(simulationIntervalRef.current);
                  simulationIntervalRef.current = null;
                }
                setIsSimulating(false);
              }
            }
          }, 500);
        }
      }).catch(error => {
        console.error('Error starting simulation:', error);
        setIsSimulating(false);
      });
    }
  };

  return (
    <div data-testid="execution-panel" className="execution-panel p-4 bg-gray-100 border-t border-gray-300">
      <h2 className="text-lg font-semibold mb-2">Execution</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="flex mb-4">
        <div className="flex items-end space-x-2">
          <button
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            onClick={handleFirePetriNet}
            disabled={!isSimulatorReady || enabledTransitions.length === 0 || isLoading || isSimulating}
          >
            Fire
          </button>
          <button
            className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded disabled:bg-gray-400 flex items-center space-x-1"
            onClick={handleSimulate}
            disabled={!isSimulatorReady || enabledTransitions.length === 0 || isLoading || isSimulating}
          >
            <span>Simulate</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded disabled:bg-gray-400 flex items-center space-x-1"
            onClick={() => {
              if (simulationIntervalRef.current) {
                clearInterval(simulationIntervalRef.current);
                simulationIntervalRef.current = null;
              }
              setIsSimulating(false);
            }}
            disabled={!isSimulating}
          >
            <span>Stop</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v6H9z" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="flex">
        <div className="current-marking mr-8 w-1/2">
          <h3 className="text-sm font-medium mb-2">Current Marking</h3>
          {isLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : places.length === 0 ? (
            <p className="text-gray-500">No places defined</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {places.map(place => (
                <div key={place.id} className="flex items-center">
                  <span className="font-medium mr-2">{place.name}:</span>
                  <span>{place.tokens || 0}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Enabled transitions section removed as requested */}
      </div>
    </div>
  );
};

export default ExecutionPanel;
