import React, { useState, useEffect } from 'react';
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
  
  return (
    <div data-testid="execution-panel" className="execution-panel p-4 bg-gray-100 border-t border-gray-300">
      <h2 className="text-lg font-semibold mb-2">Execution</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="flex mb-4">
        <div className="flex items-end">
          <button
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            onClick={handleFirePetriNet}
            disabled={!isSimulatorReady || enabledTransitions.length === 0 || isLoading}
          >
            Fire
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
