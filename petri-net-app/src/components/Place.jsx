import React from 'react';
import { applyMultiDragDeltaFromSnapshot } from '../features/selection/selection-utils';
import { Circle, Text, Group } from 'react-konva';
import { usePetriNet } from '../contexts/PetriNetContext';
import { useEditorUI } from '../contexts/EditorUIContext';

const Place = ({
  id,
  x,
  y,
  label,
  tokens,
  valueTokens,
  isSelected,
  onSelect,
  onChange,
}) => {
  const radius = 30;

  // Access UI state from EditorUIContext
  const { 
    gridSnappingEnabled, 
    setSnapIndicator,
  } = useEditorUI();
  
  // Access core editor state from PetriNetContext
  const { 
    setIsDragging, 
    snapToGrid, 
    netMode,
    elements,
    selectedElements,
    setElements,
    multiDragRef,
    isIdSelected
  } = usePetriNet();
  
  const handleDragStart = () => {
    // Set dragging state to true when drag starts
    setIsDragging(true);
    // Initialize multi-drag if multiple nodes selected and this node is among them
    const isSelected = isIdSelected(id, 'place');
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
        elementType: 'place'
      });
      e.target.position({ x: snappedPos.x, y: snappedPos.y });
      currentPos = snappedPos;
    }

    // Apply multi-drag delta to other selected nodes and keep arcs attached visually
    if (multiDragRef.current && multiDragRef.current.startPositions && multiDragRef.current.baseId === id) {
      const start = multiDragRef.current.startPositions.get(id);
      if (!start) return;
      const deltaX = currentPos.x - start.x;
      const deltaY = currentPos.y - start.y;
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

  const renderTokens = () => {
    // If algebraic integer tokens provided, render them as scattered integers when they fit
    if (Array.isArray(valueTokens) && valueTokens.length > 0) {
      const maxScatter = 6;
      const count = valueTokens.length;
      const formatToken = (v) => {
        if (typeof v === 'boolean') return v ? 'T' : 'F';
        if (typeof v === 'string') return `'${v}'`;
        if (Array.isArray(v)) return `[${v.map(formatToken).join(', ')}]`;
        if (v && typeof v === 'object' && v.__pair__) return `(${formatToken(v.fst)}, ${formatToken(v.snd)})`;
        return String(v);
      };
      // Single algebraic integer: center it
      if (count === 1) {
        const text = formatToken(valueTokens[0]);
        return (
          <Text
            text={text}
            fontSize={14}
            fill="black"
            x={-radius}
            y={-7}
            width={radius * 2}
            align="center"
            listening={false}
          />
        );
      }
      if (count <= maxScatter) {
        // Arrange around inner circle at fixed positions for readability
        const innerR = radius - 12;
        return (
          <>
            {valueTokens.map((val, index) => {
              // Offset start angle so first token sits near top-left, matching screenshot layout better
              const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
              const tx = Math.cos(angle) * innerR;
              const ty = Math.sin(angle) * innerR;
              const fontSize = 12;
              const text = formatToken(val);
              const estWidth = Math.max(12, text.length * fontSize * 0.6);
              return (
                <Text
                  key={`ival-${index}`}
                  text={text}
                  fontSize={fontSize}
                  fill="black"
                  x={tx - estWidth / 2}
                  y={ty - fontSize / 2}
                  wrap="none"
                  listening={false}
                />
              );
            })}
          </>
        );
      }
      // Too many integers to display; show indicator
      return (
        <Text
          text={`(${valueTokens.length})`}
          fontSize={12}
          fill="black"
          x={-radius}
          y={-7}
          width={radius * 2}
          align="center"
          listening={false}
        />
      );
    }
    if (tokens === 0) {
      // For algebraic nets, show nothing when empty regardless of whether valueTokens is defined
      if (netMode === 'algebraic-int' || Array.isArray(valueTokens)) return null;
      return (
        <Text
          text="0"
          fontSize={14}
          fill="black"
          x={-radius}
          y={-7}
          width={radius * 2}
          align="center"
          listening={false}
        />
      );
    }

    if (tokens <= 5) {
      return (
        <>
          {Array.from({ length: tokens }).map((_, index) => {
            const angle = (2 * Math.PI * index) / tokens;
            const tokenRadius = 4;
            const distance = radius / 2;
            const tokenX = Math.cos(angle) * distance;
            const tokenY = Math.sin(angle) * distance;
            return (
              <Circle
                key={index}
                x={tokenX}
                y={tokenY}
                radius={tokenRadius}
                fill="black"
                listening={false}
              />
            );
          })}
          <Text
            text={tokens.toString()}
            fontSize={14}
            fill="black"
            x={-radius}
            y={-7}
            width={radius * 2}
            align="center"
            listening={false}
          />
        </>
      );
    }

    return (
      <Text
        text={tokens.toString()}
        fontSize={16}
        fill="black"
        x={-radius}
        y={-8}
        width={radius * 2}
        align="center"
        listening={false}
      />
    );
  };

  return (
    <Group
      x={x}
      y={y}
      draggable={true}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onClick={() => onSelect(id)}
      onTap={() => onSelect(id)}
      id={id} // Pass id for hit detection in ArcManager
      name='element' // Generic name for easier hit detection
      elementType='place' // Custom attribute for type-specific logic
    >
      <Circle
        radius={radius}
        fill="white"
        stroke={isSelected ? 'blue' : 'black'}
        strokeWidth={2}
      />
      <Text
        text={label}
        fontSize={12}
        fill="black"
        x={-radius}
        y={radius + 5}
        width={radius * 2}
        align="center"
        listening={false}
      />
      {renderTokens()}
    </Group>
  );
};

export default Place;
