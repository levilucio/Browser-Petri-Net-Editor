import React, { useState, useEffect, useContext } from 'react';
import { PetriNetContext } from '../contexts/PetriNetContext';
import { parseArithmetic, parsePattern, validatePatternTyping, addTypeAnnotations, stringifyPattern, capitalizeTypeNames, inferVariableTypes, autoAnnotateTypes, inferTokenType } from '../utils/arith-parser';
import { getTokensForPlace } from '../features/simulation/algebraic-simulator';
import { parseBooleanExpr } from '../utils/z3-arith';

const PropertiesPanel = ({ selectedElement, elements, setElements, updateHistory, simulationSettings }) => {
  // Read enabled transitions from context (fallback to defaults if no provider in unit tests)
  const context = useContext(PetriNetContext) || {};
  const enabledTransitionIds = context.enabledTransitionIds || [];
  const isSimulatorReady = context.isSimulatorReady || false;

  // Local state for form values to provide immediate feedback
  const [formValues, setFormValues] = useState({
    label: '',
    tokens: 0,
    weight: 1,
    valueTokensInput: '',
    bindingsInput: '',
    bindingError: null,
    guardText: '',
    guardError: null
  });

  // State for markings/enabled panels moved to PetriNetPanel

  // Update local state when selected element changes
  useEffect(() => {
    if (selectedElement) {
      const elementId = selectedElement.id || (selectedElement.element && selectedElement.element.id) || '';
      const elementType = selectedElement.type || (elementId.split('-')[0]);
      const toTF = (s) => (typeof s === 'boolean') ? (s ? 'T' : 'F') : String(s);
      const fmt = (v) => {
        if (typeof v === 'boolean') return v ? 'T' : 'F';
        if (typeof v === 'string') return `'${v}'`;
        if (Array.isArray(v)) return `[${v.map(fmt).join(', ')}]`;
        if (v && typeof v === 'object' && v.__pair__) return `(${fmt(v.fst)}, ${fmt(v.snd)})`;
        return String(v);
      };
      const tokensToString = (arr) => Array.isArray(arr) ? arr.map(fmt).join(', ') : '';
      const bindingsToString = (arr) => Array.isArray(arr) ? arr.map(b => {
        const t = String(b || '');
        if (/^true$/i.test(t)) return 'T';
        if (/^false$/i.test(t)) return 'F';
        return capitalizeTypeNames(t);
      }).join(', ') : '';
      setFormValues((prev) => ({
        ...prev,
        label: selectedElement.label || '',
        tokens: selectedElement.tokens || 0,
        weight: selectedElement.weight !== undefined ? selectedElement.weight : 1,
        valueTokensInput: tokensToString(selectedElement.valueTokens),
        bindingsInput: elementType === 'arc' ? bindingsToString(selectedElement.bindings) : '',
        guardText: elementType === 'transition' ? String(selectedElement.guard || '').replace(/\btrue\b/gi, 'T').replace(/\bfalse\b/gi, 'F') : ''
      }));
    }
  }, [selectedElement]);

  // Do not early-return; we want markings and enabled transitions to always render

  const handleLabelChange = (e) => {
    const newLabel = e.target.value;
    // Update local state for immediate feedback
    setFormValues(prev => ({ ...prev, label: newLabel }));
    
    // Get the actual element ID, handling both direct and nested structures
    const elementId = selectedElement.id || (selectedElement.element && selectedElement.element.id);
    const elementType = selectedElement.type || (elementId && elementId.split('-')[0]);
    
    if (elementType === 'place') {
      setElements(prev => ({
        ...prev,
        places: prev.places.map(p => p.id === elementId ? { ...p, label: newLabel } : p)
      }));
    } else if (elementType === 'transition') {
      setElements(prev => ({
        ...prev,
        transitions: prev.transitions.map(t => t.id === elementId ? { ...t, label: newLabel } : t)
      }));
    } else if (elementType === 'arc') {
      setElements(prev => ({
        ...prev,
        arcs: prev.arcs.map(a => a.id === elementId ? { ...a, label: newLabel } : a)
      }));
    }
    updateHistory();
  };

  const handleTokensChange = (e) => {
    let newTokens = parseInt(e.target.value, 10);
    if (!Number.isFinite(newTokens)) newTokens = 0;
    // Clamp to [0, maxTokens]
    const max = (simulationSettings && typeof simulationSettings.maxTokens === 'number') ? simulationSettings.maxTokens : 20;
    if (newTokens < 0) newTokens = 0;
    if (newTokens > max) newTokens = max;
    setFormValues(prev => ({ ...prev, tokens: newTokens }));
    
    const elementId = selectedElement.id || (selectedElement.element && selectedElement.element.id);
    setElements(prev => ({
      ...prev,
      places: prev.places.map(p => p.id === elementId ? { ...p, tokens: newTokens } : p)
    }));
    updateHistory();
  };

  const handleWeightChange = (e) => {
    const newWeight = parseInt(e.target.value, 10) || 1;
    setFormValues(prev => ({ ...prev, weight: newWeight }));
    
    const elementId = selectedElement.id || (selectedElement.element && selectedElement.element.id);
    setElements(prev => ({
      ...prev,
      arcs: prev.arcs.map(a => a.id === elementId ? { ...a, weight: newWeight } : a)
    }));
    updateHistory();
  };

  const handleValueTokensBlur = () => {
    const input = formValues.valueTokensInput.trim();
    if (!input) {
      // Empty input: clear valueTokens but keep at least tokens=0
      const elementId = selectedElement.id || (selectedElement.element && selectedElement.element.id);
      setElements(prev => ({
        ...prev,
        places: prev.places.map(p => p.id === elementId ? { ...p, valueTokens: [], tokens: 0 } : p)
      }));
      updateHistory();
      return;
    }
    
    // Parse comma-separated tokens
    const parsePart = (part) => {
      const p = part.trim();
      const low = p.toLowerCase();
      if (p === 'T' || low === 'true') return true;
      if (p === 'F' || low === 'false') return false;
      if (/^[+-]?\d+$/.test(p)) return parseInt(p, 10);
      // Handle string literals
      if (p.startsWith("'") && p.endsWith("'") && p.length >= 2) {
        return p.slice(1, -1);
      }
      // Handle pair literals: (x, y)
      if (p.startsWith('(') && p.endsWith(')')) {
        const inner = p.slice(1, -1);
        const parts = inner.split(',').map(x => x.trim());
        if (parts.length === 2) {
          return { __pair__: true, fst: parsePart(parts[0]), snd: parsePart(parts[1]) };
        }
      }
      // Handle list literals: [x, y, z]
      if (p.startsWith('[') && p.endsWith(']')) {
        const inner = p.slice(1, -1).trim();
        if (inner.length === 0) return [];
        // Split by commas, respecting nesting
        const elements = [];
        let current = '';
        let depth = 0;
        for (let i = 0; i < inner.length; i++) {
          const ch = inner[i];
          if (ch === '[' || ch === '(') depth++;
          else if (ch === ']' || ch === ')') depth--;
          else if (ch === ',' && depth === 0) {
            elements.push(parsePart(current));
            current = '';
            continue;
          }
          current += ch;
        }
        if (current.trim()) elements.push(parsePart(current));
        return elements;
      }
      return null;
    };

    // Split by commas at the top level only
    const splitTopLevel = (str) => {
      const parts = [];
      let current = '';
      let depth = 0;
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch === '(' || ch === '[') depth++;
        else if (ch === ')' || ch === ']') depth--;
        else if (ch === ',' && depth === 0) {
          parts.push(current);
          current = '';
          continue;
        }
        current += ch;
      }
      if (current.trim()) parts.push(current);
      return parts;
    };

    const parts = splitTopLevel(input);
    const parsed = parts.map(parsePart).filter(v => v !== null);

    // DEBUG LOGGING
    console.log('=== DEBUG handleValueTokensBlur ===');
    console.log('1. Input string:', input);
    console.log('2. After splitTopLevel:', parts);
    console.log('3. After parsing each part:', parsed);
    console.log('4. Parsed length:', parsed.length);
    console.log('5. First element type:', Array.isArray(parsed[0]) ? 'Array' : typeof parsed[0]);
    console.log('6. First element value:', parsed[0]);
    console.log('===================================');

    const elementId = selectedElement.id || (selectedElement.element && selectedElement.element.id);
    setElements(prev => {
      const newState = {
        ...prev,
        places: prev.places.map(p => p.id === elementId ? { ...p, valueTokens: parsed, tokens: parsed.length } : p)
      };
      
      // Run global type inference synchronously against the just-updated state
      const inferredState = computeGlobalTypeInference(newState);
      return inferredState;
      
      // return newState; // unreachable
    });
    updateHistory();
  };

  const handleBindingsBlur = () => {
    const input = formValues.bindingsInput.trim();
    setFormValues(prev => ({ ...prev, bindingError: null }));
    
    const elementId = selectedElement.id || (selectedElement.element && selectedElement.element.id);
    
    if (!input) {
      setElements(prev => ({
        ...prev,
        arcs: prev.arcs.map(a => a.id === elementId ? { ...a, bindings: [] } : a)
      }));
      updateHistory();
      return;
    }

    // Split by commas, being careful with nested structures
    const parts = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth--;
      else if (ch === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    if (current.trim()) parts.push(current.trim());

    const bindings = parts.filter(b => b.length > 0);

    // Validate bindings by trying to parse them
    let allValid = true;
    for (const binding of bindings) {
      try {
        // Try to parse as pattern first
        parsePattern(binding);
      } catch (e1) {
        try {
          // If pattern fails, try arithmetic expression
          parseArithmetic(binding);
        } catch (e2) {
          try {
            // Finally try boolean expression
            parseBooleanExpr(binding, parseArithmetic);
          } catch (e3) {
            // If all fail, it's invalid
            allValid = false;
            setFormValues(prev => ({ ...prev, bindingError: `Invalid binding: ${binding}` }));
            break;
          }
        }
      }
    }

    if (allValid) {
      setElements(prev => ({
        ...prev,
        arcs: prev.arcs.map(a => a.id === elementId ? { ...a, bindings } : a)
      }));
      updateHistory();
      
      // Run global type inference synchronously after arc binding change
      setElements(prev => {
        const baseState = {
          ...prev,
          arcs: prev.arcs.map(a => a.id === elementId ? { ...a, bindings } : a)
        };
        return computeGlobalTypeInference(baseState);
      });
      updateHistory();
    }
  };

  const handleGuardBlur = () => {
    const guardInput = formValues.guardText.trim();
    setFormValues(prev => ({ ...prev, guardError: null }));
    
    const elementId = selectedElement.id || (selectedElement.element && selectedElement.element.id);
    
    if (!guardInput) {
      setElements(prev => ({
        ...prev,
        transitions: prev.transitions.map(t => t.id === elementId ? { ...t, guard: '' } : t)
      }));
      updateHistory();
      return;
    }
    
    // Validate guard
    try {
      parseBooleanExpr(guardInput, parseArithmetic);
      setElements(prev => ({
        ...prev,
        transitions: prev.transitions.map(t => t.id === elementId ? { ...t, guard: guardInput } : t)
      }));
      updateHistory();
      
      // Run global type inference synchronously after guard change
      setElements(prev => {
        const baseState = {
          ...prev,
          transitions: prev.transitions.map(t => t.id === elementId ? { ...t, guard: guardInput } : t)
        };
        return computeGlobalTypeInference(baseState);
      });
      updateHistory();
    } catch (e) {
      setFormValues(prev => ({ ...prev, guardError: `Invalid guard: ${e.message}` }));
    }
  };

  if (!selectedElement) return null;

  const elementId = selectedElement.id || (selectedElement.element && selectedElement.element.id) || '';
  const elementType = selectedElement.type || (elementId.split('-')[0]);
  const netMode = simulationSettings?.netMode || 'pt';

  // Function to infer types for arcs connected to a specific place
  const inferTypesForPlace = (placeId) => {
    console.log('=== inferTypesForPlace DEBUG ===');
    console.log('1. placeId:', placeId);
    console.log('2. netMode:', netMode);
    console.log('3. elements.places:', elements.places);
    console.log('4. elements.arcs:', elements.arcs);
    
    if (netMode !== 'algebraic-int' || !elements.places || !elements.arcs) {
      console.log('5. Early return - conditions not met');
      return;
    }
    
    const place = elements.places.find(p => p.id === placeId);
    console.log('6. place found:', place);
    if (!place || !place.valueTokens || place.valueTokens.length === 0) {
      console.log('7. Early return - no place or no tokens');
      return;
    }
    
    // Get the type of the most recently added token (last in the array)
    const tokenType = inferTokenType(place.valueTokens[place.valueTokens.length - 1]);
    console.log('8. tokenType:', tokenType);
    
    // Find arcs that connect from this place
    const connectedArcs = elements.arcs.filter(arc => arc.source === placeId);
    console.log('9. connectedArcs:', connectedArcs);
    
    const arcsToUpdate = [];
      connectedArcs.forEach(arc => {
        console.log('10. Processing arc:', arc);
        console.log('10a. arc.bindings:', arc.bindings);
        console.log('10b. arc.bindings length:', arc.bindings ? arc.bindings.length : 'undefined');
        if (arc.bindings && arc.bindings.length > 0) {
          const currentBinding = arc.bindings[0];
          console.log('11. currentBinding:', currentBinding);
        // Only update if the binding doesn't already have a type annotation
        if (currentBinding && !currentBinding.includes(':')) {
          const typeMap = new Map();
          // Extract variable names from the binding
          const varMatches = currentBinding.match(/\b[a-z][a-zA-Z0-9_]*\b/g);
          console.log('12. varMatches:', varMatches);
          if (varMatches) {
            varMatches.forEach(varName => {
              if (varName !== 'true' && varName !== 'false' && 
                  varName !== 'and' && varName !== 'or' && varName !== 'not') {
                typeMap.set(varName, tokenType);
              }
            });
          }
          
          console.log('13. typeMap:', typeMap);
          if (typeMap.size > 0) {
            const annotatedBinding = autoAnnotateTypes(currentBinding, typeMap);
            console.log('14. annotatedBinding:', annotatedBinding);
            if (annotatedBinding !== currentBinding) {
              arcsToUpdate.push({ arcId: arc.id, newBinding: annotatedBinding });
            }
          }
        }
      }
    });
    
    console.log('15. arcsToUpdate:', arcsToUpdate);
    // Update arcs if any need type annotation
    if (arcsToUpdate.length > 0) {
      console.log('16. Updating arcs');
      setElements(prev => ({
          ...prev,
        arcs: prev.arcs.map(arc => {
          const update = arcsToUpdate.find(u => u.arcId === arc.id);
          if (update) {
            return { ...arc, bindings: [update.newBinding] };
          }
          return arc;
        })
      }));
      updateHistory();
    } else {
      console.log('16. No arcs to update');
    }
    console.log('===================================');
  };

  // Function to get the unique type of all tokens in a place, or null if ambiguous
  const getPlaceTokenType = (place) => {
    if (!place.valueTokens || place.valueTokens.length === 0) {
      return null;
    }
    
    const firstTokenType = inferTokenType(place.valueTokens[0]);
    const allSameType = place.valueTokens.every(token => inferTokenType(token) === firstTokenType);
    
    return allSameType ? firstTokenType : null;
  };

  // Pure function: given a state snapshot, return a new state with inferred types applied
  const computeGlobalTypeInference = (state) => {
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
            const currentBinding = arc.bindings[0];
            if (currentBinding) {
              const typeMap = new Map();
              const varMatches = currentBinding.match(/\b[a-z][a-zA-Z0-9_]*\b/g);
              if (varMatches) {
                varMatches.forEach(varName => {
                  if (varName !== 'true' && varName !== 'false' && varName !== 'and' && varName !== 'or' && varName !== 'not') {
                    if (!currentBinding.includes(`${varName}:`)) typeMap.set(varName, placeTokenType);
                  }
                });
              }
              if (typeMap.size > 0) {
                const annotatedBinding = autoAnnotateTypes(currentBinding, typeMap);
                if (annotatedBinding !== currentBinding) updates.arcs.push({ arcId: arc.id, newBinding: annotatedBinding });
              }
            }
          }
        });
      }
    });

    // Prepare a view of arcs that includes any Rule 1 updates so subsequent rules see fresh input types
    const arcsEffective = state.arcs.map(arc => {
      const upd = updates.arcs.find(u => u.arcId === arc.id);
      return upd ? { ...arc, bindings: [upd.newBinding] } : arc;
    });

    // Rule 2 and 3: Use input arc types to annotate guard and output arcs
    state.transitions.forEach(transition => {
      const inputArcs = arcsEffective.filter(arc => arc.target === transition.id);
      const variableTypes = new Map();

      inputArcs.forEach(arc => {
        if (arc.bindings && arc.bindings.length > 0) {
          const binding = arc.bindings[0];
          const typedVarMatches = binding.match(/\b([a-z][a-zA-Z0-9_]*):(Int|Bool|Pair|String|List)\b/g);
          if (typedVarMatches) {
            typedVarMatches.forEach(match => {
              const [, varName, varType] = match.match(/\b([a-z][a-zA-Z0-9_]*):(Int|Bool|Pair|String|List)\b/);
              variableTypes.set(varName, varType);
            });
          }
        }
      });

      // Rule 2: guard variables
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

      // Rule 3: output arcs
      const outputArcs = arcsEffective.filter(arc => arc.source === transition.id);
      outputArcs.forEach(arc => {
        if (arc.bindings && arc.bindings.length > 0) {
          const currentBinding = arc.bindings[0];
          if (currentBinding) {
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
            if (typeMap.size > 0) {
              const annotatedBinding = autoAnnotateTypes(currentBinding, typeMap);
              if (annotatedBinding !== currentBinding) updates.arcs.push({ arcId: arc.id, newBinding: annotatedBinding });
            }
          }
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
        return upd ? { ...arc, bindings: [upd.newBinding] } : arc;
      }),
      transitions: state.transitions.map(t => {
        const upd = updates.transitions.find(u => u.transitionId === t.id);
        return upd ? { ...t, guard: upd.newGuard } : t;
      })
    };

    return nextState;
  };

  // Backward-compatible wrapper that updates the current state
  const performGlobalTypeInference = () => {
    const updated = computeGlobalTypeInference(elements);
    if (updated !== elements) {
      setElements(updated);
      updateHistory();
    }
  };

  return (
    <div className="properties-panel w-full px-4 py-2 overflow-y-auto mx-0">
      <h2 className="text-lg font-semibold mb-4">Properties</h2>

      {/* Label */}
        <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
          <input
            type="text"
            value={formValues.label}
            onChange={handleLabelChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="P1, P2, etc."
          />
        </div>

      {/* Place-specific properties */}
      {selectedElement && elementType === 'place' && netMode === 'pt' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Tokens (PT mode)</label>
          <input
            type="number"
            min="0"
            value={formValues.tokens}
            onChange={handleTokensChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {selectedElement && elementType === 'place' && netMode === 'algebraic-int' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Algebraic Tokens</label>
          <input
            type="text"
            value={formValues.valueTokensInput}
            onChange={(e) => setFormValues(prev => ({ ...prev, valueTokensInput: e.target.value }))}
            onBlur={handleValueTokensBlur}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
            placeholder="e.g., 2, 3, 'hello', T, F, (1, 2), [1, 2, 3]"
          />
        </div>
      )}

      {selectedElement && elementType === 'arc' && netMode === 'pt' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
          <input
            type="number"
            min="1"
            value={formValues.weight}
            onChange={handleWeightChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {selectedElement && elementType === 'arc' && netMode === 'algebraic-int' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Bindings</label>
          <input
            type="text"
            value={formValues.bindingsInput}
            onChange={(e) => setFormValues(prev => ({ ...prev, bindingsInput: e.target.value }))}
            onBlur={handleBindingsBlur}
            className={`w-full px-3 py-2 border rounded-md font-mono text-sm ${
              formValues.bindingError ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="e.g., x, y, (a, b)"
          />
          {formValues.bindingError && (
            <p className="text-red-600 text-xs mt-1">{formValues.bindingError}</p>
          )}
        </div>
      )}

      {selectedElement && elementType === 'transition' && netMode === 'algebraic-int' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Guard</label>
          <input
            type="text"
            value={formValues.guardText}
            onChange={(e) => setFormValues(prev => ({ ...prev, guardText: e.target.value }))}
            onBlur={handleGuardBlur}
            className={`w-full px-3 py-2 border rounded-md font-mono text-sm ${
              formValues.guardError ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="e.g., x > 0 and y < 10"
          />
          {formValues.guardError && (
            <p className="text-red-600 text-xs mt-1">{formValues.guardError}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PropertiesPanel;
