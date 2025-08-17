/**
 * Pyodide-based Petri Net Simulator
 * A clean, simple implementation with two simulation modes
 */

import { loadPyodideInstance } from '../../utils/pyodide-loader';

export class PyodideSimulator {
  constructor() {
    this.pyodide = null;
    this.petriNet = null;
    this.simulator = null;
    this.isInitialized = false;
    this.simulationMode = 'single'; // 'single' or 'maximal'
    
    // Event system for transition state changes
    this.eventListeners = new Map();
    this.lastEnabledTransitions = [];
  }

  /**
   * Initialize the simulator with a Petri net
   */
  async initialize(petriNet, options = {}) {
    console.log('=== Starting Pyodide simulator initialization ===');
    console.log('Petri net data:', {
      places: petriNet.places?.length || 0,
      transitions: petriNet.transitions?.length || 0,
      arcs: petriNet.arcs?.length || 0
    });
    
    // Always initialize, even with empty Petri net
    this.petriNet = petriNet || { places: [], transitions: [], arcs: [] };
    this.simulationMode = options.simulationMode || 'single';
    
    try {
      // Load Pyodide instance
      console.log('Loading Pyodide instance...');
      this.pyodide = await loadPyodideInstance();
      console.log('Pyodide instance loaded successfully');
      
      // Set up Python environment
      console.log('Setting up Python environment...');
      await this.setupPythonEnvironment();
      console.log('Python environment setup complete');
      
      // Create simulator instance
      console.log('Creating simulator instance...');
      await this.createSimulatorInstance(options);
      console.log('Simulator instance created successfully');
      
      // Verify the simulator is actually ready before marking as initialized
      if (!this.simulator || !this.pyodide) {
        throw new Error('Simulator instance creation failed - missing simulator or pyodide');
      }
      
      // Test that the simulator can actually perform basic operations
      try {
        await this.pyodide.runPythonAsync(`
# Test basic simulator functionality
test_result = simulator.get_enabled_transitions()
print(f"Test successful - enabled transitions: {test_result}")
`);
        console.log('Simulator functionality test passed');
      } catch (error) {
        console.error('Simulator functionality test failed:', error);
        throw new Error('Simulator created but basic functionality test failed');
      }
      
             this.isInitialized = true;
       console.log('=== Pyodide simulator initialization completed successfully ===');
       
       // Check for initial transition state and emit event
       await this.checkTransitionStateChanges();
      
    } catch (error) {
      console.error('=== Failed to initialize Pyodide simulator ===');
      console.error('Error details:', error);
      throw error;
    }
  }

