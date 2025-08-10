/**
 * JavaScript wrapper for the Petri Net Simulator
 * This module provides functions to interact with the Python simulator engine
 * using Pyodide to compute enabled transitions and update markings.
 */

import { loadPyodideInstance } from './pyodide-loader';

// Keep a single instance of Pyodide to avoid reloading
let pyodideInstance = null;
let simulator = null;
let pyodideLoading = null;

// Track initialization state to prevent repeated initialization
let isInitializing = false;
let lastInitTime = 0;
const MIN_INIT_INTERVAL = 2000; // Minimum time between initialization attempts in ms

// Python code for the Petri Net Simulator
const pythonCode = `
import json

class PetriNetSimulator:
    def __init__(self, petri_net, max_tokens=20):
        # Handle both dictionary and JS object formats
        # Try to get properties using get() method first, then fall back to attribute access
        try:
            if hasattr(petri_net, 'get'):
                self.places = petri_net.get('places', [])
                self.transitions = petri_net.get('transitions', [])
                self.arcs = petri_net.get('arcs', [])
            else:
                # Handle plain objects (like those from JavaScript)
                self.places = getattr(petri_net, 'places', [])
                self.transitions = getattr(petri_net, 'transitions', [])
                self.arcs = getattr(petri_net, 'arcs', [])
        except Exception as e:
            print(f"Error accessing petri_net properties: {e}")
            # Fallback to empty lists
            self.places = []
            self.transitions = []
            self.arcs = []
        
        self.max_tokens = max_tokens
        self.petri_net = petri_net
        
        # Debug: Print what we received
        print(f"Python simulator constructor received petri_net type: {type(petri_net)}")
        print(f"Python simulator constructor received petri_net dir: {dir(petri_net)}")
        print(f"Python simulator initialized with {len(self.places)} places, {len(self.transitions)} transitions, {len(self.arcs)} arcs")
        
        # Debug: Print arc details
        for i, arc in enumerate(self.arcs):
            print(f"  Arc {i}: {arc}")
    
    def get_input_places(self, transition_id):
        input_places = []
        for arc in self.arcs:
            source_id = arc.get('sourceId', arc.get('source'))
            target_id = arc.get('targetId', arc.get('target'))
            source_type = arc.get('sourceType')
            
            # Check if arc is from place to this transition
            if (source_type == 'place' and target_id == transition_id) or \
               (arc.get('type') == 'place-to-transition' and target_id == transition_id):
                # Find the place
                for place in self.places:
                    if place.get('id') == source_id:
                        input_places.append((place, arc))
                        break
        return input_places
    
    def get_output_places(self, transition_id):
        output_places = []
        for arc in self.arcs:
            source_id = arc.get('sourceId', arc.get('source'))
            target_id = arc.get('targetId', arc.get('target'))
            target_type = arc.get('targetType')
            
            # Check if arc is from this transition to a place
            if (target_type == 'place' and source_id == transition_id) or \
               (arc.get('type') == 'transition-to-place' and source_id == transition_id):
                # Find the place
                for place in self.places:
                    if place.get('id') == target_id:
                        output_places.append((place, arc))
                        break
        return output_places
    
    def is_transition_enabled(self, transition_id):
        input_places = self.get_input_places(transition_id)
        
        # Check if all input places have enough tokens
        for place, arc in input_places:
            tokens = place.get('tokens', 0)
            weight = arc.get('weight', 1)
            if tokens < weight:
                return False
        
        return True
    
    def get_enabled_transitions(self):
        enabled = []
        for transition in self.transitions:
            transition_id = transition.get('id')
            if self.is_transition_enabled(transition_id):
                enabled.append(transition)
        
        print(f"Python simulator found {len(enabled)} enabled transitions")
        return enabled
    
    def fire_transition(self, transition_id):
        print(f"Python simulator firing transition {transition_id}")
        
        # Check if the transition is enabled
        if not self.is_transition_enabled(transition_id):
            print(f"Transition {transition_id} is not enabled")
            return self.petri_net
        
        # Create a deep copy of the Petri net
        updated_petri_net = {}
        updated_petri_net['transitions'] = self.transitions.copy()
        
        # CRITICAL: Create a proper deep copy of arcs to preserve all properties
        updated_arcs = []
        for arc in self.arcs:
            if hasattr(arc, 'copy'):
                arc_copy = arc.copy()
            else:
                arc_copy = dict(arc) if isinstance(arc, dict) else arc
            updated_arcs.append(arc_copy)
        
        updated_petri_net['arcs'] = updated_arcs
        updated_places = []
        
        # Get all places
        for place in self.places:
            # Create a proper copy of the place
            if hasattr(place, 'copy'):
                place_copy = place.copy()
            else:
                place_copy = dict(place) if isinstance(place, dict) else place
            
            place_id = place.get('id') if hasattr(place, 'get') else place['id']
            
            # Check if this place is an input place for the transition
            for input_place, arc in self.get_input_places(transition_id):
                if input_place.get('id') == place_id:
                    # Remove tokens from input place
                    weight = arc.get('weight', 1)
                    tokens = place.get('tokens', 0)
                    new_tokens = max(0, tokens - weight)
                    place_copy['tokens'] = new_tokens
                    print(f"Python simulator: Input place {place_id} tokens: {tokens} -> {new_tokens}")
            
            # Check if this place is an output place for the transition
            for output_place, arc in self.get_output_places(transition_id):
                if output_place.get('id') == place_id:
                    # Add tokens to output place
                    weight = arc.get('weight', 1)
                    tokens = place.get('tokens', 0)
                    new_tokens = min(self.max_tokens, tokens + weight)
                    place_copy['tokens'] = new_tokens
                    print(f"Python simulator: Output place {place_id} tokens: {tokens} -> {new_tokens}")
            
            updated_places.append(place_copy)
        
        # Update the Petri net with the new places
        updated_petri_net['places'] = updated_places
        
        # CRITICAL: Update the simulator's internal state with the new places
        self.places = updated_places
        self.petri_net = updated_petri_net
        
        # Verify the internal state was updated correctly
        print(f"Python simulator fired transition successfully")
        print("Verifying internal state after firing:")
        for place in self.places:
            place_id = place.get('id') if hasattr(place, 'get') else place['id']
            tokens = place.get('tokens', 0) if hasattr(place, 'get') else place.get('tokens', 0)
            print(f"  Internal state - Place {place_id}: {tokens} tokens")
        
        # CRITICAL: Verify that arcs are properly preserved
        print(f"Verifying arcs preservation: {len(updated_petri_net['arcs'])} arcs in result")
        for i, arc in enumerate(updated_petri_net['arcs']):
            arc_id = arc.get('id') if hasattr(arc, 'get') else arc.get('id', 'unknown')
            source = arc.get('source') if hasattr(arc, 'get') else arc.get('source', 'unknown')
            target = arc.get('target') if hasattr(arc, 'get') else arc.get('target', 'unknown')
            print(f"  Arc {i}: id={arc_id}, source={source}, target={target}")
        
        return updated_petri_net
`

// JavaScript fallback simulator
export class JsPetriNetSimulator {
  constructor(petriNet, options = {}) {
    this.petriNet = petriNet;
    this.places = petriNet.places || [];
    this.transitions = petriNet.transitions || [];
    this.arcs = petriNet.arcs || [];
    this.maxTokens = options.maxTokens || 20; // Default to 20 if not specified
  }
  
