/**
 * Pure JavaScript P/T (Place/Transition) Petri Net Simulator
 * Replaces the Pyodide-based simulator with native JavaScript implementation
 */
import { BaseSimulator } from './BaseSimulator.js';
import { getSimulationStats } from './simulation-utils.js';
import { consumeTokens, produceTokens } from './token-io.js';

export class PTSimulator extends BaseSimulator {
  constructor() {
    super();
    this.maxTokens = Infinity;
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
    const optMax = Number(options.maxTokens);
    this.maxTokens = Number.isFinite(optMax) && optMax >= 0 ? optMax : Infinity;
    
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
  async fireTransitionSpecific(transitionId, options = {}) {
    const { places, transitions, arcs } = this.petriNet;
    // Skip expensive enabled checks if firing in batch mode (caller guarantees transitions are enabled)
    const skipEnabledCheck = options.skipEnabledCheck || false;
    // Capture previous enabled transitions for parity event emission
    const previouslyEnabled = skipEnabledCheck ? [] : await this.getEnabledTransitionsSpecific();
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
    
    // Use shared token I/O to keep semantics consistent with APN path
    // Build picks for PT: each input arc consumes 'weight' anonymous tokens
    const picks = [];
    for (const arc of inputArcs) {
      const n = (arc.weight || 1) | 0;
      for (let i = 0; i < n; i++) {
        picks.push({ srcId: arc.source, countFallback: true });
      }
    }

    const placesById = Object.fromEntries(newPlaces.map(p => [p.id, p]));
    consumeTokens(picks, placesById);

    // For PT, outputArcs do not use algebraic bindings; produce count-only tokens
    const outputArcsNormalized = outputArcs.map(a => ({
      id: a.id,
      sourceId: a.source,
      targetId: a.target,
      weight: a.weight || 1,
    }));
    for (const arc of outputArcsNormalized) {
      const place = placesById[arc.targetId];
      if (!place) continue;
      // Ensure we are operating in PT mode: no valueTokens array
      if (Array.isArray(place.valueTokens)) {
        delete place.valueTokens;
      }
      const n = (arc.weight || 1) | 0;
      place.tokens = ((Number(place.tokens || 0) + n) | 0);
    }

    // Cap tokens by PT maxTokens per place (PT has scalar tokens)
    for (const p of newPlaces) {
      if (!Array.isArray(p.valueTokens)) {
        p.tokens = Math.min(this.maxTokens, (p.tokens || 0));
      } else {
        // If valueTokens accidentally exists, normalize back to PT counts
        p.tokens = Math.min(this.maxTokens, Array.isArray(p.valueTokens) ? p.valueTokens.length : (p.tokens || 0));
        delete p.valueTokens;
      }
    }
    
    // Update the Petri net
    this.petriNet = newPetriNet;

    // Skip expensive checks and event emissions if firing in batch mode (caller will handle after all fires complete)
    if (!skipEnabledCheck) {
      // Emit transition fired event using base helper
      this.emitTransitionFired({ transitionId, newPetriNet });

      // Emit transitionsChanged with parity payload
      const enabledAfter = await this.getEnabledTransitionsSpecific();
      this.emitTransitionsChanged({ enabled: enabledAfter, previouslyEnabled });
    }

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
    this.maxTokens = Infinity;
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