  /**
   * Set up Python environment with required modules
   */
  async setupPythonEnvironment() {
    if (!this.pyodide) {
      throw new Error('Pyodide not loaded');
    }

    // Install required packages
    await this.pyodide.loadPackage(['numpy']);
    
    // Define Python classes and functions
    const pythonCode = `
import numpy as np
from typing import Dict, List, Tuple, Optional, Union
import json
import random

class PetriNetSimulator:
    def __init__(self, petri_net_data, simulation_mode='single'):
        self.simulation_mode = simulation_mode
        self.places = {}
        self.transitions = {}
        self.arcs = []
        self.petri_net = petri_net_data
        
        # Initialize places (preserve all fields from JS, normalize essentials)
        for place_data in petri_net_data.get('places', []):
            place = dict(place_data)
            place_id = place['id']
            place['tokens'] = place.get('tokens', 0)
            place['type'] = 'place'
            self.places[place_id] = place
        
        # Initialize transitions (preserve all fields from JS, normalize essentials)
        for transition_data in petri_net_data.get('transitions', []):
            transition = dict(transition_data)
            transition_id = transition['id']
            transition['type'] = 'transition'
            self.transitions[transition_id] = transition
        
        # Initialize arcs (preserve all fields from JS, normalize essentials)
        for arc_data in petri_net_data.get('arcs', []):
            arc = dict(arc_data)
            arc_id = arc['id']
            source_id = arc.get('sourceId') or arc.get('source')
            target_id = arc.get('targetId') or arc.get('target')
            weight = arc.get('weight', 1)
            
            # Determine arc type
            source_type = 'place' if source_id in self.places else 'transition'
            target_type = 'place' if target_id in self.places else 'transition'
            
            arc['sourceId'] = source_id
            arc['targetId'] = target_id
            arc['source'] = source_id
            arc['target'] = target_id
            arc['weight'] = weight
            arc['sourceType'] = arc.get('sourceType', source_type)
            arc['targetType'] = arc.get('targetType', target_type)
            arc['type'] = arc.get('type', f"{arc['sourceType']}-to-{arc['targetType']}")
            
            self.arcs.append(arc)
        
        print(f"Simulator initialized with {len(self.places)} places, {len(self.transitions)} transitions, {len(self.arcs)} arcs")
        print(f"Simulation mode: {self.simulation_mode}")
    
    def get_input_places(self, transition_id):
        """Get input places for a transition"""
        input_places = []
        for arc in self.arcs:
            if arc['targetId'] == transition_id and arc['sourceType'] == 'place':
                input_places.append((self.places[arc['sourceId']], arc))
        return input_places
    
    def get_output_places(self, transition_id):
        """Get output places for a transition"""
        output_places = []
        for arc in self.arcs:
            if arc['sourceId'] == transition_id and arc['targetType'] == 'place':
                output_places.append((self.places[arc['targetId']], arc))
        return output_places
    
    def is_transition_enabled(self, transition_id):
        """Check if a transition is enabled"""
        input_places = self.get_input_places(transition_id)
        for place, arc in input_places:
            weight = arc.get('weight', 1)
            if place.get('tokens', 0) < weight:
                return False
        return True
    
    def get_enabled_transitions(self):
        """Get all enabled transitions"""
        enabled = []
        for transition_id in self.transitions:
            if self.is_transition_enabled(transition_id):
                enabled.append(str(transition_id))
        return enabled
    
    def are_transitions_conflicting(self, transition1_id, transition2_id):
        """Check if two transitions are conflicting (share input places)"""
        input1 = {place['id'] for place, _ in self.get_input_places(transition1_id)}
        input2 = {place['id'] for place, _ in self.get_input_places(transition2_id)}
        return bool(input1 & input2)  # Intersection
    
    def fire_transition(self, transition_id):
        """Fire a single transition"""
        if not self.is_transition_enabled(transition_id):
            raise ValueError(f"Transition {transition_id} is not enabled")
        
        # Consume tokens from input places
        input_places = self.get_input_places(transition_id)
        for place, arc in input_places:
            weight = arc.get('weight', 1)
            place['tokens'] = place['tokens'] - weight
        
        # Add tokens to output places
        output_places = self.get_output_places(transition_id)
        for place, arc in output_places:
            weight = arc.get('weight', 1)
            place['tokens'] = place['tokens'] + weight
        
        # Return deep-copied state to avoid proxy identity reuse issues in JS
        import copy
        return copy.deepcopy(self.get_current_state())
    
    def fire_maximal_concurrent(self):
        """Fire maximal set of non-conflicting transitions"""
        enabled = self.get_enabled_transitions()
        if not enabled:
            return self.get_current_state()
        
        # Find maximal set of non-conflicting transitions
        firing_set = []
        remaining = enabled.copy()
        
        while remaining:
            # Pick a random transition from remaining
            current = random.choice(remaining)
            remaining.remove(current)
            
            # Check if it conflicts with already selected transitions
            conflicts = False
            for selected in firing_set:
                if self.are_transitions_conflicting(current, selected):
                    conflicts = True
                    break
            
            if not conflicts:
                firing_set.append(current)
        
        # Fire all selected transitions
        for transition_id in firing_set:
            self.fire_transition(transition_id)
        
        return self.get_current_state()
    
    def step_simulation(self):
        """Execute one simulation step based on mode"""
        if self.simulation_mode == 'single':
            enabled = self.get_enabled_transitions()
            if not enabled:
                return self.get_current_state()
            
            # Randomly choose one enabled transition
            chosen = random.choice(enabled)
            return self.fire_transition(chosen)
        else:  # maximal mode
            return self.fire_maximal_concurrent()
    
    def get_current_state(self):
        """Get current Petri net state"""
        import copy
        return {
            'places': [copy.deepcopy(p) for p in self.places.values()],
            'transitions': [copy.deepcopy(t) for t in self.transitions.values()],
            'arcs': [copy.deepcopy(a) for a in self.arcs]
        }
    
    def load_from(self, petri_net_data):
        """Reload Petri net data into the existing simulator instance"""
        # Reuse current simulation_mode while rebuilding internal state
        self.__init__(petri_net_data, self.simulation_mode)
    
    def set_simulation_mode(self, mode):
        """Set simulation mode"""
        if mode in ['single', 'maximal']:
            self.simulation_mode = mode
            print(f"Simulation mode changed to: {mode}")
        else:
            raise ValueError("Mode must be 'single' or 'maximal'")
`;

    // Execute Python code
    await this.pyodide.runPythonAsync(pythonCode);
  }

