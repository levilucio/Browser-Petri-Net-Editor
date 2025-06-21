import React from 'react';
import { Circle, Rect } from 'react-konva';

/**
 * Visual indicator that shows where an element will snap to on the grid
 */
const SnapIndicator = ({ position, visible, elementType }) => {
  if (!visible || !position) return null;

  // Different visual indicators based on element type
  if (elementType === 'place') {
    return (
      <Circle
        x={position.x}
        y={position.y}
        radius={5}
        fill="rgba(0, 120, 255, 0.5)"
        stroke="rgba(0, 120, 255, 0.8)"
        strokeWidth={1}
        perfectDrawEnabled={false}
        listening={false}
      />
    );
  } else if (elementType === 'transition') {
    return (
      <Rect
        x={position.x - 5}
        y={position.y - 5}
        width={10}
        height={10}
        fill="rgba(0, 120, 255, 0.5)"
        stroke="rgba(0, 120, 255, 0.8)"
        strokeWidth={1}
        perfectDrawEnabled={false}
        listening={false}
      />
    );
  }
  
  // Default indicator (generic)
  return (
    <Circle
      x={position.x}
      y={position.y}
      radius={5}
      fill="rgba(0, 120, 255, 0.5)"
      stroke="rgba(0, 120, 255, 0.8)"
      strokeWidth={1}
      perfectDrawEnabled={false}
      listening={false}
    />
  );
};

export default SnapIndicator;
