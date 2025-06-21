import React from 'react';
import { Rect, Text, Group } from 'react-konva';
import { usePetriNet } from '../contexts/PetriNetContext';

const Transition = ({
  id,
  x,
  y,
  label,
  isSelected,
  isEnabled,
  onSelect,
  onChange,
}) => {
  const baseWidth = 40;
  const baseHeight = 50;

  // Access the isDragging state from context
  const { setIsDragging } = usePetriNet();
  
  const handleDragStart = () => {
    // Set dragging state to true when drag starts
    setIsDragging(true);
  };

  const handleDragEnd = (e) => {
    // When drag ends, the new position is in the parent's coordinate system (virtual coordinates)
    const newVirtualPos = {
      x: e.target.x(),
      y: e.target.y(),
    };
    // Set dragging state to false when drag ends
    setIsDragging(false);
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
    </Group>
  );
};

export default Transition;