  /**
   * Create simulator instance
   */
  async createSimulatorInstance(options = {}) {
    if (!this.pyodide) {
      throw new Error('Pyodide not loaded');
    }

    const simulationMode = options.simulationMode || 'single';
    
    console.log('Creating simulator instance with mode:', simulationMode);
    
    try {
      // Set the Petri net data in Python context
      await this.pyodide.runPythonAsync(`
petri_net_data = ${JSON.stringify(this.petriNet)}
simulation_mode = "${simulationMode}"
`);
      
      // Create simulator instance
      await this.pyodide.runPythonAsync(`
simulator = PetriNetSimulator(petri_net_data, simulation_mode)
`);
      
      // Store reference to simulator
      this.simulator = this.pyodide.globals.get('simulator');
      
      if (!this.simulator) {
        throw new Error('Failed to retrieve simulator instance from Python context');
      }
      
      // Only set isInitialized if this is the first creation (not during updates)
      if (!this.isInitialized) {
        this.isInitialized = true;
      }
      
      console.log('Simulator instance created successfully');
      
    } catch (error) {
      console.error('Error creating simulator instance:', error);
      throw error;
    }
  }

  /**
   * Set simulation mode
   */
  async setSimulationMode(mode) {
    if (!this.isInitialized || !this.simulator) {
      throw new Error('Simulator not initialized');
    }

    try {
      await this.pyodide.runPythonAsync(`
simulator.set_simulation_mode("${mode}")
`);
      this.simulationMode = mode;
      console.log('Simulation mode changed to:', mode);
    } catch (error) {
      console.error('Error setting simulation mode:', error);
      throw error;
    }
  }

  /**
   * Get enabled transitions
   */
  async getEnabledTransitions() {
    if (!this.isInitialized || !this.simulator) {
      console.warn('Simulator not initialized, returning empty array');
      return [];
    }

    try {
      const result = await this.pyodide.runPythonAsync(`
result = simulator.get_enabled_transitions()
result
`);
      
      // Convert Pyodide result to JavaScript array
      // Normalize to plain string array
      const jsResult = result.toJs();
      if (!jsResult) return [];
      const arr = Array.isArray(jsResult) ? jsResult : Array.from(jsResult);
      return arr.map((x) => (typeof x === 'string' ? x : (x?.id ?? String(x))));
      
    } catch (error) {
      console.error('Error getting enabled transitions:', error);
      return [];
    }
  }

  /**
   * Check if there are any enabled transitions in the current Petri net
   */
  async hasEnabledTransitions() {
    if (!this.isInitialized || !this.simulator) {
      return false;
    }

    try {
      const enabled = await this.getEnabledTransitions();
      return enabled && enabled.length > 0;
    } catch (error) {
      console.error('Error checking for enabled transitions:', error);
      return false;
    }
  }

  /**
   * Check if a transition is enabled
   */
  async isTransitionEnabled(transitionId) {
    if (!this.isInitialized || !this.simulator) {
      console.warn('Simulator not initialized, returning false');
      return false;
    }

    try {
      const result = await this.pyodide.runPythonAsync(`
result = simulator.is_transition_enabled("${transitionId}")
result
`);
      
      return Boolean(result);
      
    } catch (error) {
      console.error('Error checking transition enabled:', error);
      return false;
    }
  }

  /**
   * Execute one simulation step
   */
  async stepSimulation() {
    if (!this.isInitialized || !this.simulator) {
      throw new Error('Simulator not initialized');
    }

    try {
      console.log(`Executing simulation step in ${this.simulationMode} mode`);
      
      const result = await this.pyodide.runPythonAsync(`
result = simulator.step_simulation()
result
`);
      
      // Convert Pyodide result to plain JavaScript objects (no PyProxies/Maps)
      const jsResult = result.toJs({ dict_converter: Object.fromEntries });
      return this.validateResult(jsResult);
      
    } catch (error) {
      console.error('Error executing simulation step:', error);
      throw error;
    }
  }

  /**
   * Fire a specific transition
   */
  async fireTransition(transitionId) {
    if (!this.isInitialized || !this.simulator) {
      throw new Error('Simulator not initialized');
    }

    try {
      console.log(`Firing transition: ${transitionId}`);
      
      const result = await this.pyodide.runPythonAsync(`
result = simulator.fire_transition("${transitionId}")
result
`);
      
      // Convert Pyodide result to plain JavaScript objects (no PyProxies/Maps)
      const jsResult = result.toJs({ dict_converter: Object.fromEntries });
      return this.validateResult(jsResult);
      
    } catch (error) {
      console.error('Error firing transition:', error);
      throw error;
    }
  }

