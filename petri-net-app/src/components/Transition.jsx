import React from 'react';
import { Rect, Text, Group } from 'react-konva';

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

  const handleDragEnd = (e) => {
    // When drag ends, transform stage coordinates back to virtual coordinates
    const newVirtualPos = {
      x: (e.target.x() * zoomLevel) + canvasScroll.x,
      y: (e.target.y() * zoomLevel) + canvasScroll.y,
    };
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
