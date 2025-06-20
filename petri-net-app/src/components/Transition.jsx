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
  zoomLevel,
  canvasScroll,
}) => {
  const baseWidth = 40;
  const baseHeight = 50;

  // A guard to prevent rendering if essential props are not available yet.
  if (canvasScroll === undefined || zoomLevel === undefined) {
    return null;
  }

  // Transform virtual coordinates to stage coordinates
  const stageX = (x - canvasScroll.x) / zoomLevel;
  const stageY = (y - canvasScroll.y) / zoomLevel;

  // Scale dimensions based on zoom level
  const scaledWidth = baseWidth / zoomLevel;
  const scaledHeight = baseHeight / zoomLevel;

  // Access the isDragging state from context
  const { isDragging, setIsDragging } = usePetriNet();
  
  const handleDragStart = () => {
    // Set dragging state to true when drag starts
    setIsDragging(true);
  };

  const handleDragEnd = (e) => {
    // When drag ends, transform stage coordinates back to virtual coordinates
    const newVirtualPos = {
      x: (e.target.x() * zoomLevel) + canvasScroll.x,
      y: (e.target.y() * zoomLevel) + canvasScroll.y,
    };
    // Set dragging state to false when drag ends
    setIsDragging(false);
    // The onChange handler (from useElementManager) expects the new virtual position
    onChange(newVirtualPos);
  };

  return (
    <Group
      x={stageX}
      y={stageY}
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
        x={-scaledWidth / 2}
        y={-scaledHeight / 2}
        width={scaledWidth}
        height={scaledHeight}
        fill={isEnabled ? 'rgba(255, 255, 0, 0.8)' : 'gray'}
        stroke={isSelected ? 'blue' : (isEnabled ? 'rgba(255, 180, 0, 1)' : 'black')}
        strokeWidth={(isSelected ? 3 : (isEnabled ? 3 : 2)) / zoomLevel}
      />
      <Text
        text={label}
        fontSize={14 / zoomLevel}
        fill="black"
        x={-scaledWidth / 2}
        y={(scaledHeight / 2) + (5 / zoomLevel)}
        width={scaledWidth}
        align="center"
        listening={false}
      />
    </Group>
  );
};

export default Transition;