  getInputPlaces(transitionId) {
    const inputPlaces = [];
    
    for (const arc of this.arcs) {
      // Check if the arc is from a place to this transition
      const sourceId = arc.sourceId || arc.source;
      const targetId = arc.targetId || arc.target;
      const sourceType = arc.sourceType;
      
      // Handle both editor-created arcs and PNML-loaded arcs
      if ((sourceType === 'place' && targetId === transitionId) || 
          (arc.type === 'place-to-transition' && targetId === transitionId)) {
        // Find the place
        const place = this.places.find(p => p.id === sourceId);
        if (place) {
          inputPlaces.push([place, arc]);
        }
      }
    }
    
    return inputPlaces;
  }

  getOutputPlaces(transitionId) {
    const outputPlaces = [];
    
    for (const arc of this.arcs) {
      // Check if the arc is from this transition to a place
      const sourceId = arc.sourceId || arc.source;
      const targetId = arc.targetId || arc.target;
      const targetType = arc.targetType;
      
      // Handle both editor-created arcs and PNML-loaded arcs
      if ((targetType === 'place' && sourceId === transitionId) || 
          (arc.type === 'transition-to-place' && sourceId === transitionId)) {
        // Find the place
        const place = this.places.find(p => p.id === targetId);
        if (place) {
          outputPlaces.push([place, arc]);
        }
      }
    }
    
    return outputPlaces;
  }

  isTransitionEnabled(transitionId) {
    const inputPlaces = this.getInputPlaces(transitionId);
    
    // A transition is enabled if all input places have enough tokens
    for (const [place, arc] of inputPlaces) {
      // Get the arc weight (default to 1 if not specified)
      const weight = arc.weight || 1;
      
      // Check if the place has enough tokens
      if ((place.tokens || 0) < weight) {
        return false;
      }
    }
    
    return true;
  }

  getEnabledTransitions() {
    // Getting enabled transitions
    const enabledTransitions = [];
    
    for (const transition of this.transitions) {
      if (this.isTransitionEnabled(transition.id)) {
        enabledTransitions.push(transition);
      }
    }
    
    // Found enabled transitions
    return enabledTransitions;
  }

  fireTransition(transitionId) {
    // Firing transition
    
    // Check if the transition is enabled
    if (!this.isTransitionEnabled(transitionId)) {
      console.warn(`JS Fallback: Transition ${transitionId} is not enabled`);
      throw new Error(`Transition ${transitionId} is not enabled`);
    }
    
    // Get input and output places
    const inputPlaces = this.getInputPlaces(transitionId);
    const outputPlaces = this.getOutputPlaces(transitionId);
    
    // Create a deep copy of the Petri net to update
    const updatedPetriNet = {
      // Deep clone places to avoid reference issues
      places: JSON.parse(JSON.stringify(this.places)),
      // Deep clone transitions and arcs as well to avoid reference issues
      transitions: JSON.parse(JSON.stringify(this.transitions)),
      arcs: JSON.parse(JSON.stringify(this.arcs))
    };
    
    // Remove tokens from input places
    for (const [place, arc] of inputPlaces) {
      const weight = arc.weight || 1;
      const placeId = place.id;
      
      // Find the place in the updated Petri net
      const updatedPlace = updatedPetriNet.places.find(p => p.id === placeId);
      if (updatedPlace) {
        const oldTokens = updatedPlace.tokens || 0;
        updatedPlace.tokens = Math.max(0, oldTokens - weight);
        console.log(`Updated input place ${placeId} tokens: ${oldTokens} -> ${updatedPlace.tokens}`);
      }
    }
    
    // Add tokens to output places
    for (const [place, arc] of outputPlaces) {
      const weight = arc.weight || 1;
      const placeId = place.id;
      
      // Find the place in the updated Petri net
      const updatedPlace = updatedPetriNet.places.find(p => p.id === placeId);
      if (updatedPlace) {
        const oldTokens = updatedPlace.tokens || 0;
        // Enforce token limit (using the configured maxTokens)
        updatedPlace.tokens = Math.min(this.maxTokens, oldTokens + weight);
        console.log(`Updated output place ${placeId} tokens: ${oldTokens} -> ${updatedPlace.tokens}`);
      }
    }
    
    // Validate the updated Petri net structure
    if (!updatedPetriNet.places || !Array.isArray(updatedPetriNet.places)) {
      console.error('Invalid places array in updated Petri net');
      updatedPetriNet.places = this.places || [];
    }
    if (!updatedPetriNet.transitions || !Array.isArray(updatedPetriNet.transitions)) {
      console.error('Invalid transitions array in updated Petri net');
      updatedPetriNet.transitions = this.transitions || [];
    }
    if (!updatedPetriNet.arcs || !Array.isArray(updatedPetriNet.arcs)) {
      console.error('Invalid arcs array in updated Petri net');
      updatedPetriNet.arcs = this.arcs || [];
    }
    
    // Update the internal state of the simulator
    this.petriNet = updatedPetriNet;
    this.places = updatedPetriNet.places;
    
    console.log('JS simulator fired transition successfully', transitionId);
    return updatedPetriNet;
  }
}

// Flag to use JavaScript fallback by default for better performance
let useJsFallback = false;
let pyodideLoadError = null;

// Flag to track if simulation mode is active
let simulationActive = false;

// Store the current Petri net to use in fallback scenarios
let currentPetriNet = null;

/**
 * Activate simulation mode - switches to use the full Pyodide simulator
 * This should be called when starting simulation to ensure accurate results
 * @param {boolean} forceInitialize - If true, always reinitialize the simulator. Default: true
 */
export async function activateSimulation(forceInitialize = true) {
  simulationActive = true;
  console.log('Simulation mode activated');
  
  // Reset fallback flag to try Pyodide first
  useJsFallback = false;
  
  // Make sure we have a valid simulator instance
  if (currentPetriNet) {
    try {
      // Only initialize if forced or we don't have a simulator yet
      if (forceInitialize || !simulator) {
        console.log(`${forceInitialize ? 'Force initializing' : 'Initializing'} simulator for simulation mode`);
        // Try to initialize with Pyodide first
        await initializeSimulator(currentPetriNet, { maxTokens: 20 });
        console.log('Simulator initialized for simulation mode');
      } else {
        console.log('Using existing simulator instance - skipping initialization');
      }
    } catch (error) {
      console.error('Error initializing simulator:', error);
      
      // Fall back to JavaScript simulator if Pyodide fails
      useJsFallback = true;
      try {
        simulator = new JsPetriNetSimulator(currentPetriNet);
        console.log('Using JavaScript simulator as fallback');
      } catch (jsError) {
        console.error('Error creating JavaScript simulator:', jsError);
        // Create a minimal simulator if all else fails
        simulator = {
          getEnabledTransitions: () => [],
          fireTransition: () => currentPetriNet,
          isTransitionEnabled: () => false
        };
      }
    }
  }
  return null;
}

/**
 * Deactivate simulation mode - cleans up resources and resets state
 * This should be called when exiting simulation mode to free up memory
 */
export function deactivateSimulation() {
  simulationActive = false;
  console.log('Simulation mode deactivated');
  
  // Don't actually destroy the Pyodide instance, just mark it as inactive
  // This allows us to reuse it if simulation is activated again
  // If we need to free up memory, we could set pyodideInstance = null here
  
  // Reset the fallback flag to allow trying Pyodide again next time
  if (useJsFallback && !pyodideLoadError) {
    useJsFallback = false;
  }
  
  // Re-initialize with JavaScript simulator to ensure clean state
  if (currentPetriNet) {
    simulator = new JsPetriNetSimulator(currentPetriNet);
  }
  
  return null;
}

/**
 * Load the simulator code into Pyodide
 * @param {Object} pyodide - Pyodide instance
 * @returns {Promise<void>}
 */
/**
 * Fetch the Python simulator code
 * @returns {Promise<string>} - The Python simulator code
 */
async function fetchSimulatorCode() {
  // Return the pythonCode variable directly to ensure consistency
  return pythonCode;
}

