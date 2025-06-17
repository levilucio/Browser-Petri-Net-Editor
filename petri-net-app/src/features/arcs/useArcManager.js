import { useCallback } from 'react';
import { usePetriNet } from '../../contexts/PetriNetContext';
import { v4 as uuidv4 } from 'uuid';

export const useArcManager = () => {
  const {
    elements, setElements,
    arcStart, setArcStart,
    setTempArcEnd,
    setSelectedElement,
    snapToGrid, gridSnappingEnabled,
  } = usePetriNet();

  const handleCompleteArc = useCallback((sourceElement, targetElement) => {
    if (sourceElement.id === targetElement.id) return;

    if (sourceElement.type === targetElement.type) {
      console.warn("Invalid arc: Cannot connect elements of the same type.");
      setArcStart(null);
      setTempArcEnd(null);
      setSelectedElement(null);
      return;
    }

    const newArc = {
      id: uuidv4(),
      source: sourceElement.id,
      target: targetElement.id,
      weight: 1,
      anglePoints: [],
      sourceType: sourceElement.type,
      targetType: targetElement.type,
    };

    setElements(prev => ({ ...prev, arcs: [...prev.arcs, newArc] }));
    setArcStart(null);
    setTempArcEnd(null);
    setSelectedElement(null);
  }, [setElements, setArcStart, setTempArcEnd, setSelectedElement]);

  const handleAddAnglePoint = useCallback((arcId, anglePoint) => {
    setElements(prev => {
      const updatedArcs = prev.arcs.map(arc => {
        if (arc.id === arcId) {
          const point = gridSnappingEnabled ? snapToGrid(anglePoint.x, anglePoint.y) : anglePoint;
          const anglePoints = arc.anglePoints ? [...arc.anglePoints] : [];
          anglePoints.push(point);
          return { ...arc, anglePoints };
        }
        return arc;
      });
      return { ...prev, arcs: updatedArcs };
    });
  }, [setElements, gridSnappingEnabled, snapToGrid]);

  const handleDragAnglePoint = useCallback((arcId, pointIndex, newPosition) => {
    setElements(prev => {
      const updatedArcs = prev.arcs.map(arc => {
        if (arc.id === arcId && arc.anglePoints && arc.anglePoints[pointIndex]) {
          const position = gridSnappingEnabled ? snapToGrid(newPosition.x, newPosition.y) : newPosition;
          const anglePoints = [...arc.anglePoints];
          anglePoints[pointIndex] = position;
          return { ...arc, anglePoints };
        }
        return arc;
      });
      return { ...prev, arcs: updatedArcs };
    });
  }, [setElements, gridSnappingEnabled, snapToGrid]);

  const handleDeleteAnglePoint = useCallback((arcId, pointIndex) => {
    setElements(prev => {
      const updatedArcs = prev.arcs.map(arc => {
        if (arc.id === arcId && arc.anglePoints && arc.anglePoints[pointIndex]) {
          const anglePoints = [...arc.anglePoints];
          anglePoints.splice(pointIndex, 1);
          return { ...arc, anglePoints };
        }
        return arc;
      });
      return { ...prev, arcs: updatedArcs };
    });
  }, [setElements]);

  return {
    handleCompleteArc,
    handleAddAnglePoint,
    handleDragAnglePoint,
    handleDeleteAnglePoint,
  };
};