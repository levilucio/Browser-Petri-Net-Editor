/**
 * JavaScript wrapper for the Petri Net Simulator
 * This module provides functions to interact with the Python simulator engine
 * using Pyodide to compute enabled transitions and update markings.
 */

// Keep a single instance of Pyodide to avoid reloading
let pyodideInstance = null;
let simulator = null;
let pyodideLoading = null;

// Simple implementation of Petri net simulator in JavaScript as a fallback
// Export the class for testing
export class JsPetriNetSimulator {
  constructor(petriNet) {
    this.petriNet = petriNet;
    this.places = petriNet.places || [];
    this.transitions = petriNet.transitions || [];
    this.arcs = petriNet.arcs || [];
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
    const enabledTransitions = [];
    
    for (const transition of this.transitions) {
      if (this.isTransitionEnabled(transition.id)) {
        enabledTransitions.push(transition);
      }
    }
    
    return enabledTransitions;
  }

  fireTransition(transitionId) {
    // Check if the transition is enabled
    if (!this.isTransitionEnabled(transitionId)) {
      throw new Error(`Transition ${transitionId} is not enabled`);
    }
    
    // Get input and output places
    const inputPlaces = this.getInputPlaces(transitionId);
    const outputPlaces = this.getOutputPlaces(transitionId);
    
    // Create a deep copy of the Petri net to update
    const updatedPetriNet = {
      places: JSON.parse(JSON.stringify(this.places)),
      transitions: this.transitions,
      arcs: this.arcs
    };
    
    // Remove tokens from input places
    for (const [place, arc] of inputPlaces) {
      const weight = arc.weight || 1;
      const placeId = place.id;
      
      // Find the place in the updated Petri net
      const updatedPlace = updatedPetriNet.places.find(p => p.id === placeId);
      if (updatedPlace) {
        updatedPlace.tokens = Math.max(0, (updatedPlace.tokens || 0) - weight);
      }
    }
    
    // Add tokens to output places
    for (const [place, arc] of outputPlaces) {
      const weight = arc.weight || 1;
      const placeId = place.id;
      
      // Find the place in the updated Petri net
      const updatedPlace = updatedPetriNet.places.find(p => p.id === placeId);
      if (updatedPlace) {
        // Enforce token limit (20 per place)
        updatedPlace.tokens = Math.min(20, (updatedPlace.tokens || 0) + weight);
      }
    }
    
    return updatedPetriNet;
  }
}

// Flag to use JavaScript fallback if Pyodide fails
let useJsFallback = false;

/**
 * Initialize Pyodide and load the simulator module
 * @returns {Promise<Object>} - Pyodide instance
 */
export async function initializePyodide() {
  // If we've already decided to use the JS fallback, don't try to load Pyodide again
  if (useJsFallback) {
    return null;
  }
  
  if (pyodideInstance) {
    return pyodideInstance;
  }
  
  if (pyodideLoading) {
    return pyodideLoading;
  }

  try {
    console.log('Loading Pyodide from CDN...');
    // Create a loading promise to prevent multiple simultaneous loads
    pyodideLoading = new Promise(async (resolve, reject) => {
      try {
        // Check if Pyodide is already loaded
        if (window.loadPyodide) {
          console.log('Pyodide already loaded globally');
          pyodideInstance = await window.loadPyodide();
          await loadSimulatorCode(pyodideInstance);
          resolve(pyodideInstance);
          return;
        }
        
        // Load Pyodide script from CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
        script.async = true;
        
        script.onload = async () => {
          try {
            console.log('Pyodide script loaded, initializing...');
            // Initialize Pyodide
            pyodideInstance = await window.loadPyodide();
            await loadSimulatorCode(pyodideInstance);
            resolve(pyodideInstance);
          } catch (error) {
            console.error('Error initializing Pyodide after script load:', error);
            useJsFallback = true;
            reject(error);
          }
        };
        
        script.onerror = (error) => {
          console.error('Error loading Pyodide script:', error);
          useJsFallback = true;
          reject(new Error('Failed to load Pyodide script'));
        };
        
        document.head.appendChild(script);
      } catch (error) {
        console.error('Error in Pyodide loading process:', error);
        useJsFallback = true;
        reject(error);
      }
    });
    
    return await pyodideLoading;
  } catch (error) {
    console.error('Error initializing Pyodide:', error);
    useJsFallback = true;
    pyodideLoading = null;
    throw error;
  }
}

/**
 * Load the simulator code into Pyodide
 * @param {Object} pyodide - Pyodide instance
 * @returns {Promise<void>}
 */
