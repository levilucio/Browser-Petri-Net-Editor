import { useState, useEffect, useCallback } from 'react';
import { useValueTokensInput } from './useValueTokensInput';
import { useBindingsInput } from './useBindingsInput';
import { useElementLabelHandler } from './properties/useElementLabelHandler';
import { usePlaceFormHandlers } from './properties/usePlaceFormHandlers';
import { useArcFormHandlers } from './properties/useArcFormHandlers';
import { useTransitionFormHandlers } from './properties/useTransitionFormHandlers';
import { useTypeInferenceHandlers } from './properties/useTypeInferenceHandlers';

/**
 * Hook to manage form state and handlers for the Properties Panel
 * Extracted from PropertiesPanel.jsx to reduce complexity
 */
export function usePropertiesForm({ selectedElement, elements, setElements, updateHistory, netMode, showInferredTypes = true }) {
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
  const {
    handleTokensChange,
    handleValueTokensBlur,
    serializeTokensFromElement,
  } = usePlaceFormHandlers({
    formValues,
    setFormValues,
    getElementInfo,
    setElements,
    updateHistory,
    netMode,
    parseValueTokensInput,
    showInferredTypes,
  });

  const {
    handleWeightChange,
    handleBindingsBlur,
    serializeBindingsFromElement,
  } = useArcFormHandlers({
    formValues,
    setFormValues,
    getElementInfo,
    setElements,
    updateHistory,
    netMode,
    validateBindings,
    showInferredTypes,
  });

  const { handleGuardBlur } = useTransitionFormHandlers({
    formValues,
    setFormValues,
    getElementInfo,
    setElements,
    updateHistory,
    netMode,
    showInferredTypes,
  });

  const handleLabelChange = useElementLabelHandler({
    getElementInfo,
    setElements,
    updateHistory,
    setFormValues,
  });

  const { inferTypesForPlace, performGlobalTypeInference } = useTypeInferenceHandlers({
    elements,
    netMode,
    setElements,
    updateHistory,
    showInferredTypes,
  });

  useEffect(() => {
    if (!selectedElement) return;

    const { elementType } = getElementInfo();
    const guardText = elementType === 'transition'
      ? String(selectedElement.guard || '').replace(/\btrue\b/gi, 'T').replace(/\bfalse\b/gi, 'F')
      : '';

    setFormValues((prev) => ({
      ...prev,
      label: selectedElement.label || '',
      tokens: selectedElement.tokens || 0,
      weight: selectedElement.weight !== undefined ? selectedElement.weight : 1,
      valueTokensInput: serializeTokensFromElement(selectedElement),
      bindingsInput: serializeBindingsFromElement(elementType, selectedElement),
      guardText,
    }));
  }, [selectedElement, getElementInfo, serializeTokensFromElement, serializeBindingsFromElement, setFormValues]);

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