async function loadSimulatorCode(pyodide) {
  try {
    // Loading simulator module
    // We don't need micropip or lxml for our basic simulator
    
    // Load the simulator code
    const simulatorCode = await fetchSimulatorCode();
    
    // Run the simulator code and check for errors
    try {
      await pyodide.runPythonAsync(simulatorCode);
      
      // Verify that the PetriNetSimulator class was defined
      const classExists = await pyodide.runPythonAsync(`
        'PetriNetSimulator' in globals()
      `);
      
      if (!classExists) {
        throw new Error('PetriNetSimulator class not defined after loading code');
      }
      
      // Test creating a simple simulator instance with better error handling
      const testResult = await pyodide.runPythonAsync(`
        try:
            # Create a simple test network
            test_net = {'places': [], 'transitions': [], 'arcs': []}
            
            # Print debug info
            print('Creating test PetriNetSimulator instance...')
            print('PetriNetSimulator in globals:', 'PetriNetSimulator' in globals())
            
            # Create the simulator instance
            test_simulator = PetriNetSimulator(test_net)
            
            # Verify it has the required methods
            has_method = hasattr(test_simulator, 'get_enabled_transitions')
            print('Has get_enabled_transitions method:', has_method)
            
            has_method
        except Exception as e:
            import sys
            import traceback
            print('Error creating test simulator:')
            traceback.print_exc(file=sys.stdout)
            False
      `);
      
      if (!testResult) {
        throw new Error('Failed to create test PetriNetSimulator instance');
      }
      
      console.log('Pyodide simulator code loaded and verified successfully');
    } catch (runError) {
      console.error('Error running Python simulator code:', runError);
      throw runError;
    }
    
    // Pyodide and simulator module loaded successfully
  } catch (error) {
    console.error('Error loading simulator code:', error);
    throw error;
  }
}

/**
 * Initialize the simulator with a Petri net
 * @param {Object} petriNet - The Petri net in JSON format with places, transitions, and arcs
 * @param {Object} options - Additional options for the simulator
 * @param {number} options.maxTokens - Maximum number of tokens per place (default: 20)
 * @param {boolean} options.forceInitialize - Force initialization even if not in simulation mode
 * @returns {Promise<void>}
 */
export async function initializeSimulator(petriNet, options = {}) {
  // Store the current Petri net for fallback scenarios
  currentPetriNet = petriNet;
  
  // Prevent multiple simultaneous initializations
  const now = Date.now();
  if (isInitializing) {
    console.log('Initialization already in progress, skipping...');
    return simulator; // Return existing simulator
  }
  
  // If we already have a simulator and it's too soon to reinitialize, just update it and return
  if (now - lastInitTime < MIN_INIT_INTERVAL && simulator) {
    console.log('Initialization attempted too soon, using existing simulator...');
    
    // Just update the current Petri net in the existing simulator
    if (simulator instanceof JsPetriNetSimulator) {
      simulator.petriNet = petriNet;
      simulator.places = petriNet.places || [];
      simulator.transitions = petriNet.transitions || [];
      simulator.arcs = petriNet.arcs || [];
    }
    
    return simulator;
  }
  
  // Set initialization state
  isInitializing = true;
  lastInitTime = now;
  
  // Reset fallback flag to try Pyodide first
  useJsFallback = false;
  
  console.log('Initializing simulator with new Petri net...');
  
  // Only try to use Pyodide if simulation is active
  if (simulationActive && !useJsFallback && !pyodideLoadError) {
    try {
      console.log('Attempting to initialize Pyodide simulator...');
      
      // Load Pyodide if not already loaded
      if (!pyodideInstance) {
        console.log('Loading Pyodide instance...');
        pyodideInstance = await loadPyodideInstance();
        
        if (!pyodideInstance) {
          console.error('Failed to load Pyodide instance');
          useJsFallback = true;
          isInitializing = false;
          throw new Error('Failed to load Pyodide instance');
        }
        
        console.log('Pyodide loaded successfully');
      }
      
      // Load the Python code for the Petri net simulator
      await pyodideInstance.runPythonAsync(pythonCode);
      
      // Check if the PetriNetSimulator class is defined
      const isPetriNetSimulatorDefined = await pyodideInstance.runPythonAsync(`'PetriNetSimulator' in globals()`);
      if (!isPetriNetSimulatorDefined) {
        console.error('PetriNetSimulator class not defined in Python environment');
        throw new Error('PetriNetSimulator class not defined');
      }
      
      console.log('PetriNetSimulator class defined successfully');
      
      // Test creating a simple simulator instance to verify it works
      try {
        await pyodideInstance.runPythonAsync(`
          print('Creating test PetriNetSimulator instance...')
          print('PetriNetSimulator in globals:', 'PetriNetSimulator' in globals())
          test_net = {'places': [], 'transitions': [], 'arcs': []}
          test_simulator = PetriNetSimulator(test_net)
          print('Test simulator created successfully')
          print('Test simulator methods:', dir(test_simulator))
        `);
      } catch (testError) {
        console.error('Error creating test simulator:', testError);
        useJsFallback = true;
        throw new Error('Failed to create test PetriNetSimulator instance');
      }
      
      // Create the actual simulator instance with the provided Petri net
      const maxTokens = options.maxTokens || 20;
      
      // Debug: Log what we're about to convert
      console.log('About to convert Petri net to Python:', petriNet);
      console.log('Petri net arcs:', petriNet.arcs);
      
      const petriNetPy = pyodideInstance.toPy(petriNet);
      
      // Debug: Log what the conversion produced
      console.log('Petri net converted to Python object:', petriNetPy);
      
      simulator = await pyodideInstance.runPythonAsync(`
        simulator = PetriNetSimulator(${petriNetPy}, ${maxTokens})
        
        # Debug: Verify what the simulator received
        print(f"Simulator created with {len(simulator.places)} places, {len(simulator.transitions)} transitions, {len(simulator.arcs)} arcs")
        
        # If arcs are missing, try to set them manually
        if len(simulator.arcs) == 0:
            print("WARNING: No arcs in simulator, attempting manual arc setup...")
            # Convert the arcs from JavaScript to Python manually
            arcs_data = ${pyodideInstance.toPy(petriNet.arcs || [])}
            simulator.arcs = arcs_data
            print(f"Manually set {len(simulator.arcs)} arcs")
        
        simulator
      `);
      
      // Verify that the simulator has the expected methods
      if (!simulator || typeof simulator.get_enabled_transitions !== 'function') {
        console.error('Python simulator missing required methods');
        useJsFallback = true;
        throw new Error('Python simulator missing required methods');
      }
      
      console.log('Initialized Python simulator successfully');
      isInitializing = false;
      return simulator;
    } catch (error) {
      console.error('Error initializing Python simulator:', error);
      useJsFallback = true;
      isInitializing = false;
      console.log('Falling back to JavaScript simulator');
    }
  }
  
  // Fall back to JavaScript simulator if Pyodide fails or is disabled
  try {
    simulator = new JsPetriNetSimulator(petriNet, options);
    console.log('Initialized JavaScript simulator successfully');
    isInitializing = false;
    return simulator;
  } catch (error) {
    console.error('Error initializing JavaScript simulator:', error);
    
    // Create a minimal simulator if all else fails
    simulator = {
      getEnabledTransitions: () => [],
      fireTransition: () => petriNet,
      isTransitionEnabled: () => false
    };
    console.warn('Created minimal fallback simulator');
    isInitializing = false;
    return simulator;
  }
}

/**
 * Get all enabled transitions in the Petri net
 * @returns {Promise<Array>} - List of enabled transition objects
 */
