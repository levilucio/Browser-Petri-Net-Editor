import { useState, useEffect, useCallback } from 'react';
import { capitalizeTypeNames, parseArithmetic } from '../../utils/arith-parser';
import { parseBooleanExpr } from '../../utils/z3-arith';
import { formatTokensList } from '../../utils/token-format';
import { useValueTokensInput } from './useValueTokensInput';
import { useBindingsInput } from './useBindingsInput';
import { computeGlobalTypeInferenceForState } from './useGlobalTypeInference';
import { inferTokenType, autoAnnotateTypes } from '../../utils/arith-parser';

/**
 * Hook to manage form state and handlers for the Properties Panel
 * Extracted from PropertiesPanel.jsx to reduce complexity
 */
export function usePropertiesForm({ selectedElement, elements, setElements, updateHistory, netMode }) {
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

  // Helper to get element ID and type
  const getElementInfo = useCallback(() => {
    if (!selectedElement) return { elementId: '', elementType: '' };
    const elementId = selectedElement.id || (selectedElement.element && selectedElement.element.id) || '';
    const elementType = selectedElement.type || (elementId.split('-')[0]);
    return { elementId, elementType };
  }, [selectedElement]);

  // Update local state when selected element changes
  useEffect(() => {
    if (selectedElement) {
      const { elementType } = getElementInfo();
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
  }, [selectedElement, getElementInfo]);

  const handleLabelChange = useCallback((e) => {
    const newLabel = e.target.value;
    setFormValues(prev => ({ ...prev, label: newLabel }));
    
    const { elementId, elementType } = getElementInfo();
    
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
  }, [getElementInfo, setElements, updateHistory]);

  const handleTokensChange = useCallback((e) => {
    let newTokens = parseInt(e.target.value, 10);
    if (!Number.isFinite(newTokens)) newTokens = 0;
    if (newTokens < 0) newTokens = 0;
    setFormValues(prev => ({ ...prev, tokens: newTokens }));
    
    const { elementId } = getElementInfo();
    setElements(prev => ({
      ...prev,
      places: prev.places.map(p => p.id === elementId ? { ...p, tokens: newTokens } : p)
    }));
    updateHistory();
  }, [getElementInfo, setElements, updateHistory]);

  const handleWeightChange = useCallback((e) => {
    const newWeight = parseInt(e.target.value, 10) || 1;
    setFormValues(prev => ({ ...prev, weight: newWeight }));
    
    const { elementId } = getElementInfo();
    setElements(prev => ({
      ...prev,
      arcs: prev.arcs.map(a => a.id === elementId ? { ...a, weight: newWeight } : a)
    }));
    updateHistory();
  }, [getElementInfo, setElements, updateHistory]);

  const handleValueTokensBlur = useCallback(() => {
    const input = formValues.valueTokensInput.trim();
    const { elementId } = getElementInfo();
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
  }, [formValues.valueTokensInput, getElementInfo, setElements, updateHistory, netMode, parseValueTokensInput]);

  const handleBindingsBlur = useCallback(() => {
    const input = formValues.bindingsInput.trim();
    setFormValues(prev => ({ ...prev, bindingError: null }));
    const { elementId } = getElementInfo();

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
  }, [formValues.bindingsInput, getElementInfo, setElements, updateHistory, netMode, validateBindings]);

  const handleGuardBlur = useCallback(() => {
    const guardInput = formValues.guardText.trim();
    setFormValues(prev => ({ ...prev, guardError: null }));
    
    const { elementId } = getElementInfo();
    
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
  }, [formValues.guardText, getElementInfo, setElements, updateHistory, netMode]);

  // Function to infer types for arcs connected to a specific place
  const inferTypesForPlace = useCallback((placeId) => {
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
  }, [netMode, elements, setElements, updateHistory]);

  // Backward-compatible wrapper that updates the current state using extracted helper
  const performGlobalTypeInference = useCallback(() => {
    const updated = computeGlobalTypeInferenceForState(elements, netMode);
    if (updated !== elements) {
      setElements(updated);
      updateHistory();
    }
  }, [elements, netMode, setElements, updateHistory]);

  return {
    formValues,
    setFormValues,
    handleLabelChange,
    handleTokensChange,
    handleWeightChange,
    handleValueTokensBlur,
    handleBindingsBlur,
    handleGuardBlur,
    inferTypesForPlace,
    performGlobalTypeInference,
    getElementInfo,
  };
}

export default usePropertiesForm;

