import { useCallback } from 'react';

export const useElementLabelHandler = ({ getElementInfo, setElements, updateHistory, setFormValues }) => {
  return useCallback((event) => {
    const newLabel = event.target.value;
    setFormValues((prev) => ({ ...prev, label: newLabel }));

    const { elementId, elementType } = getElementInfo();

    if (elementType === 'place') {
      setElements((prev) => ({
        ...prev,
        places: prev.places.map((place) => (place.id === elementId ? { ...place, label: newLabel } : place)),
      }));
    } else if (elementType === 'transition') {
      setElements((prev) => ({
        ...prev,
        transitions: prev.transitions.map((transition) => (transition.id === elementId ? { ...transition, label: newLabel } : transition)),
      }));
    } else if (elementType === 'arc') {
      setElements((prev) => ({
        ...prev,
        arcs: prev.arcs.map((arc) => (arc.id === elementId ? { ...arc, label: newLabel } : arc)),
      }));
    }

    updateHistory();
  }, [getElementInfo, setElements, updateHistory, setFormValues]);
};


