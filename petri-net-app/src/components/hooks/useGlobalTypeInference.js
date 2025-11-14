// Extracted from PropertiesPanel to keep the orchestrator lean.
// Provides pure helpers reused by the panel.

import { autoAnnotateTypes, inferTokenType } from '../../utils/arith-parser';

function getPlaceTokenType(place) {
  if (!place?.valueTokens || place.valueTokens.length === 0) return null;
  const firstTokenType = inferTokenType(place.valueTokens[0]);
  const allSameType = place.valueTokens.every(token => inferTokenType(token) === firstTokenType);
  return allSameType ? firstTokenType : null;
}

export function computeGlobalTypeInferenceForState(state, netMode, showInferredTypes = true) {
  if (!showInferredTypes) {
    console.log('[TypeInference] Disabled, returning original state');
    return state;
  }

  if (netMode !== 'algebraic-int' || !state?.places || !state?.arcs || !state?.transitions) {
    console.log('[TypeInference] Skipping - netMode:', netMode, 'hasPlaces:', !!state?.places);
    return state;
  }

  console.log('[TypeInference] Starting with overwrite=', showInferredTypes);

  const updates = { arcs: [], transitions: [] };

  // Rule 1: Infer types for input arcs based on source place tokens (only if unambiguous)
  const overwriteExisting = Boolean(showInferredTypes);

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
                  else {
                    // Still record explicit annotations so downstream consumers know the type
                    const explicit = currentBinding.match(new RegExp(`${varName}:(Int|Bool|Pair|String|List)`, 'i'));
                    if (explicit && explicit[1]) {
                      typeMap.set(varName, explicit[1]);
                    }
                  }
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
            const annotated = typeMap.size > 0
              ? autoAnnotateTypes(currentBinding, typeMap, null, { overwrite: overwriteExisting })
              : currentBinding;
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
    console.log('[TypeInference] Processing transition:', transition.id, 'inputArcs:', inputArcs.length);

    inputArcs.forEach(arc => {
      if (arc.bindings && arc.bindings.length > 0) {
        // Process ALL bindings in the array, not just the first one
        arc.bindings.forEach(binding => {
          if (!binding) return;
          console.log('[TypeInference] Input arc binding:', binding);
          // Extract types from explicitly annotated variables
          const typedVarMatches = binding.match(/\b([a-z][a-zA-Z0-9_]*)\:(Int|Bool|Pair|String|List)\b/gi);
          if (typedVarMatches) {
            typedVarMatches.forEach(match => {
              const parts = match.match(/\b([a-z][a-zA-Z0-9_]*)\:(Int|Bool|Pair|String|List)\b/i);
              if (parts && parts[1] && parts[2]) {
                variableTypes.set(parts[1], parts[2]);
              }
            });
          }
          // Also extract ALL variables and infer types from source place if not already annotated
          const allVarMatches = binding.match(/\b[a-z][a-zA-Z0-9_]*\b/g);
          console.log('[TypeInference] All variable matches in binding:', allVarMatches);
          if (allVarMatches) {
            const sourcePlace = state.places.find(p => p.id === arc.source);
            if (sourcePlace) {
              const placeTokenType = getPlaceTokenType(sourcePlace);
              if (placeTokenType) {
                allVarMatches.forEach(varName => {
                  if (varName !== 'true' && varName !== 'false' && varName !== 'and' && varName !== 'or' && varName !== 'not') {
                    // Only set if not already in map (explicit annotations take precedence)
                    if (!variableTypes.has(varName)) {
                      variableTypes.set(varName, placeTokenType);
                    }
                  }
                });
              }
            }
          }
        });
      }
    });

    console.log('[TypeInference] Extracted variable types for', transition.id, ':', JSON.stringify(Array.from(variableTypes.entries())));

    // Guard
    if (transition.guard && variableTypes.size > 0) {
      const guardVarMatches = transition.guard.match(/\b[a-z][a-zA-Z0-9_]*\b/g);
      if (guardVarMatches) {
        const guardTypeMap = new Map();
        guardVarMatches.forEach(varName => {
          if (varName !== 'true' && varName !== 'false' && varName !== 'and' && varName !== 'or' && varName !== 'not') {
            const inputType = variableTypes.get(varName);
            if (!inputType) return;
            // When overwriteExisting is true, always add all variables to ensure full annotation
            // When false, only add if not already annotated
            if (overwriteExisting) {
              guardTypeMap.set(varName, inputType);
            } else {
              const alreadyAnnotated = new RegExp(`\\b${varName}\\s*:(Int|Bool|Pair|String|List)\\b`, 'i').test(transition.guard);
              if (!alreadyAnnotated) {
                guardTypeMap.set(varName, inputType);
              }
            }
          }
        });
        console.log('[TypeInference] Guard type map for', transition.id, ':', Array.from(guardTypeMap.entries()));
        if (guardTypeMap.size > 0) {
          const annotatedGuard = autoAnnotateTypes(transition.guard, guardTypeMap, null, { overwrite: overwriteExisting });
          console.log('[TypeInference] Guard before:', transition.guard);
          console.log('[TypeInference] Guard after:', annotatedGuard);
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
                if (!inputType) return;
                // When overwriteExisting is true, always add all variables to ensure full annotation
                // When false, only add if not already annotated
                if (overwriteExisting) {
                  typeMap.set(varName, inputType);
                } else {
                  const alreadyAnnotated = new RegExp(`\\b${varName}\\s*:(Int|Bool|Pair|String|List)\\b`, 'i').test(currentBinding);
                  if (!alreadyAnnotated) {
                    typeMap.set(varName, inputType);
                  }
                }
              }
            });
          }
          const annotatedBinding = typeMap.size > 0
            ? autoAnnotateTypes(currentBinding, typeMap, null, { overwrite: overwriteExisting })
            : currentBinding;
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


