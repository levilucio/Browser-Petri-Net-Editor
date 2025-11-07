import { useCallback } from 'react';
import { formatTokensList } from '../../../utils/token-format';
import { computeGlobalTypeInferenceForState } from '../useGlobalTypeInference';

export const usePlaceFormHandlers = ({
  formValues,
  setFormValues,
  getElementInfo,
  setElements,
  updateHistory,
  netMode,
  parseValueTokensInput,
}) => {
  const handleTokensChange = useCallback((event) => {
    let newTokens = parseInt(event.target.value, 10);
    if (!Number.isFinite(newTokens)) newTokens = 0;
    if (newTokens < 0) newTokens = 0;
    setFormValues((prev) => ({ ...prev, tokens: newTokens }));

    const { elementId } = getElementInfo();
    setElements((prev) => ({
      ...prev,
      places: prev.places.map((place) => (place.id === elementId ? { ...place, tokens: newTokens } : place)),
    }));
    updateHistory();
  }, [getElementInfo, setElements, updateHistory, setFormValues]);

  const handleValueTokensBlur = useCallback(() => {
    const input = formValues.valueTokensInput.trim();
    const { elementId } = getElementInfo();

    if (!input) {
      setElements((prev) => ({
        ...prev,
        places: prev.places.map((place) => (place.id === elementId ? { ...place, valueTokens: [], tokens: 0 } : place)),
      }));
      updateHistory();
      return;
    }

    const parsed = parseValueTokensInput(input);
    setElements((prev) => {
      const nextState = {
        ...prev,
        places: prev.places.map((place) => (place.id === elementId
          ? { ...place, valueTokens: parsed, tokens: parsed.length }
          : place)),
      };
      return computeGlobalTypeInferenceForState(nextState, netMode);
    });
    updateHistory();
  }, [formValues.valueTokensInput, getElementInfo, netMode, parseValueTokensInput, setElements, updateHistory]);

  const serializeTokensFromElement = useCallback((element) => (
    Array.isArray(element.valueTokens) ? formatTokensList(element.valueTokens) : ''
  ), []);

  return {
    handleTokensChange,
    handleValueTokensBlur,
    serializeTokensFromElement,
  };
};


