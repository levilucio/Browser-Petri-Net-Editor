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
    netMode
  } = usePetriNet();
  // netMode provided by context
  
  const handleDragStart = () => {
    // Set dragging state to true when drag starts
    setIsDragging(true);
  };

  const handleDragMove = (e) => {
    // Only apply snapping if grid snapping is enabled
    if (gridSnappingEnabled) {
      const currentPos = {
        x: e.target.x(),
        y: e.target.y()
      };
      
      // Calculate where this would snap to
      const snappedPos = snapToGrid(currentPos.x, currentPos.y);
      
      // Update the snap indicator position
      setSnapIndicator({
        visible: true,
        position: snappedPos,
        elementType: 'transition'
      });
      
      // Force the element to snap to grid during drag
      e.target.position({
        x: snappedPos.x,
        y: snappedPos.y
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
  };

  return (
    <Group
      x={x}
      y={y}
      onClick={onSelect}
      onTap={onSelect}
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
