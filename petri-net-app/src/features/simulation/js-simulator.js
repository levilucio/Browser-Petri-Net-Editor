/**
 * Lightweight in-memory Petri net simulator for unit tests
 * Provides synchronous operations without Pyodide
 */

export class JsPetriNetSimulator {
  constructor(petriNet, options = {}) {
    this.tokenLimit = Number.isFinite(options.maxTokens) ? options.maxTokens : 20;
    this.setNet(petriNet);
  }

  setNet(petriNet) {
    this.places = new Map();
    this.transitions = new Map();
    this.arcs = Array.isArray(petriNet?.arcs) ? [...petriNet.arcs] : [];

    (petriNet?.places || []).forEach((p) => {
      this.places.set(p.id, { ...p, type: 'place' });
    });
    (petriNet?.transitions || []).forEach((t) => {
      this.transitions.set(t.id, { ...t, type: 'transition' });
    });
  }

  getInputPlaces(transitionId) {
    const result = [];
    for (const arc of this.arcs) {
      if (arc.targetId === transitionId && (arc.sourceType === 'place' || !arc.sourceType)) {
        const place = this.places.get(arc.sourceId);
        if (place) result.push([place, arc]);
      }
    }
    return result;
  }

  getOutputPlaces(transitionId) {
    const result = [];
    for (const arc of this.arcs) {
      if (arc.sourceId === transitionId && (arc.targetType === 'place' || !arc.targetType)) {
        const place = this.places.get(arc.targetId);
        if (place) result.push([place, arc]);
      }
    }
    return result;
  }

  isTransitionEnabled(transitionId) {
    const inputs = this.getInputPlaces(transitionId);
    for (const [place, arc] of inputs) {
      const weight = Number(arc.weight || 1);
      if ((place.tokens || 0) < weight) return false;
    }
    return true;
  }

  getEnabledTransitions() {
    const enabled = [];
    for (const [tid, transition] of this.transitions.entries()) {
      if (this.isTransitionEnabled(tid)) enabled.push({ ...transition });
    }
    return enabled;
  }

  fireTransition(transitionId) {
    if (!this.isTransitionEnabled(transitionId)) {
      throw new Error(`Transition ${transitionId} is not enabled`);
    }

    // Consume tokens
    for (const [place, arc] of this.getInputPlaces(transitionId)) {
      const weight = Number(arc.weight || 1);
      place.tokens = Math.max(0, (place.tokens || 0) - weight);
    }

    // Produce tokens (respect token limit)
    for (const [place, arc] of this.getOutputPlaces(transitionId)) {
      const weight = Number(arc.weight || 1);
      const newTokens = (place.tokens || 0) + weight;
      place.tokens = Math.min(this.tokenLimit, newTokens);
    }

    return this._snapshot();
  }

  _snapshot() {
    return {
      places: Array.from(this.places.values()).map((p) => ({ ...p })),
      transitions: Array.from(this.transitions.values()).map((t) => ({ ...t })),
      arcs: this.arcs.map((a) => ({ ...a })),
    };
  }
}


