import { useCallback } from 'react';
import { inferTokenType, autoAnnotateTypes } from '../../../utils/arith-parser';
import { computeGlobalTypeInferenceForState } from '../useGlobalTypeInference';

const isProd = () => process.env.NODE_ENV === 'production';

export const useTypeInferenceHandlers = ({ elements, netMode, setElements, updateHistory }) => {
  const inferTypesForPlace = useCallback((placeId) => {
    if (!elements?.places || !elements?.arcs || netMode !== 'algebraic-int') {
      if (!isProd()) {
        console.log('inferTypesForPlace: skipping type inference', { placeId, netMode });
      }
      return;
    }

    const place = elements.places.find((candidate) => candidate.id === placeId);
    if (!place || !place.valueTokens || place.valueTokens.length === 0) {
      if (!isProd()) {
        console.log('inferTypesForPlace: no tokens available for place', placeId);
      }
      return;
    }

    const tokenType = inferTokenType(place.valueTokens[place.valueTokens.length - 1]);
    const connectedArcs = elements.arcs.filter((arc) => arc.source === placeId);

    const updates = connectedArcs.reduce((acc, arc) => {
      if (!Array.isArray(arc.bindings) || arc.bindings.length === 0) {
        return acc;
      }

      const currentBinding = arc.bindings[0];
      if (!currentBinding || currentBinding.includes(':')) {
        return acc;
      }

      const variableNames = currentBinding.match(/\b[a-z][a-zA-Z0-9_]*\b/g);
      if (!variableNames) {
        return acc;
      }

      const typeMap = new Map();
      variableNames.forEach((name) => {
        if (!['true', 'false', 'and', 'or', 'not'].includes(name)) {
          typeMap.set(name, tokenType);
        }
      });

      if (typeMap.size === 0) {
        return acc;
      }

      const annotated = autoAnnotateTypes(currentBinding, typeMap);
      if (annotated !== currentBinding) {
        acc.push({ arcId: arc.id, newBinding: annotated });
      }

      return acc;
    }, []);

    if (updates.length === 0) {
      if (!isProd()) {
        console.log('inferTypesForPlace: no binding updates generated');
      }
      return;
    }

    setElements((prev) => ({
      ...prev,
      arcs: prev.arcs.map((arc) => {
        const update = updates.find((candidate) => candidate.arcId === arc.id);
        return update ? { ...arc, bindings: [update.newBinding] } : arc;
      }),
    }));
    updateHistory();
  }, [elements, netMode, setElements, updateHistory]);

  const performGlobalTypeInference = useCallback(() => {
    const updated = computeGlobalTypeInferenceForState(elements, netMode);
    if (updated !== elements) {
      setElements(updated);
      updateHistory();
    }
  }, [elements, netMode, setElements, updateHistory]);

  return {
    inferTypesForPlace,
    performGlobalTypeInference,
  };
};


