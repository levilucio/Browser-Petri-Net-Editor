// Centralized helpers for window-scoped testing hooks and globals

export function syncWindowGlobals({ elements, selectedElements, mode, clipboardRef, simulationSettings, simulatorCore }) {
  try {
    if (elements) {
      window.__PETRI_NET_STATE__ = {
        places: elements.places,
        transitions: elements.transitions,
        arcs: elements.arcs,
        selectedElements: selectedElements || [],
      };
    }
    if (typeof mode !== 'undefined') {
      window.__PETRI_NET_MODE__ = mode;
    }
    if (clipboardRef) {
      window.__PETRI_NET_CLIPBOARD__ = clipboardRef;
    }

    if (simulationSettings) {
      const DEFAULT_MAX_STEPS = 200000;
      const batchMode = Boolean(simulationSettings?.batchMode);
      const limitIterations = Boolean(simulationSettings?.limitIterations);
      const rawMaxIterations = Number(simulationSettings?.maxIterations);
      const sanitizedMaxIterations = Number.isFinite(rawMaxIterations) && rawMaxIterations > 0
        ? Math.floor(rawMaxIterations)
        : DEFAULT_MAX_STEPS;
      const nonVisual = Boolean(simulationSettings?.useNonVisualRun || batchMode);

      window.__PETRI_NET_NON_VISUAL_RUN__ = nonVisual;
      window.__PETRI_NET_SETTINGS__ = {
        ...(window.__PETRI_NET_SETTINGS__ || {}),
        batchMode,
        limitIterations,
        maxIterations: sanitizedMaxIterations,
      };
    }

    if (simulatorCore && !window.__PETRI_NET_SIM_CORE__) {
      window.__PETRI_NET_SIM_CORE__ = simulatorCore;
    }
  } catch (_) {
    // Ignore in environments without window
  }
}

export const TestGlobals = {
  setState: (state) => { window.__PETRI_NET_STATE__ = state; },
  getState: () => window.__PETRI_NET_STATE__,
  setMode: (m) => { window.__PETRI_NET_MODE__ = m; },
  getMode: () => window.__PETRI_NET_MODE__,
  setClipboard: (c) => { window.__PETRI_NET_CLIPBOARD__ = c; },
  getClipboard: () => window.__PETRI_NET_CLIPBOARD__,
  setSettings: (s) => { window.__PETRI_NET_SETTINGS__ = s; },
  getSettings: () => window.__PETRI_NET_SETTINGS__,
};



