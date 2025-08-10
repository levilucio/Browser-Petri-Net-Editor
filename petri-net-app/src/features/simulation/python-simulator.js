/**
 * Python Simulator
 * Handles Pyodide integration and Python-based Petri net simulation
 * Primary simulator implementation
 */

import { loadPyodideInstance } from '../../utils/pyodide-loader';

export class PythonSimulator {
  constructor() {
    this.pyodide = null;
    this.petriNet = null;
    this.simulator = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the Python simulator
   */
  async initialize(petriNet, options = {}) {
    this.petriNet = petriNet;
    
    try {
      // Load Pyodide instance
      this.pyodide = await loadPyodideInstance();
      
      // Set up Python environment
      await this.setupPythonEnvironment();
      
      // Create Python simulator instance
      await this.createPythonSimulator(options);
      
      this.isInitialized = true;
      console.log('Python simulator initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize Python simulator:', error);
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

class PetriNetSimulator:
    def __init__(self, petri_net_data, max_tokens=20):
        self.max_tokens = max_tokens
        self.places = {}
        self.transitions = {}
        self.arcs = []
        self.petri_net = petri_net_data
        
        # Initialize places
        for place_data in petri_net_data.get('places', []):
            place_id = place_data['id']
            self.places[place_id] = {
                'id': place_id,
                'label': place_data.get('label', ''),
                'tokens': place_data.get('tokens', 0),
                'x': place_data.get('x', 0),
                'y': place_data.get('y', 0),
                'name': place_data.get('name', ''),
                'type': 'place'
            }
        
        # Initialize transitions
        for transition_data in petri_net_data.get('transitions', []):
            transition_id = transition_data['id']
            self.transitions[transition_id] = {
                'id': transition_id,
                'label': transition_data.get('label', ''),
                'x': transition_data.get('x', 0),
                'y': transition_data.get('y', 0),
                'name': transition_data.get('name', ''),
                'type': 'transition'
            }
        
        # Initialize arcs
        print("=== Initializing arcs ===")
        arc_ids_seen = set()
        for arc_data in petri_net_data.get('arcs', []):
            arc_id = arc_data['id']
            
            # Check for duplicate arc IDs
            if arc_id in arc_ids_seen:
                print(f"WARNING: Duplicate arc ID found: {arc_id}")
                continue
            arc_ids_seen.add(arc_id)
            
            source_id = arc_data.get('sourceId') or arc_data.get('source')
            target_id = arc_data.get('targetId') or arc_data.get('target')
            weight = arc_data.get('weight', 1)
            
            # Ensure weight is a number
            if not isinstance(weight, (int, float)):
                print(f"WARNING: Arc {arc_id} has non-numeric weight: {weight} (type: {type(weight)})")
                try:
                    weight = float(weight)
                    print(f"  Converted weight to: {weight}")
                except:
                    print(f"  Could not convert weight, using default: 1")
                    weight = 1
            
            # Determine arc type
            source_type = 'place' if source_id in self.places else 'transition'
            target_type = 'place' if target_id in self.places else 'transition'
            
            arc = {
                'id': arc_id,
                'sourceId': source_id,
                'targetId': target_id,
                'source': source_id,
                'target': target_id,
                'weight': weight,
                'sourceType': source_type,
                'targetType': target_type,
                'type': f"{source_type}-to-{target_type}"
            }
            
            print(f"  Arc {arc_id}: {source_id} ({source_type}) -> {target_id} ({target_type}), weight: {weight} (type: {type(weight)})")
            self.arcs.append(arc)
        
        print(f"Total arcs initialized: {len(self.arcs)}")
        print(f"Total places: {len(self.places)}")
        print(f"Total transitions: {len(self.transitions)}")
        
        # Debug: Print all arc details
        print("=== All arc details ===")
        for arc in self.arcs:
            print(f"  Arc {arc['id']}: {arc['sourceId']} -> {arc['targetId']}, weight: {arc['weight']} (type: {type(arc['weight'])}), type: {arc['type']}")
    
    def get_input_places(self, transition_id):
        """Get input places for a transition"""
        print(f"=== Getting input places for transition {transition_id} ===")
        input_places = []
        processed_arcs = set()
        
        for arc in self.arcs:
            arc_id = arc['id']
            source_id = arc.get('sourceId') or arc.get('source')
            target_id = arc.get('targetId') or arc.get('target')
            
            print(f"  Checking arc {arc_id}: {source_id} -> {target_id}")
            
            # Simplified logic: just check if this arc goes from a place to this transition
            if target_id == transition_id:
                # Check if source is a place by looking it up in places
                if source_id in self.places:
                    # Check if we've already processed this arc
                    if arc_id in processed_arcs:
                        print(f"    WARNING: Arc {arc_id} already processed, skipping")
                        continue
                    
                    processed_arcs.add(arc_id)
                    input_places.append((self.places[source_id], arc))
                    print(f"    Found input place: {source_id} -> {transition_id} with weight {arc.get('weight', 1)}")
                else:
                    print(f"    Source {source_id} not found in places")
            else:
                print(f"    Target {target_id} != {transition_id}, skipping")
        
        print(f"Total input places for transition {transition_id}: {len(input_places)}")
        for place, arc in input_places:
            print(f"  Final input: {place['id']} with weight {arc.get('weight', 1)}")
        return input_places
    
    def get_output_places(self, transition_id):
        """Get output places for a transition"""
        print(f"=== Getting output places for transition {transition_id} ===")
        output_places = []
        processed_arcs = set()
        
        for arc in self.arcs:
            arc_id = arc['id']
            source_id = arc.get('sourceId') or arc.get('source')
            target_id = arc.get('targetId') or arc.get('target')
            
            print(f"  Checking arc {arc_id}: {source_id} -> {target_id}")
            
            # Simplified logic: just check if this arc goes from this transition to a place
            if source_id == transition_id:
                # Check if target is a place by looking it up in places
                if target_id in self.places:
                    # Check if we've already processed this arc
                    if arc_id in processed_arcs:
                        print(f"    WARNING: Arc {arc_id} already processed, skipping")
                        continue
                    
                    processed_arcs.add(arc_id)
                    output_places.append((self.places[target_id], arc))
                    print(f"    Found output place: {transition_id} -> {target_id} with weight {arc.get('weight', 1)}")
                else:
                    print(f"    Target {target_id} not found in places")
            else:
                print(f"    Source {source_id} != {transition_id}, skipping")
        
        print(f"Total output places for transition {transition_id}: {len(output_places)}")
        for place, arc in output_places:
            print(f"  Final output: {place['id']} with weight {arc.get('weight', 1)}")
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
                enabled.append(self.transitions[transition_id])
        return enabled
    
    def fire_transition(self, transition_id):
        """Fire a transition"""
        print(f"=== Firing transition {transition_id} ===")
        
        if not self.is_transition_enabled(transition_id):
            raise ValueError(f"Transition {transition_id} is not enabled")
        
        # Get input and output places before firing
        input_places = self.get_input_places(transition_id)
        output_places = self.get_output_places(transition_id)
        
        print(f"Input places: {len(input_places)}")
        for place, arc in input_places:
            print(f"  Input place {place['id']}: {place['tokens']} tokens, arc weight: {arc.get('weight', 1)}")
        
        print(f"Output places: {len(output_places)}")
        for place, arc in output_places:
            print(f"  Output place {place['id']}: {place['tokens']} tokens, arc weight: {arc.get('weight', 1)}")
        
        # Create deep copy of current state
        updated_petri_net = {
            'places': [],
            'transitions': [],
            'arcs': []
        }
        
        # Copy places with updated tokens
        for place_id, place in self.places.items():
            place_copy = place.copy()
            updated_petri_net['places'].append(place_copy)
        
        # Copy transitions
        for transition_id, transition in self.transitions.items():
            transition_copy = transition.copy()
            updated_petri_net['transitions'].append(transition_copy)
        
        # Copy arcs
        for arc in self.arcs:
            arc_copy = arc.copy()
            updated_petri_net['arcs'].append(arc_copy)
        
        # Consume tokens from input places
        print("=== Consuming tokens ===")
        for place, arc in input_places:
            weight = arc.get('weight', 1)
            current_tokens = place.get('tokens', 0)
            print(f"  Place {place['id']}: {current_tokens} tokens, consuming {weight}")
            
            if current_tokens < weight:
                raise ValueError(f"Insufficient tokens in place {place['id']}: {current_tokens} < {weight}")
            
            # Update tokens
            place['tokens'] = current_tokens - weight
            print(f"  Place {place['id']}: {current_tokens} -> {place['tokens']} tokens")
        
        # Add tokens to output places
        print("=== Adding tokens ===")
        for place, arc in output_places:
            weight = arc.get('weight', 1)
            current_tokens = place.get('tokens', 0)
            print(f"  Place {place['id']}: {current_tokens} tokens, adding {weight}")
            
            # Update tokens
            place['tokens'] = current_tokens + weight
            print(f"  Place {place['id']}: {current_tokens} -> {place['tokens']} tokens")
        
        # Update internal state
        self.places = {p['id']: p for p in updated_petri_net['places']}
        self.transitions = {t['id']: t for t in updated_petri_net['transitions']}
        self.arcs = updated_petri_net['arcs']
        self.petri_net = updated_petri_net
        
        print("=== Final state after firing ===")
        for place in updated_petri_net['places']:
            print(f"  Place {place['id']}: {place['tokens']} tokens")
        
        return updated_petri_net
    
    def fire_multiple_transitions(self, transition_ids):
        """Fire multiple transitions"""
        current_petri_net = self.petri_net
        for transition_id in transition_ids:
            current_petri_net = self.fire_transition(transition_id)
        return current_petri_net
    
    def get_current_state(self):
        """Get current Petri net state"""
        return self.petri_net
`;

    // Execute Python code
    await this.pyodide.runPythonAsync(pythonCode);
  }

  /**
   * Create Python simulator instance
   */
  async createPythonSimulator(options = {}) {
    if (!this.pyodide) {
      throw new Error('Pyodide not loaded');
    }

    const maxTokens = options.maxTokens || 20;
    
    console.log('Creating Python simulator with data:', {
      places: this.petriNet.places?.length || 0,
      transitions: this.petriNet.transitions?.length || 0,
      arcs: this.petriNet.arcs?.length || 0,
      maxTokens
    });
    
    // Log the actual arc data for debugging
    if (this.petriNet.arcs) {
      console.log('Arc details:');
      this.petriNet.arcs.forEach(arc => {
        console.log(`  Arc ${arc.id}: ${arc.sourceId || arc.source} -> ${arc.targetId || arc.target}, weight: ${arc.weight}`);
      });
    }
    
    // First, set the Petri net data in the Python context
    await this.pyodide.runPythonAsync(`
petri_net_data = ${JSON.stringify(this.petriNet)}
`);
    
    // Create simulator instance
    const createCode = `
simulator = PetriNetSimulator(petri_net_data, max_tokens=${maxTokens})
`;
    
    await this.pyodide.runPythonAsync(createCode);
    
    // Store reference to simulator
    this.simulator = this.pyodide.globals.get('simulator');
  }

  /**
   * Get enabled transitions
   */
  async getEnabledTransitions() {
    if (!this.isInitialized || !this.simulator) {
      console.warn('Python simulator not initialized, returning empty array');
      return [];
    }

    try {
      const result = await this.pyodide.runPythonAsync(`
result = simulator.get_enabled_transitions()
result
`);
      
      // Convert Python result to JavaScript
      const jsResult = result.toJs();
      return Array.isArray(jsResult) ? jsResult : [];
      
    } catch (error) {
      console.error('Error getting enabled transitions from Python:', error);
      return [];
    }
  }

  /**
   * Check if a transition is enabled
   */
  async isTransitionEnabled(transitionId) {
    if (!this.isInitialized || !this.simulator) {
      console.warn('Python simulator not initialized, returning false');
      return false;
    }

    try {
      const result = await this.pyodide.runPythonAsync(`
result = simulator.is_transition_enabled("${transitionId}")
result
`);
      
      return Boolean(result);
      
    } catch (error) {
      console.error('Error checking transition enabled from Python:', error);
      return false;
    }
  }

  /**
   * Fire a transition
   */
  async fireTransition(transitionId) {
    if (!this.isInitialized || !this.simulator) {
      console.warn('Python simulator not initialized, returning current Petri net');
      return this.petriNet;
    }

    try {
      console.log(`Firing transition ${transitionId} in Python simulator`);
      
      const result = await this.pyodide.runPythonAsync(`
result = simulator.fire_transition("${transitionId}")
print(f"Python fire_transition result type: {type(result)}")
print(f"Python fire_transition result keys: {list(result.keys()) if hasattr(result, 'keys') else 'No keys'}")
result
`);
      
      console.log('Raw Python result:', result);
      
      // Convert Python result to JavaScript
      const jsResult = result.toJs();
      console.log('Converted JavaScript result:', jsResult);
      
      // Validate and clean the result
      return this.validatePythonResult(jsResult);
      
    } catch (error) {
      console.error('Error firing transition from Python:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        isInitialized: this.isInitialized,
        hasSimulator: !!this.simulator
      });
      return this.petriNet;
    }
  }

  /**
   * Fire multiple transitions
   */
  async fireMultipleTransitions(transitionIds) {
    if (!this.isInitialized || !this.simulator) {
      console.warn('Python simulator not initialized, returning current Petri net');
      return this.petriNet;
    }

    try {
      console.log(`Firing multiple transitions in Python simulator:`, transitionIds);
      
      const transitionIdsStr = JSON.stringify(transitionIds);
      const result = await this.pyodide.runPythonAsync(`
result = simulator.fire_multiple_transitions(${transitionIdsStr})
print(f"Python fire_multiple_transitions result type: {type(result)}")
print(f"Python fire_multiple_transitions result keys: {list(result.keys()) if hasattr(result, 'keys') else 'No keys'}")
result
`);
      
      console.log('Raw Python result (multiple transitions):', result);
      
      // Convert Python result to JavaScript
      const jsResult = result.toJs();
      console.log('Converted JavaScript result (multiple transitions):', jsResult);
      
      // Validate and clean the result
      return this.validatePythonResult(jsResult);
      
    } catch (error) {
      console.error('Error firing multiple transitions from Python:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        isInitialized: this.isInitialized,
        hasSimulator: !!this.simulator,
        transitionIds
      });
      return this.petriNet;
    }
  }

  /**
   * Update simulator with new Petri net state
   */
  async update(petriNet) {
    this.petriNet = petriNet;
    
    if (this.simulator && this.pyodide) {
      try {
        console.log('Updating Python simulator with new Petri net state');
        
        // Update the petri_net_data in Python context
        await this.pyodide.runPythonAsync(`
petri_net_data = ${JSON.stringify(petriNet)}
`);
        
        // Update the existing simulator instance instead of creating a new one
        await this.pyodide.runPythonAsync(`
# Update the existing simulator's internal state
simulator.petri_net = petri_net_data
simulator.places = {}
simulator.transitions = {}
simulator.arcs = []

# Re-initialize places
for place_data in petri_net_data.get('places', []):
    place_id = place_data['id']
    simulator.places[place_id] = {
        'id': place_id,
        'label': place_data.get('label', ''),
        'tokens': place_data.get('tokens', 0),
        'x': place_data.get('x', 0),
        'y': place_data.get('y', 0),
        'name': place_data.get('name', ''),
        'type': 'place'
    }

# Re-initialize transitions
for transition_data in petri_net_data.get('transitions', []):
    transition_id = transition_data['id']
    simulator.transitions[transition_id] = {
        'id': transition_id,
        'label': transition_data.get('label', ''),
        'x': transition_data.get('x', 0),
        'y': transition_data.get('y', 0),
        'name': transition_data.get('name', ''),
        'type': 'transition'
    }

# Re-initialize arcs
simulator.arcs = petri_net_data.get('arcs', [])
`);
        
        console.log('Python simulator updated successfully');
      } catch (error) {
        console.error('Error updating Python simulator:', error);
        // Don't throw error here as it's not critical for operation
      }
    }
  }

  /**
   * Check simulator status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasPyodide: !!this.pyodide,
      hasSimulator: !!this.simulator,
      hasPetriNet: !!this.petriNet,
      petriNetSize: this.petriNet ? {
        places: this.petriNet.places?.length || 0,
        transitions: this.petriNet.transitions?.length || 0,
        arcs: this.petriNet.arcs?.length || 0
      } : null
    };
  }

  /**
   * Validate and clean Python result
   */
  validatePythonResult(jsResult) {
    console.log('Validating Python result:', jsResult);
    
    // Handle case where result might be null or undefined
    if (!jsResult) {
      console.error('Python result is null or undefined');
      throw new Error('Python simulator returned null or undefined result');
    }
    
    // Handle case where result might be a string (error message)
    if (typeof jsResult === 'string') {
      console.error('Python result is a string:', jsResult);
      throw new Error(`Python simulator error: ${jsResult}`);
    }
    
    // Ensure all required properties are present
    if (!jsResult.places || !jsResult.transitions || !jsResult.arcs) {
      console.error('Missing required properties in Python result:', {
        hasPlaces: !!jsResult.places,
        hasTransitions: !!jsResult.transitions,
        hasArcs: !!jsResult.arcs,
        resultKeys: Object.keys(jsResult)
      });
      throw new Error('Invalid result structure from Python simulator - missing required properties');
    }

    // Validate places
    const validatedPlaces = jsResult.places.map(place => {
      if (!place.id) {
        throw new Error('Place missing ID');
      }
      return {
        id: place.id,
        label: place.label || '',
        tokens: Number(place.tokens || 0),
        x: Number(place.x || 0),
        y: Number(place.y || 0),
        name: place.name || '',
        type: 'place'
      };
    });

    // Validate transitions
    const validatedTransitions = jsResult.transitions.map(transition => {
      if (!transition.id) {
        throw new Error('Transition missing ID');
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

    // Validate arcs
    const validatedArcs = jsResult.arcs.map(arc => {
      if (!arc.id || (!arc.sourceId && !arc.source) || (!arc.targetId && !arc.target)) {
        throw new Error('Arc missing required properties');
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
}