  /**
   * Update simulator with new Petri net state
   */
  async update(petriNet) {
    // Only update if the Petri net has actually changed
    if (JSON.stringify(this.petriNet) === JSON.stringify(petriNet)) {
      console.log('Petri net unchanged, skipping update');
      return;
    }

    console.log('Updating simulator with new Petri net state (in-place reload)');

    if (this.simulator && this.pyodide) {
      try {
        // Update the petri_net_data in Python context and reload the existing simulator instance
        await this.pyodide.runPythonAsync(`
petri_net_data = ${JSON.stringify(petriNet)}
simulator.load_from(petri_net_data)
`);

        // Update the JS-side reference AFTER successful reload
        this.petriNet = petriNet;

        console.log('Simulator reloaded successfully');

        // Check for transition state changes after update
        await this.checkTransitionStateChanges();
      } catch (error) {
        console.error('Error updating simulator (in-place reload):', error);
        // As a fallback (should be rare), attempt to recreate the simulator instance
        try {
          await this.createSimulatorInstance({ simulationMode: this.simulationMode });
          this.petriNet = petriNet;
          await this.checkTransitionStateChanges();
        } catch (recreateError) {
          console.error('Fallback recreate after reload failure also failed:', recreateError);
        }
      }
    } else {
      // If simulator or pyodide not available, just update the reference
      this.petriNet = petriNet;
    }
  }

  /**
   * Validate and clean Python result
   */
  validateResult(jsResult) {
    if (!jsResult) {
      throw new Error('Simulator returned null or undefined result');
    }
    
    if (typeof jsResult === 'string') {
      throw new Error(`Simulator error: ${jsResult}`);
    }
    
    // Ensure all required properties are present (allow empty arrays but not undefined)
    if (!jsResult.places || !jsResult.transitions || typeof jsResult.arcs === 'undefined') {
      throw new Error('Invalid result structure from simulator - missing required properties');
    }

    // Build lookups from the last JS-side Petri net for graceful fallback
    const originalPlacesById = Array.isArray(this.petriNet?.places)
      ? Object.fromEntries(this.petriNet.places.map(p => [p.id, p]))
      : {};
    const originalArcs = Array.isArray(this.petriNet?.arcs) ? this.petriNet.arcs : [];

    // Validate places
    const validatedPlaces = jsResult.places.map((place, index) => {
      if (!place || !place.id) {
        throw new Error(`Place at index ${index} missing ID`);
      }
      
      return {
        id: place.id,
        label: place.label || '',
        // If tokens is missing from Python result, fall back to last known JS value
        tokens: Number((place.tokens ?? originalPlacesById[place.id]?.tokens ?? 0)),
        x: Number(place.x || 0),
        y: Number(place.y || 0),
        name: place.name || '',
        type: 'place'
      };
    });

    // Validate transitions
    const validatedTransitions = jsResult.transitions.map((transition, index) => {
      if (!transition || !transition.id) {
        throw new Error(`Transition at index ${index} missing ID`);
      }
      
      return {
        id: transition.id,
        label: transition.label || '',
        x: Number(transition.x || 0),
        y: Number(transition.y || 0),
        name: transition.name || '',
        type: 'transition'
      };
    });

    // Validate arcs (fall back to previous JS arcs if Python returned none)
    const arcsSource = (Array.isArray(jsResult.arcs) && jsResult.arcs.length > 0)
      ? jsResult.arcs
      : originalArcs;

    const validatedArcs = arcsSource.map((arc, index) => {
      if (!arc.id || (!arc.sourceId && !arc.source) || (!arc.targetId && !arc.target)) {
        throw new Error(`Arc at index ${index} missing required properties`);
      }
      
      return {
        id: arc.id,
        sourceId: arc.sourceId || arc.source,
        targetId: arc.targetId || arc.target,
        source: arc.sourceId || arc.source,
        target: arc.targetId || arc.target,
        weight: Number(arc.weight || 1),
        sourceType: arc.sourceType || 'place',
        targetType: arc.targetType || 'transition',
        type: arc.type || `${arc.sourceType || 'place'}-to-${arc.targetType || 'transition'}`
      };
    });

    return {
      places: validatedPlaces,
      transitions: validatedTransitions,
      arcs: validatedArcs
    };
  }

