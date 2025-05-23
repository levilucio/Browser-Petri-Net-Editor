import React, { useState, useEffect } from 'react';
import { initializeSimulator, getEnabledTransitions, fireTransition, updateSimulator } from '../utils/simulator';

const ExecutionPanel = ({ elements, onUpdateElements }) => {
  const { places, transitions, arcs } = elements;
  const [enabledTransitions, setEnabledTransitions] = useState([]);
  const [isSimulatorReady, setIsSimulatorReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [simulationMode, setSimulationMode] = useState('step'); // 'step', 'quick', 'non-visual'
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Initialize the simulator when the elements change
  useEffect(() => {
    const initSimulator = async () => {
      if (places.length === 0 && transitions.length === 0) {
        setIsSimulatorReady(false);
        setEnabledTransitions([]);
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
      } catch (err) {
        console.error('Error initializing simulator:', err);
        setError('Failed to initialize simulator');
        setIsSimulatorReady(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    initSimulator();
  }, [elements]);
  
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
      
      // Compute the new enabled transitions
      const newEnabledTransitions = await getEnabledTransitions();
      setEnabledTransitions(newEnabledTransitions);
      
      // Update the elements in the parent component
      if (onUpdateElements) {
        onUpdateElements(updatedPetriNet);
      }
    } catch (err) {
      console.error(`Error firing transition ${transitionId}:`, err);
      setError(`Failed to fire transition ${transitionId}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle quick simulation mode
  const handleQuickSimulation = async () => {
    if (!isSimulatorReady || enabledTransitions.length === 0) return;
    
    setIsSimulating(true);
    
    try {
      // Fire the first enabled transition
      await handleFireTransition(enabledTransitions[0].id);
      
      // Schedule the next firing after a delay
      if (enabledTransitions.length > 0) {
        setTimeout(() => {
          if (isSimulating) {
            handleQuickSimulation();
          }
        }, 200); // 200ms delay between firings
      } else {
        setIsSimulating(false);
      }
    } catch (err) {
      console.error('Error in quick simulation:', err);
      setError('Failed to continue simulation');
      setIsSimulating(false);
    }
  };
  
  // Handle non-visual simulation mode
  const handleNonVisualSimulation = async () => {
    if (!isSimulatorReady) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Keep firing enabled transitions until no more are enabled
      let currentPetriNet = { ...elements };
      let currentEnabledTransitions = [...enabledTransitions];
      
      while (currentEnabledTransitions.length > 0) {
        // Fire the first enabled transition
        const transitionId = currentEnabledTransitions[0].id;
        currentPetriNet = await fireTransition(transitionId);
        
        // Update the simulator with the new state
        await updateSimulator(currentPetriNet);
        
        // Compute the new enabled transitions
        currentEnabledTransitions = await getEnabledTransitions();
      }
      
      // Update the elements in the parent component
      if (onUpdateElements) {
        onUpdateElements(currentPetriNet);
      }
      
      // Update the enabled transitions
      setEnabledTransitions([]);
    } catch (err) {
      console.error('Error in non-visual simulation:', err);
      setError('Failed to complete simulation');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle starting simulation based on the selected mode
  const handleStartSimulation = () => {
    if (simulationMode === 'step') {
      // Step-by-step mode is handled by the user clicking on enabled transitions
      return;
    } else if (simulationMode === 'quick') {
      handleQuickSimulation();
    } else if (simulationMode === 'non-visual') {
      handleNonVisualSimulation();
    }
  };
  
  // Handle stopping simulation
  const handleStopSimulation = () => {
    setIsSimulating(false);
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
        <div className="mr-4">
          <label className="block text-sm font-medium mb-1">Simulation Mode</label>
          <select
            className="border rounded px-2 py-1"
            value={simulationMode}
            onChange={(e) => setSimulationMode(e.target.value)}
            disabled={isSimulating || isLoading}
          >
            <option value="step">Step-by-Step</option>
            <option value="quick">Quick Visual</option>
            <option value="non-visual">Non-Visual</option>
          </select>
        </div>
        
        <div className="flex items-end">
          {!isSimulating ? (
            <button
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
              onClick={handleStartSimulation}
              disabled={!isSimulatorReady || enabledTransitions.length === 0 || isLoading || simulationMode === 'step'}
            >
              Start Simulation
            </button>
          ) : (
            <button
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              onClick={handleStopSimulation}
            >
              Stop Simulation
            </button>
          )}
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
        
        <div className="enabled-transitions w-1/2">
          <h3 className="text-sm font-medium mb-2">Enabled Transitions</h3>
          {isLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : transitions.length === 0 ? (
            <p className="text-gray-500">No transitions defined</p>
          ) : enabledTransitions.length === 0 ? (
            <p className="text-gray-500">No enabled transitions</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {enabledTransitions.map(transition => (
                <button
                  key={transition.id}
                  className="px-3 py-1 bg-green-100 border border-green-300 rounded hover:bg-green-200"
                  onClick={() => simulationMode === 'step' && handleFireTransition(transition.id)}
                  disabled={isSimulating || isLoading || simulationMode !== 'step'}
                >
                  {transition.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExecutionPanel;