export async function getEnabledTransitions() {
  try {
    // Check if the simulator is initialized
    if (!simulator) {
      console.warn('Simulator not initialized, initializing with default settings');
      await initializeSimulator({}, { maxTokens: 20 });
    }
    
    // Check if we're using the JavaScript fallback
    if (useJsFallback || simulator instanceof JsPetriNetSimulator) {
      return simulator.getEnabledTransitions();
    }
    
    // Using Python simulator
    try {
      // Make sure the Python simulator has the latest Petri net state
      try {
        if (pyodideInstance && currentPetriNet) {
          // Update the Python simulator's internal state to ensure consistency
          await pyodideInstance.runPythonAsync(`
            # Ensure simulator has the latest state
            if 'simulator' in globals():
              simulator.places = ${pyodideInstance.toPy(currentPetriNet.places || [])}
              simulator.transitions = ${pyodideInstance.toPy(currentPetriNet.transitions || [])}
              simulator.arcs = ${pyodideInstance.toPy(currentPetriNet.arcs || [])}
              simulator.petri_net = ${pyodideInstance.toPy(currentPetriNet)}
          `);
        }
      } catch (updateError) {
        console.warn('Failed to update Python simulator state before getting enabled transitions:', updateError);
      }
      
      // Call the Python method to get enabled transitions
      const enabledTransitions = await simulator.get_enabled_transitions();
      console.log('Python simulator getting enabled transitions');
      
      // Convert the Python result to proper JavaScript objects
      if (typeof enabledTransitions.toJs === 'function') {
        const rawResult = enabledTransitions.toJs();
        console.log(`Python simulator found ${rawResult.length} enabled transitions`);
        
        // Convert Map objects to plain JavaScript objects if needed
        const normalizedResults = rawResult.map(transition => {
          if (transition instanceof Map) {
            // Convert Map to a plain object with proper type conversion
            const obj = {};
            transition.forEach((value, key) => {
              if (key === 'tokens') {
                // Ensure token counts are numeric
                obj[key] = Number(value) || 0;
              } else {
                obj[key] = value;
              }
            });
            return obj;
          } else if (typeof transition === 'object') {
            // For plain objects, ensure any tokens property is numeric
            return {
              ...transition,
              tokens: transition.tokens !== undefined ? Number(transition.tokens) : undefined
            };
          }
          return transition;
        });
        
        // Log token states for debugging
        console.log('Enabled transitions with token info:');
        normalizedResults.forEach(t => {
          if (t && t.id) {
            const inputPlaces = currentPetriNet.arcs
              .filter(arc => arc.targetId === t.id && arc.sourceType === 'place')
              .map(arc => {
                const placeId = arc.sourceId;
                const place = currentPetriNet.places.find(p => p.id === placeId);
                return place ? `${placeId}(${place.tokens || 0})` : placeId;
              });
            console.log(`Transition ${t.id} - Input places:`, inputPlaces);
          }
        });
        
        console.log('Normalized enabled transitions:', normalizedResults);
        return normalizedResults;
      } else {
        console.warn('Python result has no toJs method, falling back to JS simulator');
        useJsFallback = true;
        simulator = new JsPetriNetSimulator(currentPetriNet || {});
        return simulator.getEnabledTransitions();
      }
    } catch (pythonError) {
      console.error('Error calling Python get_enabled_transitions:', pythonError);
      useJsFallback = true;
      simulator = new JsPetriNetSimulator(currentPetriNet || {});
      return simulator.getEnabledTransitions();
    }
  } catch (error) {
    console.error('Error getting enabled transitions:', error);
    try {
      // Last resort fallback
      useJsFallback = true;
      simulator = new JsPetriNetSimulator(currentPetriNet || {});
      return simulator.getEnabledTransitions();
    } catch (fallbackError) {
      console.error('Even fallback failed:', fallbackError);
      return []; // Return empty array as a safe fallback
    }
  }
}

/**
 * Check if two transitions are in conflict (share an input place with insufficient tokens for both)
 * @param {string} transition1Id - ID of the first transition
 * @param {string} transition2Id - ID of the second transition
 * @param {Array} places - Array of places in the Petri net
 * @param {Array} arcs - Array of arcs in the Petri net
 * @returns {Promise<boolean>} - True if the transitions are in conflict, false otherwise
 */
export async function areTransitionsInConflict(transition1Id, transition2Id, places, arcs) {
  try {
    if (!simulator) {
      throw new Error('Simulator not initialized');
    }
    
    // Check if we're using the JavaScript fallback
    if (simulator instanceof JsPetriNetSimulator) {
      // Get input places with their arcs for both transitions
      const inputPlacesWithArcs1 = simulator.getInputPlaces(transition1Id);
      const inputPlacesWithArcs2 = simulator.getInputPlaces(transition2Id);
      
      // Find shared input places
      const sharedPlaceIds = inputPlacesWithArcs1.map(([place]) => place.id)
        .filter(placeId => inputPlacesWithArcs2.some(([place]) => place.id === placeId));
      
      // If no shared places, no conflict
      if (sharedPlaceIds.length === 0) {
        return false;
      }
      
      // Check if any shared place has insufficient tokens for both transitions
      for (const sharedPlaceId of sharedPlaceIds) {
        // Find the place object
        const place = places.find(p => p.id === sharedPlaceId);
        if (!place) continue;
        
        // Get the arcs from this place to both transitions
        const arcToT1 = arcs.find(a => {
          const sourceId = a.sourceId || a.source;
          const targetId = a.targetId || a.target;
          return sourceId === sharedPlaceId && targetId === transition1Id;
        });
        
        const arcToT2 = arcs.find(a => {
          const sourceId = a.sourceId || a.source;
          const targetId = a.targetId || a.target;
          return sourceId === sharedPlaceId && targetId === transition2Id;
        });
        
        if (!arcToT1 || !arcToT2) continue;
        
        // Get arc weights (default to 1 if not specified)
        const weight1 = arcToT1.weight || 1;
        const weight2 = arcToT2.weight || 1;
        
        // Check if the place has enough tokens for both transitions
        const availableTokens = place.tokens || 0;
        if (availableTokens < weight1 + weight2) {
          // Not enough tokens for both transitions, they are in conflict
          return true;
        }
      }
      
      // If we get here, all shared places have enough tokens for both transitions
      return false;
    }
    
    // For Pyodide implementation, we'll use a similar approach
    // First, find input places with their arc weights for each transition
    const inputPlacesT1 = new Map();
    const inputPlacesT2 = new Map();
    
    // Find input places and weights for transition1
    for (const arc of arcs) {
      const sourceId = arc.sourceId || arc.source;
      const targetId = arc.targetId || arc.target;
      const sourceType = arc.sourceType;
      
      if ((sourceType === 'place' && targetId === transition1Id) || 
          (arc.type === 'place-to-transition' && targetId === transition1Id)) {
        inputPlacesT1.set(sourceId, arc.weight || 1);
      }
    }
    
    // Find input places and weights for transition2
    for (const arc of arcs) {
      const sourceId = arc.sourceId || arc.source;
      const targetId = arc.targetId || arc.target;
      const sourceType = arc.sourceType;
      
      if ((sourceType === 'place' && targetId === transition2Id) || 
          (arc.type === 'place-to-transition' && targetId === transition2Id)) {
        inputPlacesT2.set(sourceId, arc.weight || 1);
      }
    }
    
    // Find shared input places
    const sharedPlaceIds = [...inputPlacesT1.keys()].filter(placeId => inputPlacesT2.has(placeId));
    
    // If no shared places, no conflict
    if (sharedPlaceIds.length === 0) {
      return false;
    }
    
    // Check if any shared place has insufficient tokens for both transitions
    for (const sharedPlaceId of sharedPlaceIds) {
      // Find the place
      const place = places.find(p => p.id === sharedPlaceId);
      if (!place) continue;
      
      // Get the weights for both arcs
      const weight1 = inputPlacesT1.get(sharedPlaceId);
      const weight2 = inputPlacesT2.get(sharedPlaceId);
      
      // Check if the place has enough tokens for both transitions
      const availableTokens = place.tokens || 0;
      if (availableTokens < weight1 + weight2) {
        // Not enough tokens for both transitions, they are in conflict
        return true;
      }
    }
    
    // If we get here, all shared places have enough tokens for both transitions
    return false;
  } catch (error) {
    console.error('Error checking transition conflicts:', error);
    throw error;
  }
}