async function loadSimulatorCode(pyodide) {
  try {
    console.log('Loading simulator module...');
    // We don't need micropip or lxml for our basic simulator
    
    // Load the simulator code
    const simulatorCode = await fetchSimulatorCode();
    
    // Run the simulator code
    await pyodide.runPythonAsync(simulatorCode);
    
    console.log('Pyodide and simulator module loaded successfully');
  } catch (error) {
    console.error('Error loading simulator code:', error);
    throw error;
  }
}

/**
 * Fetch the simulator code from the server
 * @returns {Promise<string>} - The simulator code
 */
async function fetchSimulatorCode() {
  // Define the simulator code inline to avoid fetch issues
  return `
"""\nPetri Net Simulator Engine\nThis module provides functions to simulate Petri nets, including:\n- Computing enabled transitions\n- Firing transitions\n- Updating markings\n"""\n\nclass PetriNetSimulator:\n    """\n    A simulator for Petri nets that computes enabled transitions and updates markings.\n    """\n    \n    def __init__(self, petri_net):\n        """\n        Initialize the simulator with a Petri net.\n        \n        Args:\n            petri_net (dict): The Petri net in JSON format with places, transitions, and arcs\n        """\n        self.petri_net = petri_net\n        self.places = petri_net.get('places', [])\n        self.transitions = petri_net.get('transitions', [])\n        self.arcs = petri_net.get('arcs', [])\n        \n    def get_input_places(self, transition_id):\n        """\n        Get all input places for a transition.\n        \n        Args:\n            transition_id (str): The ID of the transition\n            \n        Returns:\n            list: List of (place, arc) tuples for all input places\n        """\n        input_places = []\n        \n        for arc in self.arcs:\n            # Check if the arc is from a place to this transition\n            source_id = arc.get('sourceId') or arc.get('source')\n            target_id = arc.get('targetId') or arc.get('target')\n            source_type = arc.get('sourceType')\n            \n            # Handle both editor-created arcs and PNML-loaded arcs\n            if ((source_type == 'place' and target_id == transition_id) or \n                (arc.get('type') == 'place-to-transition' and target_id == transition_id)):\n                # Find the place\n                place = next((p for p in self.places if p.get('id') == source_id), None)\n                if place:\n                    input_places.append((place, arc))\n                    \n        return input_places\n    \n    def get_output_places(self, transition_id):\n        """\n        Get all output places for a transition.\n        \n        Args:\n            transition_id (str): The ID of the transition\n            \n        Returns:\n            list: List of (place, arc) tuples for all output places\n        """\n        output_places = []\n        \n        for arc in self.arcs:\n            # Check if the arc is from this transition to a place\n            source_id = arc.get('sourceId') or arc.get('source')\n            target_id = arc.get('targetId') or arc.get('target')\n            target_type = arc.get('targetType')\n            \n            # Handle both editor-created arcs and PNML-loaded arcs\n            if ((target_type == 'place' and source_id == transition_id) or \n                (arc.get('type') == 'transition-to-place' and source_id == transition_id)):\n                # Find the place\n                place = next((p for p in self.places if p.get('id') == target_id), None)\n                if place:\n                    output_places.append((place, arc))\n                    \n        return output_places\n    \n    def is_transition_enabled(self, transition_id):\n        """\n        Check if a transition is enabled.\n        \n        Args:\n            transition_id (str): The ID of the transition\n            \n        Returns:\n            bool: True if the transition is enabled, False otherwise\n        """\n        input_places = self.get_input_places(transition_id)\n        \n        # A transition is enabled if all input places have enough tokens\n        for place, arc in input_places:\n            # Get the arc weight (default to 1 if not specified)\n            weight = arc.get('weight', 1)\n            \n            # Check if the place has enough tokens\n            if place.get('tokens', 0) < weight:\n                return False\n                \n        return True\n    \n    def get_enabled_transitions(self):\n        """\n        Get all enabled transitions in the Petri net.\n        \n        Returns:\n            list: List of enabled transition objects\n        """\n        enabled_transitions = []\n        \n        for transition in self.transitions:\n            if self.is_transition_enabled(transition.get('id')):\n                enabled_transitions.append(transition)\n                \n        return enabled_transitions\n    \n    def fire_transition(self, transition_id):\n        """\n        Fire a transition and update the marking.\n        \n        Args:\n            transition_id (str): The ID of the transition to fire\n            \n        Returns:\n            dict: Updated Petri net with new marking\n            \n        Raises:\n            ValueError: If the transition is not enabled\n        """\n        # Check if the transition is enabled\n        if not self.is_transition_enabled(transition_id):\n            raise ValueError(f"Transition {transition_id} is not enabled")\n            \n        # Get input and output places\n        input_places = self.get_input_places(transition_id)\n        output_places = self.get_output_places(transition_id)\n        \n        # Create a deep copy of the Petri net to update\n        updated_petri_net = {\n            'places': [dict(place) for place in self.places],\n            'transitions': self.transitions,\n            'arcs': self.arcs\n        }\n        \n        # Remove tokens from input places\n        for place, arc in input_places:\n            weight = arc.get('weight', 1)\n            place_id = place.get('id')\n            \n            # Find the place in the updated Petri net\n            updated_place = next((p for p in updated_petri_net['places'] if p.get('id') == place_id), None)\n            if updated_place:\n                updated_place['tokens'] = max(0, updated_place.get('tokens', 0) - weight)\n        \n        # Add tokens to output places\n        for place, arc in output_places:\n            weight = arc.get('weight', 1)\n            place_id = place.get('id')\n            \n            # Find the place in the updated Petri net\n            updated_place = next((p for p in updated_petri_net['places'] if p.get('id') == place_id), None)\n            if updated_place:\n                # Enforce token limit (20 per place)\n                updated_place['tokens'] = min(20, updated_place.get('tokens', 0) + weight)\n        \n        return updated_petri_net\n    \n    def compute_reachable_markings(self, max_steps=100):\n        """\n        Compute all reachable markings from the current marking.\n        \n        Args:\n            max_steps (int): Maximum number of steps to compute\n            \n        Returns:\n            list: List of reachable markings\n        """\n        # Start with the current marking\n        markings = [self._extract_marking()]\n        visited_markings = set([self._marking_to_tuple(markings[0])])\n        \n        # Keep track of the current Petri net state\n        current_petri_net = self.petri_net\n        \n        # Breadth-first search for reachable markings\n        steps = 0\n        while steps < max_steps:\n            steps += 1\n            \n            # Create a simulator for the current Petri net\n            simulator = PetriNetSimulator(current_petri_net)\n            \n            # Get enabled transitions\n            enabled_transitions = simulator.get_enabled_transitions()\n            if not enabled_transitions:\n                break\n                \n            # Try firing each enabled transition\n            new_markings_found = False\n            for transition in enabled_transitions:\n                # Fire the transition\n                new_petri_net = simulator.fire_transition(transition.get('id'))\n                \n                # Extract the new marking\n                new_marking = self._extract_marking(new_petri_net)\n                new_marking_tuple = self._marking_to_tuple(new_marking)\n                \n                # Check if we've seen this marking before\n                if new_marking_tuple not in visited_markings:\n                    markings.append(new_marking)\n                    visited_markings.add(new_marking_tuple)\n                    new_markings_found = True\n                    \n                    # Update the current Petri net\n                    current_petri_net = new_petri_net\n            \n            # If no new markings were found, we've reached a fixed point\n            if not new_markings_found:\n                break\n                \n        return markings\n    \n    def _extract_marking(self, petri_net=None):\n        """\n        Extract the current marking from the Petri net.\n        \n        Args:\n            petri_net (dict, optional): The Petri net to extract the marking from.\n                If None, use the simulator's Petri net.\n                \n        Returns:\n            dict: Mapping from place ID to token count\n        """\n        petri_net = petri_net or self.petri_net\n        places = petri_net.get('places', [])\n        \n        marking = {}\n        for place in places:\n            marking[place.get('id')] = place.get('tokens', 0)\n            \n        return marking\n    \n    def _marking_to_tuple(self, marking):\n        """\n        Convert a marking dict to a tuple for hashing.\n        \n        Args:\n            marking (dict): Mapping from place ID to token count\n            \n        Returns:\n            tuple: Tuple representation of the marking\n        """\n        return tuple(sorted((k, v) for k, v in marking.items())))
  `;
}

