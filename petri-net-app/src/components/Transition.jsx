import React from 'react';
import { Rect, Text, Group } from 'react-konva';
import { usePetriNet } from '../contexts/PetriNetContext';
import { useEditorUI } from '../contexts/EditorUIContext';
import { applyMultiDragDeltaFromSnapshot } from '../features/selection/selection-utils';

const GUARD_FONT_SIZE = 11;
const GUARD_CHAR_FACTOR = 0.48;
const GUARD_MAX_WIDTH = 160;
const GUARD_HORIZONTAL_PADDING = 6;

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

  // Access UI state from EditorUIContext
  const { 
    gridSnappingEnabled, 
    setSnapIndicator,
  } = useEditorUI();
  
  // Access core editor state from PetriNetContext
  const { 
    setIsDragging, 
    snapToGrid, 
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
        const snapshot = multiDragRef.current;
        return applyMultiDragDeltaFromSnapshot(prev, snapshot, { dx: deltaX, dy: deltaY }, { gridSnappingEnabled, snapToGrid });
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

  const guardText = netMode === 'algebraic-int' ? String(guard || '') : '';

  let guardWidth = baseWidth;
  let guardWrap = 'none';

  if (guardText) {
    const estimated = guardText.length * GUARD_FONT_SIZE * GUARD_CHAR_FACTOR + GUARD_HORIZONTAL_PADDING * 2;
    if (estimated <= GUARD_MAX_WIDTH) {
      guardWidth = Math.max(baseWidth, estimated);
    } else {
      guardWidth = GUARD_MAX_WIDTH;
      guardWrap = 'char';
    }
  }

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
      {netMode === 'algebraic-int' && guardText && (
        <Text
          text={guardText}
          fontSize={GUARD_FONT_SIZE}
          fill="gray"
          x={-guardWidth / 2}
          y={-baseHeight / 2 - 14}
          width={guardWidth}
          align="center"
          wrap={guardWrap}
          listening={false}
          ellipsis={guardWrap !== 'none'}
        />
      )}
      {netMode === 'algebraic-int' && !guardText && (
        <Text
          text=""
          fontSize={GUARD_FONT_SIZE}
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