/**
 * Find all non-conflicting enabled transitions to fire simultaneously
 * @param {Array} enabledTransitions - Array of enabled transition objects
 * @param {Array} places - Array of places in the Petri net
 * @param {Array} arcs - Array of arcs in the Petri net
 * @returns {Promise<Array>} - Array of transition IDs to fire
 */
export async function findNonConflictingTransitions(enabledTransitions, places, arcs) {
  // If there are no enabled transitions, return an empty array
  if (!enabledTransitions || enabledTransitions.length === 0) {
    return [];
  }
  
  // If there's only one enabled transition, return it
  if (enabledTransitions.length === 1) {
    return [enabledTransitions[0].id];
  }
  
  // Shuffle the enabled transitions to ensure non-deterministic selection when conflicts exist
  const shuffledTransitions = [...enabledTransitions].sort(() => Math.random() - 0.5);
  
  const transitionsToFire = [];
  const conflictGroups = new Map(); // Maps transition IDs to their conflict group
  
  // Create conflict groups
  for (let i = 0; i < shuffledTransitions.length; i++) {
    const transitionId = shuffledTransitions[i].id;
    let foundGroup = false;
    
    // Check if this transition conflicts with any existing group
    for (const [groupId, groupTransitions] of conflictGroups.entries()) {
      let hasConflict = false;
      
      // Check if this transition conflicts with any transition in the group
      for (const groupTransitionId of groupTransitions) {
        const conflicting = await areTransitionsInConflict(transitionId, groupTransitionId, places, arcs);
        if (conflicting) {
          hasConflict = true;
          break;
        }
      }
      
      if (hasConflict) {
        // Add to existing conflict group
        conflictGroups.get(groupId).push(transitionId);
        foundGroup = true;
        break;
      }
    }
    
    if (!foundGroup) {
      // Create a new conflict group
      const newGroupId = `group-${i}`;
      conflictGroups.set(newGroupId, [transitionId]);
    }
  }
  
  // Select one transition from each conflict group (non-deterministically)
  for (const [groupId, groupTransitions] of conflictGroups.entries()) {
    // If the group has only one transition, select it
    if (groupTransitions.length === 1) {
      transitionsToFire.push(groupTransitions[0]);
    } else {
      // Randomly select one transition from the group
      const selectedTransition = groupTransitions[Math.floor(Math.random() * groupTransitions.length)];
      transitionsToFire.push(selectedTransition);
    }
  }
  
  return transitionsToFire;
}

/**
 * Fire multiple transitions simultaneously and update the marking
 * @param {Array} transitionIds - Array of transition IDs to fire
 * @returns {Promise<Object>} - Updated Petri net with new marking
 */
export async function fireMultipleTransitions(transitionIds) {
  try {
    if (!simulator) {
      throw new Error('Simulator not initialized');
    }
    
    if (transitionIds.length === 0) {
      throw new Error('No transitions to fire');
    }
    
    // If there's only one transition, use the existing fireTransition function
    if (transitionIds.length === 1) {
      return await fireTransition(transitionIds[0]);
    }
    
    // For JavaScript fallback, fire transitions one by one
    if (simulator instanceof JsPetriNetSimulator) {
      let updatedPetriNet = null;
      
      // Fire each transition in sequence
      for (const transitionId of transitionIds) {
        updatedPetriNet = simulator.fireTransition(transitionId);
        
        // Update the simulator with the new state after each firing
        simulator = new JsPetriNetSimulator(updatedPetriNet);
      }
      
      return updatedPetriNet;
    }
    
    // For Pyodide, we'll implement a simpler version until we add Python support for this
    // This is a simplification - it fires transitions sequentially, not truly simultaneously
    // For truly simultaneous firing, we would need to compute all token changes first,
    // then apply them all at once (which would require modifying the Python code)
    let currentPetriNet = null;
    let atLeastOneTransitionFired = false;
    
    // Get the current state before firing any transitions
    const initialPetriNet = {
      places: simulator?.petriNet?.places ? [...simulator.petriNet.places] : [],
      transitions: simulator?.petriNet?.transitions ? [...simulator.petriNet.transitions] : [],
      arcs: simulator?.petriNet?.arcs ? [...simulator.petriNet.arcs] : []
    };
    
    // Special case for single enabled transition (to avoid skipping T3)
    // Get the actually enabled transitions from Python simulator
    const enabledTransitions = await getEnabledTransitions();
    if (enabledTransitions.length === 1) {
      // Only one transition is enabled, firing it directly
      const singleTransitionId = enabledTransitions[0].id;
      
      try {
        // Fire it directly using the simulator
        const updatedPetriNet = await simulator.fire_transition(singleTransitionId);
        currentPetriNet = updatedPetriNet.toJs();
        
        // Update the simulator with the new state
        await updateSimulator(currentPetriNet);
        atLeastOneTransitionFired = true;
        
        // If this succeeded, return the updated Petri net
        // Successfully fired single transition
        return processUpdatedPetriNet(currentPetriNet);
      } catch (singleTransitionError) {
        console.error(`Error firing single transition ${singleTransitionId}:`, singleTransitionError);
      }
    }
    
    // If we get here, either we didn't have a single transition case or it failed
    // Standard case: Fire each transition in sequence, handling errors for individual transitions
    for (const transitionId of transitionIds) {
      try {
        // Check if the transition is still enabled before trying to fire it
        const isEnabled = await isTransitionEnabled(transitionId);
        if (!isEnabled) {
          console.warn(`Transition ${transitionId} is no longer enabled, skipping`);
          continue;
        }
        
        // Call the Python function to fire the transition
        const updatedPetriNet = await simulator.fire_transition(transitionId);
        currentPetriNet = updatedPetriNet.toJs();
        
        // Update the simulator with the new state
        await updateSimulator(currentPetriNet);
        atLeastOneTransitionFired = true;
      } catch (transitionError) {
        console.warn(`Error firing transition ${transitionId}:`, transitionError);
        // Continue with the next transition
      }
    }
    
    // If no transitions were fired successfully, return the initial Petri net
    if (!atLeastOneTransitionFired) {
      return initialPetriNet;
    }
    
    // Return the final updated Petri net with proper structure
    return processUpdatedPetriNet(currentPetriNet);
  } catch (error) {
    console.error('Error firing multiple transitions:', error);
    // Return the current Petri net state instead of throwing
    // This allows the simulation to continue even if there's an error
    return simulator?.petriNet ? simulator.petriNet : { places: [], transitions: [], arcs: [] };
  }
}

/**
 * Process the updated Petri net from Pyodide to ensure proper structure
 * @param {Object} jsPetriNet - The Petri net object from Pyodide
 * @returns {Object} - A properly structured Petri net object
 */
