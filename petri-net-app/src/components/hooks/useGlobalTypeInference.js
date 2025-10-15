// Extracted from PropertiesPanel to keep the orchestrator lean.
// Provides pure helpers reused by the panel.

import { autoAnnotateTypes, inferTokenType } from '../../utils/arith-parser';

function getPlaceTokenType(place) {
  if (!place?.valueTokens || place.valueTokens.length === 0) return null;
  const firstTokenType = inferTokenType(place.valueTokens[0]);
  const allSameType = place.valueTokens.every(token => inferTokenType(token) === firstTokenType);
  return allSameType ? firstTokenType : null;
}

export function computeGlobalTypeInferenceForState(state, netMode) {
  if (netMode !== 'algebraic-int' || !state?.places || !state?.arcs || !state?.transitions) {
    return state;
  }

  const updates = { arcs: [], transitions: [] };

  // Rule 1: Infer types for input arcs based on source place tokens (only if unambiguous)
  state.places.forEach(place => {
    const placeTokenType = getPlaceTokenType(place);
    if (placeTokenType) {
      const inputArcs = state.arcs.filter(arc => arc.source === place.id);
      inputArcs.forEach(arc => {
        if (arc.bindings && arc.bindings.length > 0) {
          const updatedBindings = [];
          let changed = false;
          for (const currentBinding of arc.bindings) {
            if (!currentBinding) { updatedBindings.push(currentBinding); continue; }
            const typeMap = new Map();
            const varMatches = currentBinding.match(/\b[a-z][a-zA-Z0-9_]*\b/g);
            if (varMatches) {
              varMatches.forEach(varName => {
                if (varName !== 'true' && varName !== 'false' && varName !== 'and' && varName !== 'or' && varName !== 'not') {
                  if (!currentBinding.includes(`${varName}:`)) typeMap.set(varName, placeTokenType);
                }
              });
            }
            if (placeTokenType === 'List') {
              const vt = Array.isArray(place.valueTokens) ? place.valueTokens : [];
              let elementType = null;
              if (vt.length > 0 && Array.isArray(vt[0]) && vt[0].length > 0) {
                const firstElemType = inferTokenType(vt[0][0]);
                const allSame = vt.every(lst => Array.isArray(lst) && lst.every(el => inferTokenType(el) === firstElemType));
                if (allSame) elementType = firstElemType;
              }
              if (elementType) {
                for (const [k, v] of Array.from(typeMap.entries())) {
                  if (v === 'List') typeMap.set(k, elementType);
                }
              } else {
                typeMap.clear();
              }
            }
            const annotated = typeMap.size > 0 ? autoAnnotateTypes(currentBinding, typeMap) : currentBinding;
            if (annotated !== currentBinding) changed = true;
            updatedBindings.push(annotated);
          }
          if (changed) updates.arcs.push({ arcId: arc.id, newBindings: updatedBindings });
        }
      });
    }
  });

  // Prepare arcs effective view
  const arcsEffective = state.arcs.map(arc => {
    const upd = updates.arcs.find(u => u.arcId === arc.id);
    if (!upd) return arc;
    if (upd.newBindings) return { ...arc, bindings: [...upd.newBindings] };
    return { ...arc, bindings: [upd.newBinding] };
  });

  // Rules 2 & 3: annotate guard and output arcs from input types
  state.transitions.forEach(transition => {
    const inputArcs = arcsEffective.filter(arc => arc.target === transition.id);
    const variableTypes = new Map();

    inputArcs.forEach(arc => {
      if (arc.bindings && arc.bindings.length > 0) {
        const binding = arc.bindings[0];
        const typedVarMatches = binding.match(/\b([a-z][a-zA-Z0-9_]*)\:(Int|Bool|Pair|String|List)\b/g);
        if (typedVarMatches) {
          typedVarMatches.forEach(match => {
            const [, varName, varType] = match.match(/\b([a-z][a-zA-Z0-9_]*)\:(Int|Bool|Pair|String|List)\b/);
            variableTypes.set(varName, varType);
          });
        }
      }
    });

    // Guard
    if (transition.guard && variableTypes.size > 0) {
      const guardVarMatches = transition.guard.match(/\b[a-z][a-zA-Z0-9_]*\b/g);
      if (guardVarMatches) {
        const guardTypeMap = new Map();
        guardVarMatches.forEach(varName => {
          if (varName !== 'true' && varName !== 'false' && varName !== 'and' && varName !== 'or' && varName !== 'not') {
            const inputType = variableTypes.get(varName);
            if (inputType && !transition.guard.includes(`${varName}:`)) guardTypeMap.set(varName, inputType);
          }
        });
        if (guardTypeMap.size > 0) {
          const annotatedGuard = autoAnnotateTypes(transition.guard, guardTypeMap);
          if (annotatedGuard !== transition.guard) updates.transitions.push({ transitionId: transition.id, newGuard: annotatedGuard });
        }
      }
    }

    // Output arcs
    const outputArcs = arcsEffective.filter(arc => arc.source === transition.id);
    outputArcs.forEach(arc => {
      if (arc.bindings && arc.bindings.length > 0) {
        const newBindings = [];
        let changed = false;
        for (const currentBinding of arc.bindings) {
          if (!currentBinding) { newBindings.push(currentBinding); continue; }
          const typeMap = new Map();
          const varMatches = currentBinding.match(/\b[a-z][a-zA-Z0-9_]*\b/g);
          if (varMatches) {
            varMatches.forEach(varName => {
              if (varName !== 'true' && varName !== 'false' && varName !== 'and' && varName !== 'or' && varName !== 'not') {
                const inputType = variableTypes.get(varName);
                if (inputType && !currentBinding.includes(`${varName}:`)) typeMap.set(varName, inputType);
              }
            });
          }
          const annotatedBinding = typeMap.size > 0 ? autoAnnotateTypes(currentBinding, typeMap) : currentBinding;
          if (annotatedBinding !== currentBinding) changed = true;
          newBindings.push(annotatedBinding);
        }
        if (changed) updates.arcs.push({ arcId: arc.id, newBindings });
      }
    });
  });

  if (updates.arcs.length === 0 && updates.transitions.length === 0) {
    return state;
  }

  const nextState = {
    ...state,
    arcs: state.arcs.map(arc => {
      const upd = updates.arcs.find(u => u.arcId === arc.id);
      if (!upd) return arc;
      if (upd.newBindings) return { ...arc, bindings: [...upd.newBindings] };
      return { ...arc, bindings: [upd.newBinding] };
    }),
    transitions: state.transitions.map(t => {
      const upd = updates.transitions.find(u => u.transitionId === t.id);
      return upd ? { ...t, guard: upd.newGuard } : t;
    })
  };

  return nextState;
}