/**
 * Initialize the simulator with a Petri net
 * @param {Object} petriNet - The Petri net in JSON format with places, transitions, and arcs
 * @returns {Promise<void>}
 */
export async function initializeSimulator(petriNet) {
  try {
    // Check if we should use the JavaScript fallback
    if (useJsFallback) {
      console.log('Using JavaScript fallback for simulator');
      simulator = new JsPetriNetSimulator(petriNet);
      return;
    }
    
    // Try to initialize Pyodide
    try {
      // Make sure Pyodide is initialized
      const pyodide = await initializePyodide();
      
      // If Pyodide failed to load, use the JavaScript fallback
      if (!pyodide) {
        console.log('Pyodide failed to load, using JavaScript fallback');
        simulator = new JsPetriNetSimulator(petriNet);
        return;
      }
      
      // Convert the Petri net to a Python object
      const petriNetPy = pyodide.toPy(petriNet);
      
      // Create a new simulator instance
      simulator = await pyodide.runPythonAsync(`
        simulator = PetriNetSimulator(${petriNetPy})
        simulator
      `);
      
      console.log('Simulator initialized with Petri net using Pyodide');
    } catch (error) {
      console.error('Error initializing Pyodide simulator:', error);
      console.log('Falling back to JavaScript simulator');
      simulator = new JsPetriNetSimulator(petriNet);
    }
  } catch (error) {
    console.error('Error initializing simulator (both Pyodide and JS fallback):', error);
    throw error;
  }
}