function processUpdatedPetriNet(jsPetriNet) {
  // Create a properly structured Petri net object
  const result = { places: [], transitions: [], arcs: [] };
  
  // Handle the case where jsPetriNet is a Map
  if (jsPetriNet instanceof Map) {
    // Extract places array from the Map
    const placesArray = jsPetriNet.get('places');
    if (placesArray && Array.isArray(placesArray)) {
      result.places = placesArray.map(place => {
        // If place is a Map, extract its properties
        if (place instanceof Map) {
          return {
            id: place.get('id'),
            name: place.get('name'),
            label: place.get('label') || place.get('name'),
            tokens: place.get('tokens') || 0,
            x: place.get('x') || 0,
            y: place.get('y') || 0
          };
        } else if (typeof place === 'object') {
          return {
            id: place.id,
            name: place.name,
            label: place.label || place.name,
            tokens: place.tokens || 0,
            x: place.x || 0,
            y: place.y || 0
          };
        }
        return place;
      });
    }
    
    // Extract transitions array from the Map
    const transitionsArray = jsPetriNet.get('transitions');
    if (transitionsArray && Array.isArray(transitionsArray)) {
      result.transitions = transitionsArray.map(transition => {
        // If transition is a Map, extract its properties
        if (transition instanceof Map) {
          return {
            id: transition.get('id'),
            name: transition.get('name'),
            label: transition.get('label') || transition.get('name'),
            x: transition.get('x') || 0,
            y: transition.get('y') || 0
          };
        } else if (typeof transition === 'object') {
          return {
            id: transition.id,
            name: transition.name,
            label: transition.label || transition.name,
            x: transition.x || 0,
            y: transition.y || 0
          };
        }
        return transition;
      });
    }
    
    // Extract arcs array from the Map
    const arcsArray = jsPetriNet.get('arcs');
    if (arcsArray && Array.isArray(arcsArray)) {
      result.arcs = arcsArray.map(arc => {
        // If arc is a Map, extract its properties
        if (arc instanceof Map) {
          return {
            id: arc.get('id'),
            sourceId: arc.get('sourceId') || arc.get('source'),
            targetId: arc.get('targetId') || arc.get('target'),
            sourceType: arc.get('sourceType'),
            targetType: arc.get('targetType'),
            sourceDirection: arc.get('sourceDirection'),
            targetDirection: arc.get('targetDirection'),
            weight: arc.get('weight') || 1,
            type: arc.get('type'),
            label: arc.get('label') || arc.get('name')
          };
        } else if (typeof arc === 'object') {
          return {
            id: arc.id,
            sourceId: arc.sourceId || arc.source,
            targetId: arc.targetId || arc.target,
            sourceType: arc.sourceType,
            targetType: arc.targetType,
            sourceDirection: arc.sourceDirection,
            targetDirection: arc.targetDirection,
            weight: arc.weight || 1,
            type: arc.type,
            label: arc.label || arc.name
          };
        }
        return arc;
      });
    }
  } else if (typeof jsPetriNet === 'object') {
    // Handle the case where jsPetriNet is a regular object
    if (jsPetriNet.places && Array.isArray(jsPetriNet.places)) {
      result.places = jsPetriNet.places;
    }
    if (jsPetriNet.transitions && Array.isArray(jsPetriNet.transitions)) {
      result.transitions = jsPetriNet.transitions;
    }
    if (jsPetriNet.arcs && Array.isArray(jsPetriNet.arcs)) {
      result.arcs = jsPetriNet.arcs;
    }
  }
  
  return result;
}

/**
 * Fire a transition and update the marking
 * @param {string} transitionId - The ID of the transition to fire
 * @returns {Promise<Object>} - Updated Petri net with new marking
 */