  /**
   * Check simulator status
   */
  getStatus() {
    const status = {
      isInitialized: this.isInitialized,
      hasPyodide: !!this.pyodide,
      hasSimulator: !!this.simulator,
      hasPetriNet: !!this.petriNet,
      simulationMode: this.simulationMode,
      petriNetSize: this.petriNet ? {
        places: this.petriNet.places?.length || 0,
        transitions: this.petriNet.transitions?.length || 0,
        arcs: this.petriNet.arcs?.length || 0
      } : null
    };
    
    return status;
  }

  /**
   * Test if simulator is actually functional
   */
  async testFunctionality() {
    if (!this.isInitialized || !this.simulator || !this.pyodide) {
      return false;
    }

    try {
      // Test basic operations
      await this.pyodide.runPythonAsync(`
# Test that simulator can access its data
test_places = len(simulator.places)
test_transitions = len(simulator.transitions)
test_arcs = len(simulator.arcs)
print(f"Functionality test: {test_places} places, {test_transitions} transitions, {test_arcs} arcs")
`);
      return true;
    } catch (error) {
      console.error('Simulator functionality test failed:', error);
      return false;
    }
  }

  /**
   * Add event listener for transition state changes
   */
  addEventListener(eventType, callback) {
    console.log(`addEventListener: Adding listener for ${eventType}`);
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(callback);
    console.log(`addEventListener: Total listeners for ${eventType}:`, this.eventListeners.get(eventType).length);
    // Immediately emit current state for this event type so late listeners get synced
    if (eventType === 'transitionsChanged') {
      // Fire and forget; consumers don't care about awaiting here
      this.checkTransitionStateChanges().catch(() => {});
    }
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType, callback) {
    if (this.eventListeners.has(eventType)) {
      const listeners = this.eventListeners.get(eventType);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all listeners
   */
  emitEvent(eventType, data) {
    console.log(`emitEvent: Emitting ${eventType} event with data:`, data);
    console.log(`emitEvent: Number of listeners:`, this.eventListeners.has(eventType) ? this.eventListeners.get(eventType).length : 0);
    
    if (this.eventListeners.has(eventType)) {
      this.eventListeners.get(eventType).forEach((callback, index) => {
        try {
          console.log(`emitEvent: Calling listener ${index}`);
          callback(data);
          console.log(`emitEvent: Listener ${index} completed successfully`);
        } catch (error) {
          console.error(`emitEvent: Error in event listener ${index}:`, error);
        }
      });
    } else {
      console.log(`emitEvent: No listeners for event type: ${eventType}`);
    }
  }

  /**
   * Check for transition state changes and emit events
   */
  async checkTransitionStateChanges() {
    if (!this.isInitialized || !this.simulator) {
      console.log('checkTransitionStateChanges: Simulator not ready');
      return;
    }

    try {
      const currentEnabled = await this.getEnabledTransitions();
      console.log('checkTransitionStateChanges: Current enabled transitions:', currentEnabled);
      console.log('checkTransitionStateChanges: Last enabled transitions:', this.lastEnabledTransitions);
      
      const hasChanged = JSON.stringify(currentEnabled.sort()) !== JSON.stringify(this.lastEnabledTransitions.sort());
      console.log('checkTransitionStateChanges: Has changed:', hasChanged);
      
      if (hasChanged) {
        const oldEnabled = [...this.lastEnabledTransitions];
        this.lastEnabledTransitions = [...currentEnabled];
        
        // Emit transition state change event
        const eventData = {
          enabled: currentEnabled,
          previouslyEnabled: oldEnabled,
          hasEnabled: currentEnabled.length > 0
        };
        
        console.log('checkTransitionStateChanges: Emitting event with data:', eventData);
        this.emitEvent('transitionsChanged', eventData);
        
        console.log('Transition state changed:', {
          from: oldEnabled,
          to: currentEnabled,
          hasEnabled: currentEnabled.length > 0
        });
      } else {
        console.log('checkTransitionStateChanges: No change detected');
      }
    } catch (error) {
      console.error('Error checking transition state changes:', error);
    }
  }

  /**
   * Check if the simulator can be initialized with the given Petri net data
   */
  static canInitialize(petriNet) {
    return petriNet && 
           petriNet.places && 
           petriNet.transitions && 
           Array.isArray(petriNet.places) && 
           Array.isArray(petriNet.transitions) &&
           petriNet.places.length > 0 && 
           petriNet.transitions.length > 0 &&
           petriNet.places.every(place => place && place.id) &&
           petriNet.transitions.every(transition => transition && transition.id);
  }
}
