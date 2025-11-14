import { useCallback } from 'react';
import { computeGlobalTypeInferenceForState } from '../useGlobalTypeInference';
import { capitalizeTypeNames } from '../../../utils/arith-parser';

export const useArcFormHandlers = ({
  formValues,
  setFormValues,
  getElementInfo,
  setElements,
  updateHistory,
  netMode,
  validateBindings,
  showInferredTypes,
}) => {
  const handleWeightChange = useCallback((event) => {
    const newWeight = parseInt(event.target.value, 10) || 1;
    setFormValues((prev) => ({ ...prev, weight: newWeight }));

    const { elementId } = getElementInfo();
    setElements((prev) => ({
      ...prev,
      arcs: prev.arcs.map((arc) => (arc.id === elementId ? { ...arc, weight: newWeight } : arc)),
    }));
    updateHistory();
  }, [getElementInfo, setElements, updateHistory, setFormValues]);

  const handleBindingsBlur = useCallback(() => {
    const input = formValues.bindingsInput.trim();
    setFormValues((prev) => ({ ...prev, bindingError: null }));
    const { elementId } = getElementInfo();

    if (!input) {
      setElements((prev) => ({
        ...prev,
        arcs: prev.arcs.map((arc) => (arc.id === elementId ? { ...arc, bindings: [] } : arc)),
      }));
      updateHistory();
      return;
    }

    const { ok, bindings, error } = validateBindings(input);
    if (!ok) {
      setFormValues((prev) => ({ ...prev, bindingError: error }));
      return;
    }

    setElements((prev) => ({
      ...prev,
      arcs: prev.arcs.map((arc) => (arc.id === elementId ? { ...arc, bindings } : arc)),
    }));
    updateHistory();

    setElements((prev) => {
      const nextState = {
        ...prev,
        arcs: prev.arcs.map((arc) => (arc.id === elementId ? { ...arc, bindings } : arc)),
      };
      return computeGlobalTypeInferenceForState(nextState, netMode, showInferredTypes);
    });
    updateHistory();
  }, [formValues.bindingsInput, getElementInfo, netMode, setElements, setFormValues, updateHistory, validateBindings, showInferredTypes]);

  const serializeBindingsFromElement = useCallback((elementType, element) => {
    if (elementType !== 'arc' || !Array.isArray(element.bindings)) return '';
    return element.bindings.map((binding) => {
      const text = String(binding || '');
      if (/^true$/i.test(text)) return 'T';
      if (/^false$/i.test(text)) return 'F';
      return capitalizeTypeNames(text);
    }).join(', ');
  }, []);

  return {
    handleWeightChange,
    handleBindingsBlur,
    serializeBindingsFromElement,
  };
};


