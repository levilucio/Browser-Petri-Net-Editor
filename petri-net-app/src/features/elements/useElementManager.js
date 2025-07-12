import { useCallback } from 'react';
import { usePetriNet } from '../../contexts/PetriNetContext';
import { v4 as uuidv4 } from 'uuid';
import { useArcManager } from '../arcs/useArcManager';

export const useElementManager = () => {
  const { 
    elements, setElements, 
    selectedElement, setSelectedElement, 
    mode,
    arcStart, setArcStart, 
    tempArcEnd, setTempArcEnd, 
    snapToGrid, gridSnappingEnabled,
  } = usePetriNet();

  const { handleCompleteArc } = useArcManager();

  const handleDeleteElement = useCallback(() => {
    if (!selectedElement) return;

    const { type, id } = selectedElement;
    let newElementsState = JSON.parse(JSON.stringify(elements));

    if (type === 'place') {
      newElementsState.places = newElementsState.places.filter(p => p.id !== id);
      newElementsState.arcs = newElementsState.arcs.filter(arc => arc.source !== id && arc.target !== id);
    } else if (type === 'transition') {
      newElementsState.transitions = newElementsState.transitions.filter(t => t.id !== id);
      newElementsState.arcs = newElementsState.arcs.filter(arc => arc.source !== id && arc.target !== id);
    } else if (type === 'arc') {
      newElementsState.arcs = newElementsState.arcs.filter(a => a.id !== id);
    }

    setElements(newElementsState);
    setSelectedElement(null);
  }, [selectedElement, elements, setElements, setSelectedElement]);

  const clearAllElements = useCallback(() => {
    const clearedElements = { places: [], transitions: [], arcs: [] };
    setElements(clearedElements);
    setSelectedElement(null);
    setArcStart(null);
    setTempArcEnd(null);
  }, [setElements, setSelectedElement, setArcStart, setTempArcEnd]);

  const handleCreateElement = useCallback((position) => {
    if (!position) return;

    let pos = gridSnappingEnabled ? snapToGrid(position.x, position.y) : position;

    if (mode === 'place') {
      const placesCount = elements?.places?.length || 0;
      const newPlace = { id: uuidv4(), x: pos.x, y: pos.y, label: `P${placesCount + 1}`, tokens: 0 };
      setElements(prev => ({ ...prev, places: [...(prev?.places || []), newPlace] }));
    } else if (mode === 'transition') {
      const transitionsCount = elements?.transitions?.length || 0;
      const newTransition = { id: uuidv4(), x: pos.x, y: pos.y, label: `T${transitionsCount + 1}` };
      setElements(prev => ({ ...prev, transitions: [...(prev?.transitions || []), newTransition] }));
    }
  }, [mode, elements?.places?.length, elements?.transitions?.length, setElements, snapToGrid, gridSnappingEnabled]);

  const handleElementClick = useCallback((element, type) => {
    if (mode === 'select' || mode === 'arc_angle') {
      setSelectedElement({ ...element, type });
      setArcStart(null);
      setTempArcEnd(null);
    } else if (mode === 'arc') {
      if (!arcStart) {
        setSelectedElement({ ...element, type });
        setArcStart({ element: {id: element.id, type}, point: { x: element.x, y: element.y } });
        setTempArcEnd({ sourcePoint: { x: element.x, y: element.y }, x: element.x, y: element.y, potentialTarget: null });
      } else {
        handleCompleteArc(arcStart.element, { ...element, type });
      }
    }
  }, [mode, arcStart, setSelectedElement, setArcStart, setTempArcEnd, handleCompleteArc]);

  const handleElementDragEnd = useCallback((elementData, type, newPosition) => {
    // Apply grid snapping if enabled
    const snappedPosition = gridSnappingEnabled ? snapToGrid(newPosition.x, newPosition.y) : newPosition;
    
    setElements(prev => {
      const updatedElements = { ...prev };
      if (type === 'place') {
        updatedElements.places = prev.places.map(p => 
          p.id === elementData.id ? { ...p, x: snappedPosition.x, y: snappedPosition.y } : p
        );
      } else if (type === 'transition') {
        updatedElements.transitions = prev.transitions.map(t => 
          t.id === elementData.id ? { ...t, x: snappedPosition.x, y: snappedPosition.y } : t
        );
      }
      return updatedElements;
    });
  }, [setElements, gridSnappingEnabled, snapToGrid]);

  return {
    handleDeleteElement,
    clearAllElements,
    handleCreateElement,
    handleElementClick,
    handleElementDragEnd,
  };
};