export async function fireTransition(transitionId) {
  try {
    // Check if the simulator is initialized
    if (!simulator) {
      console.warn('Simulator not initialized, initializing with default settings');
      await initializeSimulator({}, { maxTokens: 20 });
    }
    
    // Make sure we have a valid current Petri net state
    if (!currentPetriNet || !currentPetriNet.places || !currentPetriNet.transitions || !currentPetriNet.arcs) {
      console.error('Invalid Petri net state before firing transition');
      return currentPetriNet || { places: [], transitions: [], arcs: [] };
    }
    
    // Check if we're using the JavaScript fallback
    if (useJsFallback || simulator instanceof JsPetriNetSimulator) {
      // Ensure we're working with a complete copy of the current Petri net
      const result = simulator.fireTransition(transitionId);
      
      // Make sure the result has all required properties
      if (!result.places || !result.transitions || !result.arcs) {
        console.error('JS simulator returned incomplete Petri net');
        return { 
          places: result.places || currentPetriNet.places || [], 
          transitions: result.transitions || currentPetriNet.transitions || [], 
          arcs: result.arcs || currentPetriNet.arcs || [] 
        };
      }
      
      // Update the current Petri net reference
      currentPetriNet = result;
      return result;
    }
    
    // Using Python simulator
    try {
      // First check if the transition is enabled
      const isEnabled = await isTransitionEnabled(transitionId);
      if (!isEnabled) {
        console.warn(`Transition ${transitionId} is not enabled`);
        return currentPetriNet;
      }
      
      console.log(`Python simulator firing transition ${transitionId}`);
      
      // Call the Python method to fire the transition
      const updatedPetriNet = await simulator.fire_transition(transitionId);
      
      // Convert the Python result to a JavaScript object
      if (typeof updatedPetriNet.toJs === 'function') {
        // Convert the Python result to JavaScript and ensure proper type conversion
        const jsResult = updatedPetriNet.toJs();
        
        // Log raw result to diagnose issues
        console.log('Raw Python result:', jsResult);
        
        // Debug: Check what properties are available in the result
        if (jsResult.get) {
          console.log('Result is a Map object');
          console.log('Available keys:', Array.from(jsResult.keys()));
          console.log('Places:', jsResult.get('places'));
          console.log('Transitions:', jsResult.get('transitions'));
          console.log('Arcs:', jsResult.get('arcs'));
        } else {
          console.log('Result is a plain object');
          console.log('Available properties:', Object.keys(jsResult));
          console.log('Places:', jsResult.places);
          console.log('Transitions:', jsResult.transitions);
          console.log('Arcs:', jsResult.arcs);
        }
        
        // Extract token values from Python simulator's internal state
        // This ensures we get the actual updated token counts
        let updatedTokens = {};
        try {
          // Get the current token values directly from Python simulator's internal state
          const tokenValues = await pyodideInstance.runPythonAsync(`
            token_values = {}
            for place in simulator.places:
                try:
                    # Handle different place object types
                    if hasattr(place, 'get'):
                        place_id = place.get('id')
                        tokens = place.get('tokens', 0)
                    elif isinstance(place, dict):
                        place_id = place.get('id')
                        tokens = place.get('tokens', 0)
                    else:
                        # Fallback for other object types
                        place_id = getattr(place, 'id', str(place))
                        tokens = getattr(place, 'tokens', 0)
                    
                    # Ensure we have valid values
                    if place_id is not None and tokens is not None:
                        token_values[str(place_id)] = int(tokens)
                        print(f"Extracted tokens for place {place_id}: {tokens}")
                    else:
                        print(f"Warning: Invalid place data - id: {place_id}, tokens: {tokens}")
                except Exception as e:
                    print(f"Error processing place: {e}")
                    continue
            
            print(f"Python simulator internal token state: {token_values}")
            token_values
          `);
          
          // Convert Python dict to JS object
          updatedTokens = tokenValues.toJs();
          console.log('Updated token values from Python:', updatedTokens);
          
          // Also verify the Python simulator's current state
          await pyodideInstance.runPythonAsync(`
            print("Verifying Python simulator state after firing:")
            for place in simulator.places:
                try:
                    if hasattr(place, 'get'):
                        place_id = place.get('id')
                        tokens = place.get('tokens', 0)
                    elif isinstance(place, dict):
                        place_id = place.get('id')
                        tokens = place.get('tokens', 0)
                    else:
                        place_id = getattr(place, 'id', str(place))
                        tokens = getattr(place, 'tokens', 0)
                    print(f"  Place {place_id}: {tokens} tokens")
                except Exception as e:
                    print(f"  Error reading place: {e}")
          `);
        } catch (err) {
          console.error('Failed to get token values from Python:', err);
          
          // Fallback: try to extract tokens from the returned Petri net
          console.log('Attempting fallback token extraction from returned Petri net...');
          try {
            const places = jsResult.get ? jsResult.get('places') : jsResult.places;
            if (places && Array.isArray(places)) {
              for (const place of places) {
                const placeId = place instanceof Map ? place.get('id') : place.id;
                const tokens = place instanceof Map ? place.get('tokens') : place.tokens;
                if (placeId && tokens !== undefined) {
                  updatedTokens.set(placeId, Number(tokens));
                  console.log(`Fallback: extracted tokens for place ${placeId}: ${tokens}`);
                }
              }
            }
          } catch (fallbackErr) {
            console.error('Fallback token extraction also failed:', fallbackErr);
          }
        }
        
        // Check if jsResult is returning empty or incorrect data
        const places = jsResult.get ? jsResult.get('places') : jsResult.places;
        if (!places || !Array.isArray(places) || places.length === 0) {
          console.warn('Python simulator returned no places, using current Petri net places instead');
          // Fall back to current Petri net if places are missing
          if (jsResult.get) {
            jsResult.set('places', currentPetriNet.places);
          } else {
            jsResult.places = currentPetriNet.places;
          }
        }
        
        // Process the places to ensure tokens are properly converted to numbers
        // and use the directly extracted token values from Python
        console.log('Processing places with updated tokens:', updatedTokens);
        console.log('Current Petri net places:', currentPetriNet.places);
        console.log('JS result places:', jsResult.get ? jsResult.get('places') : jsResult.places);
        
        // Instead of trying to process jsResult.places (which might be incomplete),
        // we'll update the current places with new token values from Python
        const processedPlaces = currentPetriNet.places.map(place => {
          // Get the updated token count from Python simulator
          const updatedTokenCount = updatedTokens.get ? updatedTokens.get(place.id) : updatedTokens[place.id];
          
          console.log(`Processing place ${place.id}: current tokens=${place.tokens}, updated tokens=${updatedTokenCount}`);
          
          // Always preserve all original properties and only update tokens
          if (updatedTokenCount !== undefined) {
            console.log(`Updating place ${place.id} tokens from ${place.tokens} to ${updatedTokenCount} (from Python)`);
            return {
              ...place,
              tokens: Number(updatedTokenCount)
            };
          } else {
            // If no updated token count is available, keep the current value
            console.warn(`No updated token count available for place ${place.id}, keeping current value: ${place.tokens}`);
            return {
              ...place,
              tokens: place.tokens !== undefined ? Number(place.tokens) : 0
            };
          }
        });
        
        // Ensure the result has all required properties with properly processed data
        // We only update places (tokens), transitions and arcs remain unchanged
        const processedResult = {
          places: processedPlaces.length > 0 ? processedPlaces : currentPetriNet.places || [],
          transitions: currentPetriNet.transitions || [], // Preserve current transitions
          arcs: currentPetriNet.arcs || [] // Preserve current arcs
        };
        
        // Verify we have all elements
        if (processedResult.places.length === 0) {
          console.error('Places array is empty after processing!');
          processedResult.places = [...currentPetriNet.places];
        }
        
        // Debug logging to show token changes and validate coordinates
        console.log('Token changes after firing:');
        processedPlaces.forEach(place => {
          const oldPlace = currentPetriNet.places?.find(p => p.id === place.id);
          const oldTokens = oldPlace ? oldPlace.tokens : 'unknown';
          const newTokens = place.tokens;
          console.log(`Place ${place.id}: ${oldTokens} -> ${newTokens}`);
          
          // Validate that coordinates are preserved
          if (oldPlace) {
            if (place.x !== oldPlace.x || place.y !== oldPlace.y) {
              console.warn(`Place ${place.id} coordinates changed: (${oldPlace.x},${oldPlace.y}) -> (${place.x},${place.y})`);
            }
            if (isNaN(place.x) || isNaN(place.y)) {
              console.error(`Place ${place.id} has invalid coordinates: x=${place.x}, y=${place.y}`);
            }
          }
        });
        
        // Log the result for debugging and validate structure
        console.log(`Python simulator fired transition successfully. Places: ${processedResult.places.length}, Transitions: ${processedResult.transitions.length}, Arcs: ${processedResult.arcs.length}`);
        
        // Validate that all elements have required properties
        processedResult.places.forEach(place => {
          if (!place.id || place.x === undefined || place.y === undefined || place.tokens === undefined) {
            console.error(`Invalid place structure:`, place);
          }
        });
        
        processedResult.transitions.forEach(transition => {
          if (!transition.id || transition.x === undefined || transition.y === undefined) {
            console.error(`Invalid transition structure:`, transition);
          }
        });
        
        processedResult.arcs.forEach(arc => {
          // Handle both sourceId/targetId (editor) and source/target (PNML) properties
          const hasValidSource = arc.sourceId || arc.source;
          const hasValidTarget = arc.targetId || arc.target;
          if (!arc.id || !hasValidSource || !hasValidTarget) {
            console.error(`Invalid arc structure:`, arc);
          }
        });
        
        // Final validation: ensure all elements have valid IDs and required properties
        const validatedResult = {
          places: processedResult.places.filter(place => {
            if (!place.id || isNaN(place.x) || isNaN(place.y) || place.tokens === undefined) {
              console.error(`Filtering out invalid place:`, place);
              return false;
            }
            return true;
          }),
          transitions: processedResult.transitions.filter(transition => {
            if (!transition.id || isNaN(transition.x) || isNaN(transition.y)) {
              console.error(`Filtering out invalid transition:`, transition);
              return false;
            }
            return true;
          }),
          arcs: processedResult.arcs.filter(arc => {
            // Handle both sourceId/targetId (editor) and source/target (PNML) properties
            const hasValidSource = arc.sourceId || arc.source;
            const hasValidTarget = arc.targetId || arc.target;
            if (!arc.id || !hasValidSource || !hasValidTarget) {
              console.error(`Filtering out invalid arc:`, arc);
              return false;
            }
            return true;
          })
        };
        
        console.log(`Validation complete. Valid elements: ${validatedResult.places.length} places, ${validatedResult.transitions.length} transitions, ${validatedResult.arcs.length} arcs`);
        
        // Update the current Petri net reference with a deep copy to ensure React state updates
        currentPetriNet = JSON.parse(JSON.stringify(validatedResult));
        
        // Update the Python simulator's internal state to ensure consistency
        // This is critical to ensure the Python simulator's internal state matches the JS state
        try {
          // First, let's log the current token state for debugging
          await pyodideInstance.runPythonAsync(`
            print("Current Python simulator token state:")
            for place in simulator.places:
                place_id = place.get('id')
                tokens = place.get('tokens', 0)
                print(f"Place {place_id}: {tokens} tokens")
          `);
          
          // Now update the Python simulator with our processed state
          // Important: Make deep copies to ensure we don't lose references
          await pyodideInstance.runPythonAsync(`
            # Log the current state
            print(f"Before update: {len(simulator.places)} places, {len(simulator.transitions)} transitions, {len(simulator.arcs)} arcs")
            
            # Create a copy of the current places for token updates
            if len(${pyodideInstance.toPy(processedResult.places)}) == 0:
                print("WARNING: Received empty places array, preserving current places")
            else:
                # Create a dictionary of place IDs to token counts from the processed result
                new_token_values = {}
                for place in ${pyodideInstance.toPy(processedResult.places)}:
                    place_id = place.get('id') if isinstance(place, dict) else place['id']
                    tokens = place.get('tokens', 0) if isinstance(place, dict) else place['tokens']
                    new_token_values[place_id] = int(tokens)
                
                # Update the token counts in the simulator's places
                for place in simulator.places:
                    place_id = place.get('id')
                    if place_id in new_token_values:
                        place['tokens'] = new_token_values[place_id]
                        print(f"Updated Python simulator place {place_id} tokens to {new_token_values[place_id]}")
                
                # Only update token values, preserve the existing structure
                # simulator.transitions and simulator.arcs should remain unchanged
                # simulator.petri_net should only be updated with token changes
                
            print(f"Python simulator internal state updated with {len(simulator.places)} places, {len(simulator.transitions)} transitions, {len(simulator.arcs)} arcs")
            
            # Verify token counts after update
            print("Updated Python simulator token state:")
            for place in simulator.places:
                place_id = place.get('id')
                tokens = place.get('tokens', 0)
                print(f"Place {place_id}: {tokens} tokens")
          `);
          
          // Double check our internal state is correct
          if (processedResult.places.length === 0) {
            console.error('WARNING: Zero places in processedResult, state may be corrupted!');
          }
        } catch (updateError) {
          console.warn('Failed to update Python simulator internal state:', updateError);
        }
        
        return validatedResult;
      } else {
        console.warn('Python result has no toJs method, falling back to JS simulator');
        useJsFallback = true;
        simulator = new JsPetriNetSimulator(currentPetriNet);
        return simulator.fireTransition(transitionId);
      }
    } catch (pythonError) {
      console.error(`Error calling Python fire_transition for ${transitionId}:`, pythonError);
      useJsFallback = true;
      simulator = new JsPetriNetSimulator(currentPetriNet);
      return simulator.fireTransition(transitionId);
    }
  } catch (error) {
    console.error(`Error firing transition ${transitionId}:`, error);
    try {
      // Last resort fallback
      useJsFallback = true;
      simulator = new JsPetriNetSimulator(currentPetriNet);
      return simulator.fireTransition(transitionId);
    } catch (fallbackError) {
      console.error('Even fallback failed:', fallbackError);
      // Return unchanged Petri net as a safe fallback, ensuring it has all required properties
      return { 
        places: currentPetriNet?.places || [], 
        transitions: currentPetriNet?.transitions || [], 
        arcs: currentPetriNet?.arcs || [] 
      };
    }
  }
}

