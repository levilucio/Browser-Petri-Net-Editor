import React from 'react';
import { Rect, Text, Group } from 'react-konva';
import { usePetriNet } from '../contexts/PetriNetContext';

const Transition = ({
  id,
  x,
  y,
  label,
  guard,
  isSelected,
  isEnabled,
  onSelect,
  onChange,
}) => {
  const baseWidth = 40;
  const baseHeight = 50;

  // Access the context states
  const { 
    setIsDragging, 
    gridSnappingEnabled, 
    snapToGrid, 
    setSnapIndicator,
    simulationSettings,
    netMode,
    elements,
    selectedElements,
    setElements,
    multiDragRef,
    isIdSelected
  } = usePetriNet();
  // netMode provided by context
  
  const handleDragStart = () => {
    // Set dragging state to true when drag starts
    setIsDragging(true);
    const isSelected = isIdSelected(id, 'transition');
    if (isSelected) {
      const selectedNodeIds = new Set(selectedElements.filter(se => se.type === 'place' || se.type === 'transition').map(se => se.id));
      const startPositions = new Map();
      elements.places.forEach(p => { if (selectedNodeIds.has(p.id)) startPositions.set(p.id, { type: 'place', x: p.x, y: p.y }); });
      elements.transitions.forEach(t => { if (selectedNodeIds.has(t.id)) startPositions.set(t.id, { type: 'transition', x: t.x, y: t.y }); });
      const startArcPoints = new Map();
      elements.arcs.forEach(a => {
        if (selectedNodeIds.has(a.source) && selectedNodeIds.has(a.target)) {
          const pts = Array.isArray(a.anglePoints) ? a.anglePoints.map(p => ({ x: p.x, y: p.y })) : [];
          startArcPoints.set(a.id, pts);
        }
      });
      multiDragRef.current = { baseId: id, startPositions, startArcPoints };
    } else {
      multiDragRef.current = null;
    }
  };

  const handleDragMove = (e) => {
    // Only apply snapping if grid snapping is enabled
    let currentPos = {
      x: e.target.x(),
      y: e.target.y()
    };
    if (gridSnappingEnabled) {
      const snappedPos = snapToGrid(currentPos.x, currentPos.y);
      setSnapIndicator({
        visible: true,
        position: snappedPos,
        elementType: 'transition'
      });
      e.target.position({ x: snappedPos.x, y: snappedPos.y });
      currentPos = snappedPos;
    }
    if (multiDragRef.current && multiDragRef.current.startPositions && multiDragRef.current.baseId === id) {
      const start = multiDragRef.current.startPositions.get(id);
      if (!start) return;
      const deltaX = currentPos.x - start.x;
      const deltaY = currentPos.y - start.y;
      // Batch updates during drag to avoid excessive renders
      setElements(prev => {
        if (!multiDragRef.current || !multiDragRef.current.startPositions) return prev;
        const next = { ...prev };
        next.places = prev.places.map(p => {
          const s = multiDragRef.current.startPositions.get(p.id);
          if (s) {
            const pos = gridSnappingEnabled ? snapToGrid(s.x + deltaX, s.y + deltaY) : { x: s.x + deltaX, y: s.y + deltaY };
            return { ...p, x: pos.x, y: pos.y };
          }
          return p;
        });
        next.transitions = prev.transitions.map(t => {
          const s = multiDragRef.current.startPositions.get(t.id);
          if (s) {
            const pos = gridSnappingEnabled ? snapToGrid(s.x + deltaX, s.y + deltaY) : { x: s.x + deltaX, y: s.y + deltaY };
            return { ...t, x: pos.x, y: pos.y };
          }
          return t;
        });
        if (multiDragRef.current.startArcPoints) {
          next.arcs = prev.arcs.map(a => {
            const pts = multiDragRef.current.startArcPoints.get(a.id);
            if (pts) {
              const movedPts = pts.map(p => ({ x: p.x + deltaX, y: p.y + deltaY }));
              return { ...a, anglePoints: movedPts };
            }
            return a;
          });
        }
        return next;
      });
    }
  };

  const handleDragEnd = (e) => {
    // When drag ends, the new position is in the parent's coordinate system (virtual coordinates)
    const newVirtualPos = {
      x: e.target.x(),
      y: e.target.y(),
    };
    
    // Set dragging state to false when drag ends
    setIsDragging(false);
    
    // Hide the snap indicator
    setSnapIndicator({
      visible: false,
      position: null,
      elementType: null
    });
    
    // The onChange handler (from useElementManager) expects the new virtual position
    onChange(newVirtualPos);
    multiDragRef.current = null;
  };

  return (
    <Group
      x={x}
      y={y}
      onClick={(evt) => onSelect(id, evt)}
      onTap={(evt) => onSelect(id, evt)}
      draggable
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      id={id} // Pass id for hit detection in ArcManager
      name='element' // Generic name for easier hit detection
      elementType='transition' // Custom attribute for type-specific logic
    >
      <Rect
        x={-baseWidth / 2}
        y={-baseHeight / 2}
        width={baseWidth}
        height={baseHeight}
        fill={isEnabled ? 'rgba(255, 255, 0, 0.8)' : 'gray'}
        stroke={isSelected ? 'blue' : (isEnabled ? 'rgba(255, 180, 0, 1)' : 'black')}
        strokeWidth={isSelected ? 3 : (isEnabled ? 3 : 2)}
      />
      <Text
        text={label}
        fontSize={14}
        fill="black"
        x={-baseWidth / 2}
        y={(baseHeight / 2) + 5}
        width={baseWidth}
        align="center"
        listening={false}
      />
      {netMode === 'algebraic-int' && (
        <Text
          text={String(guard || '')}
          fontSize={10}
          fill="gray"
          x={-baseWidth / 2}
          y={-baseHeight / 2 - 14}
          width={baseWidth}
          align="center"
          listening={false}
        />
      )}
    </Group>
  );
};

export default Transition;
