/**
 * Pure JavaScript P/T (Place/Transition) Petri Net Simulator
 * Replaces the Pyodide-based simulator with native JavaScript implementation
 */
import { BaseSimulator } from './BaseSimulator.js';
import { getSimulationStats } from './simulation-utils.js';

export class PTSimulator extends BaseSimulator {
  constructor() {
    super();
    this.maxTokens = 20;
  }

  /**
   * Get simulator type
   */
  getType() {
    return 'pt';
  }

  /**
   * Initialize the P/T simulator
   */
  async initializeSpecific(petriNet, options = {}) {
    this.maxTokens = options.maxTokens || 20;
    
    // Validate that this is a P/T net (no algebraic expressions)
    this.validatePTNet(petriNet);
    
    // Initialize place tokens if not present
    this.initializeTokens(petriNet);
    
    console.log('P/T Simulator initialized with', petriNet.places.length, 'places and', petriNet.transitions.length, 'transitions');
  }

  /**
   * Update the Petri net structure
   */
  async updateSpecific(petriNet) {
    // Ensure tokens are properly initialized
    this.initializeTokens(petriNet);
    
    // Emit transition state change event using base helper
    const enabled = await this.getEnabledTransitionsSpecific();
    this.emitTransitionsChanged({ enabled });
  }

  /**
   * Get enabled transitions for P/T nets
   */
  async getEnabledTransitionsSpecific() {
    if (!this.petriNet) return [];
    
    const { places, transitions, arcs } = this.petriNet;
    const enabled = [];
    
    for (const transition of transitions) {
      if (this.isTransitionEnabled(transition, places, arcs)) {
        enabled.push(transition.id);
      }
    }
    
    return enabled;
  }

  /**
   * Check if a transition is enabled
   */
  isTransitionEnabled(transition, places, arcs) {
    // Get input arcs for this transition
    const inputArcs = arcs.filter(arc => 
      arc.target === transition.id && arc.source !== transition.id
    );
    
    // Check if all input places have sufficient tokens
    for (const arc of inputArcs) {
      const place = places.find(p => p.id === arc.source);
      if (!place) continue;
      
      const requiredTokens = arc.weight || 1;
      const availableTokens = place.tokens || 0;
      
      if (availableTokens < requiredTokens) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Fire a specific transition
   */
  async fireTransitionSpecific(transitionId) {
    const { places, transitions, arcs } = this.petriNet;
    // Capture previous enabled transitions for parity event emission
    const previouslyEnabled = await this.getEnabledTransitionsSpecific();
    const transition = transitions.find(t => t.id === transitionId);
    
    if (!transition) {
      throw new Error(`Transition ${transitionId} not found`);
    }
    
    // Create a deep copy of the Petri net
    const newPetriNet = JSON.parse(JSON.stringify(this.petriNet));
    const newPlaces = newPetriNet.places;
    
    // Get input and output arcs
    const inputArcs = arcs.filter(arc => 
      arc.target === transitionId && arc.source !== transitionId
    );
    const outputArcs = arcs.filter(arc => 
      arc.source === transitionId && arc.target !== transitionId
    );
    
    // Consume tokens from input places
    for (const arc of inputArcs) {
      const place = newPlaces.find(p => p.id === arc.source);
      if (place) {
        const tokensToConsume = arc.weight || 1;
        place.tokens = Math.max(0, (place.tokens || 0) - tokensToConsume);
      }
    }
    
    // Produce tokens in output places
    for (const arc of outputArcs) {
      const place = newPlaces.find(p => p.id === arc.target);
      if (place) {
        const tokensToProduce = arc.weight || 1;
        place.tokens = Math.min(this.maxTokens, (place.tokens || 0) + tokensToProduce);
      }
    }
    
    // Update the Petri net
    this.petriNet = newPetriNet;
    
    // Emit transition fired event using base helper
    this.emitTransitionFired({ transitionId, newPetriNet });

    // Emit transitionsChanged with parity payload
    const enabledAfter = await this.getEnabledTransitionsSpecific();
    this.emitTransitionsChanged({ enabled: enabledAfter, previouslyEnabled });
    
    return newPetriNet;
  }

  /**
   * Execute one simulation step
   */
  async stepSimulationSpecific() {
    // Step semantics are centralized in useSimulationManager.
    return this.petriNet;
  }

  /**
   * Reset the simulator
   */
  resetSpecific() {
    // Reset any P/T-specific state
    this.maxTokens = 20;
  }

  /**
   * Validate that this is a P/T net (no algebraic expressions)
   */
  validatePTNet(petriNet) {
    const { transitions } = petriNet;
    
    for (const transition of transitions) {
      // Check for algebraic expressions in guards
      if (transition.guard && typeof transition.guard === 'string' && 
          (transition.guard.includes('+') || transition.guard.includes('-') || 
           transition.guard.includes('*') || transition.guard.includes('/') ||
           transition.guard.includes('=') || transition.guard.includes('<') ||
           transition.guard.includes('>') || transition.guard.includes('!='))) {
        throw new Error('P/T simulator cannot handle algebraic expressions. Use algebraic simulator instead.');
      }
      
      // Check for algebraic expressions in actions
      if (transition.action && typeof transition.action === 'string' && 
          (transition.action.includes('+') || transition.action.includes('-') || 
           transition.action.includes('*') || transition.action.includes('/') ||
           transition.action.includes('='))) {
        throw new Error('P/T simulator cannot handle algebraic expressions. Use algebraic simulator instead.');
      }
    }
  }

  /**
   * Initialize tokens in places if not present
   */
  initializeTokens(petriNet) {
    const { places } = petriNet;
    
    for (const place of places) {
      if (place.tokens === undefined || place.tokens === null) {
        place.tokens = 0;
      }
      // Ensure tokens don't exceed maximum
      place.tokens = Math.min(this.maxTokens, Math.max(0, place.tokens));
    }
  }

  /**
   * Get simulation statistics
   */
  getSimulationStats() {
    if (!this.isInitialized) {
      return { enabledTransitions: [], totalTokens: 0, totalPlaces: 0, totalTransitions: 0 };
    }
    
    const { places, transitions } = this.petriNet;
    const totalTokens = places.reduce((sum, place) => sum + (place.tokens || 0), 0);
    
    // Get enabled transitions synchronously for stats
    const enabled = this.getEnabledTransitionsSync();
    
    return {
      enabledTransitions: enabled,
      totalTokens,
      totalPlaces: places.length,
      totalTransitions: transitions.length
    };
  }

  /**
   * Synchronous version of getEnabledTransitions for stats
   */
  getEnabledTransitionsSync() {
    if (!this.petriNet) return [];
    
    const { places, transitions, arcs } = this.petriNet;
    const enabled = [];
    
    for (const transition of transitions) {
      if (this.isTransitionEnabled(transition, places, arcs)) {
        enabled.push(transition.id);
      }
    }
    
    return enabled;
  }
}
