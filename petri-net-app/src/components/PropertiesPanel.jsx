import React, { useState, useEffect, useContext } from 'react';
import { PetriNetContext } from '../contexts/PetriNetContext';
import { capitalizeTypeNames, parseArithmetic } from '../utils/arith-parser';
import { parseBooleanExpr } from '../utils/z3-arith';
import PlaceProperties from './panel/PlaceProperties.jsx';
import ArcBindingsEditor from './panel/ArcBindingsEditor.jsx';
import TransitionGuardEditor from './panel/TransitionGuardEditor.jsx';
import { useValueTokensInput } from './hooks/useValueTokensInput';
import { useBindingsInput } from './hooks/useBindingsInput';
import { computeGlobalTypeInferenceForState } from './hooks/useGlobalTypeInference';
import { formatTokensList } from '../utils/token-format';

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

  // Hooks for parsing/validation
  const { parseValueTokensInput } = useValueTokensInput();
  const { validateBindings } = useBindingsInput();

  // State for markings/enabled panels moved to PetriNetPanel

  // Update local state when selected element changes
  useEffect(() => {
    if (selectedElement) {
      const elementId = selectedElement.id || (selectedElement.element && selectedElement.element.id) || '';
      const elementType = selectedElement.type || (elementId.split('-')[0]);
      const toTF = (s) => (typeof s === 'boolean') ? (s ? 'T' : 'F') : String(s);
      const tokensToString = (arr) => Array.isArray(arr) ? formatTokensList(arr) : '';
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
    if (newTokens < 0) newTokens = 0;
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
    const elementId = selectedElement.id || (selectedElement.element && selectedElement.element.id);
    if (!input) {
      setElements(prev => ({
        ...prev,
        places: prev.places.map(p => p.id === elementId ? { ...p, valueTokens: [], tokens: 0 } : p)
      }));
      updateHistory();
      return;
    }

    const parsed = parseValueTokensInput(input);
    setElements(prev => {
      const newState = {
        ...prev,
        places: prev.places.map(p => p.id === elementId ? { ...p, valueTokens: parsed, tokens: parsed.length } : p)
      };
      return computeGlobalTypeInferenceForState(newState, netMode);
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

    const { ok, bindings, error } = validateBindings(input);
    if (!ok) {
      setFormValues(prev => ({ ...prev, bindingError: error }));
      return;
    }

    setElements(prev => ({
      ...prev,
      arcs: prev.arcs.map(a => a.id === elementId ? { ...a, bindings } : a)
    }));
    updateHistory();

    setElements(prev => {
      const baseState = {
        ...prev,
        arcs: prev.arcs.map(a => a.id === elementId ? { ...a, bindings } : a)
      };
      return computeGlobalTypeInferenceForState(baseState, netMode);
    });
    updateHistory();
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
        return computeGlobalTypeInferenceForState(baseState, netMode);
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
    if (process.env.NODE_ENV !== 'production') {
      console.log('=== inferTypesForPlace DEBUG ===');
      console.log('1. placeId:', placeId);
      console.log('2. netMode:', netMode);
      console.log('3. elements.places:', elements.places);
      console.log('4. elements.arcs:', elements.arcs);
    }
    
    if (netMode !== 'algebraic-int' || !elements.places || !elements.arcs) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('5. Early return - conditions not met');
      }
      return;
    }
    
    const place = elements.places.find(p => p.id === placeId);
    if (process.env.NODE_ENV !== 'production') {
      console.log('6. place found:', place);
    }
    if (!place || !place.valueTokens || place.valueTokens.length === 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('7. Early return - no place or no tokens');
      }
      return;
    }
    
    // Get the type of the most recently added token (last in the array)
    const tokenType = inferTokenType(place.valueTokens[place.valueTokens.length - 1]);
    if (process.env.NODE_ENV !== 'production') {
      console.log('8. tokenType:', tokenType);
    }
    
    // Find arcs that connect from this place
    const connectedArcs = elements.arcs.filter(arc => arc.source === placeId);
    if (process.env.NODE_ENV !== 'production') {
      console.log('9. connectedArcs:', connectedArcs);
    }
    
    const arcsToUpdate = [];
      connectedArcs.forEach(arc => {
        if (process.env.NODE_ENV !== 'production') {
          console.log('10. Processing arc:', arc);
          console.log('10a. arc.bindings:', arc.bindings);
          console.log('10b. arc.bindings length:', arc.bindings ? arc.bindings.length : 'undefined');
        }
        if (arc.bindings && arc.bindings.length > 0) {
          const currentBinding = arc.bindings[0];
          if (process.env.NODE_ENV !== 'production') {
            console.log('11. currentBinding:', currentBinding);
          }
        // Only update if the binding doesn't already have a type annotation
        if (currentBinding && !currentBinding.includes(':')) {
          const typeMap = new Map();
          // Extract variable names from the binding
          const varMatches = currentBinding.match(/\b[a-z][a-zA-Z0-9_]*\b/g);
          if (process.env.NODE_ENV !== 'production') {
            console.log('12. varMatches:', varMatches);
          }
          if (varMatches) {
            varMatches.forEach(varName => {
              if (varName !== 'true' && varName !== 'false' && 
                  varName !== 'and' && varName !== 'or' && varName !== 'not') {
                typeMap.set(varName, tokenType);
              }
            });
          }
          
          if (process.env.NODE_ENV !== 'production') {
            console.log('13. typeMap:', typeMap);
          }
          if (typeMap.size > 0) {
            const annotatedBinding = autoAnnotateTypes(currentBinding, typeMap);
            if (process.env.NODE_ENV !== 'production') {
              console.log('14. annotatedBinding:', annotatedBinding);
            }
            if (annotatedBinding !== currentBinding) {
              arcsToUpdate.push({ arcId: arc.id, newBinding: annotatedBinding });
            }
          }
        }
      }
    });
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('15. arcsToUpdate:', arcsToUpdate);
    }
    // Update arcs if any need type annotation
    if (arcsToUpdate.length > 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('16. Updating arcs');
      }
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
      if (process.env.NODE_ENV !== 'production') {
        console.log('16. No arcs to update');
      }
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('===================================');
    }
  };

  // Backward-compatible wrapper that updates the current state using extracted helper
  const performGlobalTypeInference = () => {
    const updated = computeGlobalTypeInferenceForState(elements, netMode);
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
      {selectedElement && elementType === 'place' && (
        <PlaceProperties
          mode={netMode}
          tokens={formValues.tokens}
          valueTokensInput={formValues.valueTokensInput}
          onTokensChange={handleTokensChange}
          onValueTokensChange={(e) => setFormValues(prev => ({ ...prev, valueTokensInput: e.target.value }))}
          onValueTokensBlur={handleValueTokensBlur}
        />
      )}

      {selectedElement && elementType === 'arc' && (
        <ArcBindingsEditor
          mode={netMode}
          weight={formValues.weight}
          bindingsInput={formValues.bindingsInput}
          bindingError={formValues.bindingError}
          onWeightChange={handleWeightChange}
          onBindingsChange={(e) => setFormValues(prev => ({ ...prev, bindingsInput: e.target.value }))}
          onBindingsBlur={handleBindingsBlur}
        />
      )}

      {selectedElement && elementType === 'transition' && netMode === 'algebraic-int' && (
        <TransitionGuardEditor
          guardText={formValues.guardText}
          guardError={formValues.guardError}
          onGuardChange={(e) => setFormValues(prev => ({ ...prev, guardText: e.target.value }))}
          onGuardBlur={handleGuardBlur}
        />
      )}
    </div>
  );
};

export default PropertiesPanel;