/**
 * Check if a transition is enabled
 * @param {string} transitionId - The ID of the transition to check
 * @returns {Promise<boolean>} - True if the transition is enabled, False otherwise
 */
export async function isTransitionEnabled(transitionId) {
  try {
    // Check if the simulator is initialized
    if (!simulator) {
      console.warn('Simulator not initialized, initializing with default settings');
      await initializeSimulator({}, { maxTokens: 20 });
    }
    
    // Check if we're using the JavaScript fallback
    if (useJsFallback || simulator instanceof JsPetriNetSimulator) {
      return simulator.isTransitionEnabled(transitionId);
    }
    
    // Using Python simulator
    try {
      // Make sure the Python simulator has the latest Petri net state
      try {
        if (pyodideInstance && currentPetriNet) {
          // Update the Python simulator's internal state to ensure consistency
          await pyodideInstance.runPythonAsync(`
            # Ensure simulator has the latest state
            if 'simulator' in globals():
              simulator.places = ${pyodideInstance.toPy(currentPetriNet.places || [])}
              simulator.transitions = ${pyodideInstance.toPy(currentPetriNet.transitions || [])}
              simulator.arcs = ${pyodideInstance.toPy(currentPetriNet.arcs || [])}
              simulator.petri_net = ${pyodideInstance.toPy(currentPetriNet)}
          `);
        }
      } catch (updateError) {
        console.warn('Failed to update Python simulator state before checking enabled transition:', updateError);
      }
      
      // Call the Python method to check if the transition is enabled
      const isEnabled = await simulator.is_transition_enabled(transitionId);
      console.log(`Python simulator checking if transition ${transitionId} is enabled: ${isEnabled}`);
      
      // Convert the Python result to a JavaScript boolean
      if (typeof isEnabled === 'boolean') {
        return isEnabled;
      } else if (typeof isEnabled?.toJs === 'function') {
        const result = Boolean(isEnabled.toJs());
        console.log(`Python simulator transition ${transitionId} enabled status: ${result}`);
        return result;
      } else if (isEnabled) {
        // If it's truthy but not a boolean or has no toJs function
        return true;
      }
      return false;
    } catch (pythonError) {
      console.error(`Error calling Python is_transition_enabled for ${transitionId}:`, pythonError);
      useJsFallback = true;
      simulator = new JsPetriNetSimulator(currentPetriNet || {});
      return simulator.isTransitionEnabled(transitionId);
    }
  } catch (error) {
    console.error(`Error checking if transition ${transitionId} is enabled:`, error);
    try {
      // Last resort fallback
      useJsFallback = true;
      simulator = new JsPetriNetSimulator(currentPetriNet || {});
      return simulator.isTransitionEnabled(transitionId);
    } catch (fallbackError) {
      console.error('Even fallback failed:', fallbackError);
      return false; // Default to not enabled as a safe fallback
    }
  }
}

/**
 * Compute all reachable markings from the current marking
 * @param {number} maxSteps - Maximum number of steps to compute
 * @returns {Promise<Array>} - List of reachable markings
 */
export async function computeReachableMarkings(maxSteps = 100) {
  try {
    // Check if the simulator is initialized
    if (!simulator) {
      console.warn('Simulator not initialized, initializing with default settings');
      await initializeSimulator({}, { maxTokens: 20 });
    }
    
    // Currently only implemented in Python, so return an empty array for JS fallback
    // Since we're using JS fallback for stability, just return empty array
    console.warn('computeReachableMarkings not implemented in JS fallback');
    return [];
  } catch (error) {
    console.error('Error computing reachable markings:', error);
    return [];
  }
}

/**
 * Update the simulator with a new Petri net state
 * @param {Object} petriNet - The updated Petri net in JSON format
 * @returns {Promise<void>}
 */
export async function updateSimulator(petriNet) {
  try {
    // Store the current Petri net for reference
    currentPetriNet = petriNet;
    
    // If we already have a simulator, just update its state instead of reinitializing
    if (simulator) {
      // For JS simulator, directly update the internal state
      if (simulator instanceof JsPetriNetSimulator) {
        // Update the internal state of the simulator
        simulator.petriNet = petriNet;
        simulator.places = petriNet.places || [];
        simulator.transitions = petriNet.transitions || [];
        simulator.arcs = petriNet.arcs || [];
        console.log('Updated existing JS simulator with new Petri net state');
        return;
      } 
      // For Python simulator, we need to reinitialize
      else if (Date.now() - lastInitTime >= MIN_INIT_INTERVAL) {
        // Only reinitialize if enough time has passed since the last initialization
        await initializeSimulator(petriNet);
        console.log('Reinitialized Python simulator with new Petri net state');
        return;
      } else {
        console.log('Skipping Python simulator update, too soon after last initialization');
        return;
      }
    }
    
    // If we don't have a simulator yet, initialize one
    await initializeSimulator(petriNet);
    console.log('Initialized new simulator with Petri net state');
  } catch (error) {
    console.error('Error updating simulator:', error);
    // Try to create a new JS simulator as fallback
    try {
      useJsFallback = true;
      simulator = new JsPetriNetSimulator(petriNet || {});
      console.warn('Created fallback JS simulator during update');
    } catch (fallbackError) {
      console.error('Failed to create fallback simulator:', fallbackError);
    }
  }
}
