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
    
    // Found input and output places
    
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
        const oldTokens = updatedPlace.tokens || 0;
        updatedPlace.tokens = Math.max(0, oldTokens - weight);
        // Updated place tokens
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
        // Updated place tokens
      }
    }
    
    // Update the internal state of the simulator
    this.petriNet = updatedPetriNet;
    this.places = updatedPetriNet.places;
    
    return updatedPetriNet;
  }
}

// Flag to use JavaScript fallback by default for better performance
let useJsFallback = true;

// Only set to false when simulation is actually running

/**
 * Activate simulation mode - switches to use the full Pyodide simulator
 * This should be called when starting simulation to ensure accurate results
 */
export function activateSimulation() {
  useJsFallback = false;
}

/**
 * Deactivate simulation mode - switches back to JS fallback for better performance
 * This should be called when stopping simulation to improve editor responsiveness
 */
export function deactivateSimulation() {
  useJsFallback = true;
}
let simulationActive = false;

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
    // Loading Pyodide
    // Create a loading promise to prevent multiple simultaneous loads
    pyodideLoading = new Promise(async (resolve, reject) => {
      try {
        // Use the loadPyodideInstance function from the pyodide-loader module
        pyodideInstance = await loadPyodideInstance();
        await loadSimulatorCode(pyodideInstance);
        resolve(pyodideInstance);
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
    return null;
  }
}

/**
 * Load the simulator code into Pyodide
 * @param {Object} pyodide - Pyodide instance
 * @returns {Promise<void>}
 */
async function loadSimulatorCode(pyodide) {
  try {
    // Loading simulator module
    // We don't need micropip or lxml for our basic simulator
    
    // Load the simulator code
    const simulatorCode = await fetchSimulatorCode();
    
    // Run the simulator code
    await pyodide.runPythonAsync(simulatorCode);
    
    // Pyodide and simulator module loaded successfully
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
"""\nPetri Net Simulator Engine\nThis module provides functions to simulate Petri nets, including:\n- Computing enabled transitions\n- Firing transitions\n- Updating markings\n"""\n\nclass PetriNetSimulator:\n    """\n    A simulator for Petri nets that computes enabled transitions and updates markings.\n    """\n    \n    def __init__(self, petri_net, max_tokens=20):\n        """\n        Initialize the simulator with a Petri net.\n        \n        Args:\n            petri_net (dict): The Petri net in JSON format with places, transitions, and arcs\n            max_tokens (int): Maximum number of tokens per place (default: 20)\n        """\n        self.petri_net = petri_net\n        self.places = petri_net.get('places', [])\n        self.transitions = petri_net.get('transitions', [])\n        self.arcs = petri_net.get('arcs', [])\n        self.max_tokens = max_tokens\n        \n    def get_input_places(self, transition_id):\n        """\n        Get all input places for a transition.\n        \n        Args:\n            transition_id (str): The ID of the transition\n            \n        Returns:\n            list: List of (place, arc) tuples for all input places\n        """\n        input_places = []\n        \n        for arc in self.arcs:\n            # Check if the arc is from a place to this transition\n            source_id = arc.get('sourceId') or arc.get('source')\n            target_id = arc.get('targetId') or arc.get('target')\n            source_type = arc.get('sourceType')\n            \n            # Handle both editor-created arcs and PNML-loaded arcs\n            if ((source_type == 'place' and target_id == transition_id) or \n                (arc.get('type') == 'place-to-transition' and target_id == transition_id)):\n                # Find the place\n                place = next((p for p in self.places if p.get('id') == source_id), None)\n                if place:\n                    input_places.append((place, arc))\n                    \n        return input_places\n    \n    def get_output_places(self, transition_id):\n        """\n        Get all output places for a transition.\n        \n        Args:\n            transition_id (str): The ID of the transition\n            \n        Returns:\n            list: List of (place, arc) tuples for all output places\n        """\n        output_places = []\n        \n        for arc in self.arcs:\n            # Check if the arc is from this transition to a place\n            source_id = arc.get('sourceId') or arc.get('source')\n            target_id = arc.get('targetId') or arc.get('target')\n            target_type = arc.get('targetType')\n            \n            # Handle both editor-created arcs and PNML-loaded arcs\n            if ((target_type == 'place' and source_id == transition_id) or \n                (arc.get('type') == 'transition-to-place' and source_id == transition_id)):\n                # Find the place\n                place = next((p for p in self.places if p.get('id') == target_id), None)\n                if place:\n                    output_places.append((place, arc))\n                    \n        return output_places\n    \n    def is_transition_enabled(self, transition_id):\n        """\n        Check if a transition is enabled.\n        \n        Args:\n            transition_id (str): The ID of the transition\n            \n        Returns:\n            bool: True if the transition is enabled, False otherwise\n        """\n        input_places = self.get_input_places(transition_id)\n        \n        # A transition is enabled if all input places have enough tokens\n        for place, arc in input_places:\n            # Get the arc weight (default to 1 if not specified)\n            weight = arc.get('weight', 1)\n            \n            # Check if the place has enough tokens\n            if place.get('tokens', 0) < weight:\n                return False\n                \n        return True\n    \n    def get_enabled_transitions(self):\n        """\n        Get all enabled transitions in the Petri net.\n        \n        Returns:\n            list: List of enabled transition objects\n        """\n        enabled_transitions = []\n        \n        for transition in self.transitions:\n            if self.is_transition_enabled(transition.get('id')):\n                enabled_transitions.append(transition)\n                \n        return enabled_transitions\n    \n    def fire_transition(self, transition_id):\n        """\n        Fire a transition and update the marking.\n        \n        Args:\n            transition_id (str): The ID of the transition to fire\n            \n        Returns:\n            dict: Updated Petri net with new marking\n            \n        Raises:\n            ValueError: If the transition is not enabled\n        """\n        # Check if the transition is enabled\n        if not self.is_transition_enabled(transition_id):\n            raise ValueError(f"Transition {transition_id} is not enabled")\n            \n        # Get input and output places\n        input_places = self.get_input_places(transition_id)\n        output_places = self.get_output_places(transition_id)\n        \n        # Create a deep copy of the Petri net to update\n        updated_petri_net = {\n            'places': [dict(place) for place in self.places],\n            'transitions': self.transitions,\n            'arcs': self.arcs\n        }\n        \n        # Remove tokens from input places\n        for place, arc in input_places:\n            weight = arc.get('weight', 1)\n            place_id = place.get('id')\n            \n            # Find the place in the updated Petri net\n            updated_place = next((p for p in updated_petri_net['places'] if p.get('id') == place_id), None)\n            if updated_place:\n                updated_place['tokens'] = max(0, updated_place.get('tokens', 0) - weight)\n        \n        # Add tokens to output places\n        for place, arc in output_places:\n            weight = arc.get('weight', 1)\n            place_id = place.get('id')\n            \n            # Find the place in the updated Petri net\n            updated_place = next((p for p in updated_petri_net['places'] if p.get('id') == place_id), None)\n            if updated_place:\n                # Enforce token limit (using the configured max_tokens)\n                updated_place['tokens'] = min(self.max_tokens, updated_place.get('tokens', 0) + weight)\n        \n        return updated_petri_net\n    \n    def compute_reachable_markings(self, max_steps=100):\n        """\n        Compute all reachable markings from the current marking.\n        \n        Args:\n            max_steps (int): Maximum number of steps to compute\n            \n        Returns:\n            list: List of reachable markings\n        """\n        # Start with the current marking\n        markings = [self._extract_marking()]\n        visited_markings = set([self._marking_to_tuple(markings[0])])\n        \n        # Keep track of the current Petri net state\n        current_petri_net = self.petri_net\n        \n        # Breadth-first search for reachable markings\n        steps = 0\n        while steps < max_steps:\n            steps += 1\n            \n            # Create a simulator for the current Petri net\n            simulator = PetriNetSimulator(current_petri_net)\n            \n            # Get enabled transitions\n            enabled_transitions = simulator.get_enabled_transitions()\n            if not enabled_transitions:\n                break\n                \n            # Try firing each enabled transition\n            new_markings_found = False\n            for transition in enabled_transitions:\n                # Fire the transition\n                new_petri_net = simulator.fire_transition(transition.get('id'))\n                \n                # Extract the new marking\n                new_marking = self._extract_marking(new_petri_net)\n                new_marking_tuple = self._marking_to_tuple(new_marking)\n                \n                # Check if we've seen this marking before\n                if new_marking_tuple not in visited_markings:\n                    markings.append(new_marking)\n                    visited_markings.add(new_marking_tuple)\n                    new_markings_found = True\n                    \n                    # Update the current Petri net\n                    current_petri_net = new_petri_net\n            \n            # If no new markings were found, we've reached a fixed point\n            if not new_markings_found:\n                break\n                \n        return markings\n    \n    def _extract_marking(self, petri_net=None):\n        """\n        Extract the current marking from the Petri net.\n        \n        Args:\n            petri_net (dict, optional): The Petri net to extract the marking from.\n                If None, use the simulator's Petri net.\n                \n        Returns:\n            dict: Mapping from place ID to token count\n        """\n        petri_net = petri_net or self.petri_net\n        places = petri_net.get('places', [])\n        \n        marking = {}\n        for place in places:\n            marking[place.get('id')] = place.get('tokens', 0)\n            \n        return marking\n    \n    def _marking_to_tuple(self, marking):\n        """\n        Convert a marking dict to a tuple for hashing.\n        \n        Args:\n            marking (dict): Mapping from place ID to token count\n            \n        Returns:\n            tuple: Tuple representation of the marking\n        """\n        return tuple(sorted((k, v) for k, v in marking.items()))
  `;
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
  // Skip expensive initialization during normal editing
  if (!simulationActive && !options.forceInitialize) {
    // Just create the JS fallback for basic operations
    simulator = new JsPetriNetSimulator(petriNet, options);
    return;
  }
  try {
    // Check if we should use the JavaScript fallback
    if (useJsFallback) {
      // Using JavaScript fallback for simulator
      simulator = new JsPetriNetSimulator(petriNet, options);
      return;
    }
    
    // Try to initialize Pyodide
    try {
      // Make sure Pyodide is initialized
      const pyodide = await initializePyodide();
      
      // If Pyodide failed to load, use the JavaScript fallback
      if (!pyodide) {
        // Pyodide failed to load, using JavaScript fallback
        useJsFallback = true;
        simulator = new JsPetriNetSimulator(petriNet, options);
        return;
      }
      
      // Check if toPy function exists (it might not in some Pyodide versions)
      if (typeof pyodide.toPy !== 'function') {
        console.warn('Pyodide.toPy function not available, using JavaScript fallback');
        useJsFallback = true;
        simulator = new JsPetriNetSimulator(petriNet, options);
        return;
      }
      
      try {
        // Convert the Petri net to a Python object
        const petriNetPy = pyodide.toPy(petriNet);
        
        // Create a new simulator instance with maxTokens option
        const maxTokens = options.maxTokens || 20;
        simulator = await pyodide.runPythonAsync(`
          simulator = PetriNetSimulator(${petriNetPy}, ${maxTokens})
          simulator
        `);
        
        // Verify that the simulator was created successfully
        if (!simulator || typeof simulator.get_enabled_transitions !== 'function') {
          console.warn('Python simulator not properly initialized, using JavaScript fallback');
          useJsFallback = true;
          simulator = new JsPetriNetSimulator(petriNet, options);
          return;
        }
      } catch (error) {
        console.error('Error initializing Python simulator:', error);
        console.warn('Falling back to JavaScript simulator due to Python error');
        useJsFallback = true;
        simulator = new JsPetriNetSimulator(petriNet, options);
      }
      
      // Simulator initialized with Petri net using Pyodide
    } catch (error) {
      console.error('Error initializing Pyodide simulator:', error);
      // Falling back to JavaScript simulator
      simulator = new JsPetriNetSimulator(petriNet, options);
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
    // Check if the simulator is initialized
    if (!simulator) {
      console.error('Simulator not initialized');
      return [];
    }
    
    // Check if we're using the JavaScript fallback
    if (useJsFallback) {
      // Using JavaScript fallback for getEnabledTransitions
      return simulator.getEnabledTransitions();
    }
    
    try {
      // Get the enabled transitions from the Python simulator
      const enabledTransitions = await simulator.get_enabled_transitions();
      
      // Check if toJs function exists
      if (typeof enabledTransitions.toJs !== 'function') {
        console.warn('Pyodide result does not have toJs function, using JavaScript fallback');
        useJsFallback = true;
        simulator = new JsPetriNetSimulator(simulator.petriNet || {});
        return simulator.getEnabledTransitions();
      }
      
      // Convert the Python list to a JavaScript array
      const jsEnabledTransitions = enabledTransitions.toJs();
      // Got enabled transitions from Python
      
      // Return the transitions as properly structured objects
      return jsEnabledTransitions.map(transition => {
        if (transition instanceof Map) {
          return {
            id: transition.get('id'),
            label: transition.get('label') || transition.get('name')
          };
        } else if (typeof transition === 'object') {
          return {
            id: transition.id,
            label: transition.label || transition.name
          };
        }
        return transition;
      });
    } catch (error) {
      console.error('Error getting enabled transitions from Python:', error);
      console.warn('Falling back to JavaScript simulator for getEnabledTransitions');
      useJsFallback = true;
      if (simulator.petriNet) {
        simulator = new JsPetriNetSimulator(simulator.petriNet);
      } else {
        console.error('No Petri net available for JavaScript fallback');
        return [];
      }
      return simulator.getEnabledTransitions();
    }
  } catch (error) {
    console.error('Error in getEnabledTransitions:', error);
    return [];
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
    if (!simulator) {
      throw new Error('Simulator not initialized');
    }
    
    // Check if we're using the JavaScript fallback
    if (useJsFallback || simulator instanceof JsPetriNetSimulator) {
      // Using JavaScript fallback for fireTransition
      return simulator.fireTransition(transitionId);
    }
    
    try {
      // Call the Python function to fire the transition
      const updatedPetriNet = await simulator.fire_transition(transitionId);
      
      // Check if toJs function exists
      if (typeof updatedPetriNet.toJs !== 'function') {
        console.warn('Pyodide result does not have toJs function, using JavaScript fallback');
        useJsFallback = true;
        simulator = new JsPetriNetSimulator(simulator.petriNet || {});
        return simulator.fireTransition(transitionId);
      }
      
      // Convert the Python object to a JavaScript object
      const jsPetriNet = updatedPetriNet.toJs();
      // Updated Petri net from Python
      
      // Create a properly structured Petri net object
      const result = { places: [], transitions: [], arcs: [] };
      
      // Handle the case where jsPetriNet is a Map
      if (jsPetriNet instanceof Map) {
        // Processing Map object from Python
        
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
                // Ensure we preserve any additional properties needed for rendering
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
                // Ensure we preserve any additional properties needed for rendering
                type: arc.type,
                label: arc.label || arc.name
              };
            }
            return arc;
          });
        }
        
        // Converted Petri net
        // We don't update this.petriNet here because 'this' is not the simulator instance
        return result;
      }
      
      // Handle the case where jsPetriNet is a regular object
      if (jsPetriNet.places) {
        result.places = jsPetriNet.places.map(place => {
          // Make sure the tokens property is correctly set
          if (place instanceof Map) {
            return {
              id: place.get('id'),
              name: place.get('name'),
              label: place.get('label') || place.get('name'),
              tokens: place.get('tokens') || 0,
              x: place.get('x') || 0,
              y: place.get('y') || 0
            };
          }
          return {
            ...place,
            tokens: place.tokens || 0,
            label: place.label || place.name
          };
        });
        
        // Ensure transitions maintain their coordinates
        result.transitions = (jsPetriNet.transitions || []).map(transition => {
          if (transition instanceof Map) {
            return {
              id: transition.get('id'),
              name: transition.get('name'),
              label: transition.get('label') || transition.get('name'),
              x: transition.get('x') || 0,
              y: transition.get('y') || 0
            };
          }
          return {
            ...transition,
            x: transition.x || 0,
            y: transition.y || 0,
            label: transition.label || transition.name
          };
        });
        
        // Ensure arcs maintain all their properties
        result.arcs = (jsPetriNet.arcs || []).map(arc => {
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
          }
          return {
            ...arc,
            sourceId: arc.sourceId || arc.source,
            targetId: arc.targetId || arc.target,
            weight: arc.weight || 1,
            label: arc.label || arc.name
          };
        });
        
        // Converted Petri net
        return result;
      }
      
      // If all else fails, return the original object
      // Returning Petri net as is
      return jsPetriNet;
    } catch (error) {
      console.error('Error in Python simulator:', error);
      console.warn('Falling back to JavaScript simulator due to Python error');
      useJsFallback = true;
      simulator = new JsPetriNetSimulator(simulator.petriNet || {});
      return simulator.fireTransition(transitionId);
    }
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
    
    // Convert the Python boolean to a JavaScript boolean safely
    if (typeof isEnabled === 'boolean') {
      return isEnabled;
    } else if (typeof isEnabled?.toJs === 'function') {
      return isEnabled.toJs();
    } else if (isEnabled) {
      // If it's truthy but not a boolean or has no toJs function
      return true;
    }
    return false;
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