/**
 * Get all enabled transitions in the Petri net
 * @returns {Promise<Array>} - List of enabled transition objects
 */
export async function getEnabledTransitions() {
  try {
    if (!simulator) {
      throw new Error('Simulator not initialized');
    }
    
    // Check if we're using the JavaScript fallback
    if (simulator instanceof JsPetriNetSimulator) {
      return simulator.getEnabledTransitions();
    }
    
    // Call the Python function to get enabled transitions
    const enabledTransitions = await simulator.get_enabled_transitions();
    
    // Convert the Python list to a JavaScript array
    return enabledTransitions.toJs();
  } catch (error) {
    console.error('Error getting enabled transitions:', error);
    throw error;
  }
}

/**
 * Fire a transition and update the marking
 * @param {string} transitionId - The ID of the transition to fire
 * @returns {Promise<Object>} - Updated Petri net with new marking
 */
export async function fireTransition(transitionId) {
  try {
    if (!simulator) {
      throw new Error('Simulator not initialized');
    }
    
    // Check if we're using the JavaScript fallback
    if (simulator instanceof JsPetriNetSimulator) {
      return simulator.fireTransition(transitionId);
    }
    
    // Call the Python function to fire the transition
    const updatedPetriNet = await simulator.fire_transition(transitionId);
    
    // Convert the Python object to a JavaScript object
    return updatedPetriNet.toJs();
  } catch (error) {
    console.error(`Error firing transition ${transitionId}:`, error);
    throw error;
  }
}

/**
 * Check if a transition is enabled
 * @param {string} transitionId - The ID of the transition to check
 * @returns {Promise<boolean>} - True if the transition is enabled, False otherwise
 */
export async function isTransitionEnabled(transitionId) {
  try {
    if (!simulator) {
      throw new Error('Simulator not initialized');
    }
    
    // Check if we're using the JavaScript fallback
    if (simulator instanceof JsPetriNetSimulator) {
      return simulator.isTransitionEnabled(transitionId);
    }
    
    // Call the Python function to check if the transition is enabled
    const isEnabled = await simulator.is_transition_enabled(transitionId);
    
    // Convert the Python boolean to a JavaScript boolean
    return isEnabled.toJs();
  } catch (error) {
    console.error(`Error checking if transition ${transitionId} is enabled:`, error);
    throw error;
  }
}

/**
 * Compute all reachable markings from the current marking
 * @param {number} maxSteps - Maximum number of steps to compute
 * @returns {Promise<Array>} - List of reachable markings
 */
export async function computeReachableMarkings(maxSteps = 100) {
  try {
    if (!simulator) {
      throw new Error('Simulator not initialized');
    }
    
    // Currently only implemented in Python, so return an empty array for JS fallback
    if (simulator instanceof JsPetriNetSimulator) {
      console.warn('computeReachableMarkings not implemented in JS fallback');
      return [];
    }
    
    // Call the Python function to compute reachable markings
    const reachableMarkings = await simulator.compute_reachable_markings(maxSteps);
    
    // Convert the Python list to a JavaScript array
    return reachableMarkings.toJs();
  } catch (error) {
    console.error('Error computing reachable markings:', error);
    throw error;
  }
}

/**
 * Update the simulator with a new Petri net state
 * @param {Object} petriNet - The updated Petri net in JSON format
 * @returns {Promise<void>}
 */
export async function updateSimulator(petriNet) {
  try {
    // Re-initialize the simulator with the updated Petri net
    await initializeSimulator(petriNet);
  } catch (error) {
    console.error('Error updating simulator:', error);
    throw error;
  }
}
