import React from 'react';
import { Line, Group, Rect } from 'react-konva';

const Grid = ({ width, height, gridSize, scrollX = 0, scrollY = 0 }) => {
  const horizontalLines = [];
  const verticalLines = [];
  
  // Calculate how many lines we need
  const numHorizontalLines = Math.ceil(height / gridSize) + 1;
  const numVerticalLines = Math.ceil(width / gridSize) + 1;
  
  // Calculate the starting point for the grid based on scroll position
  const startX = Math.floor(scrollX / gridSize) * gridSize - scrollX;
  const startY = Math.floor(scrollY / gridSize) * gridSize - scrollY;
  
  // Create horizontal grid lines
  for (let i = 0; i < numHorizontalLines; i++) {
    const y = startY + (i * gridSize);
    horizontalLines.push(
      <Line
        key={`h-${i}`}
        points={[0, y, width, y]}
        stroke="#ddd"
        strokeWidth={Math.floor((startY + i * gridSize + scrollY) / gridSize) % 5 === 0 ? 0.5 : 0.2}
        perfectDrawEnabled={false}
        listening={false}
      />
    );
  }

  // Create vertical grid lines
  for (let i = 0; i < numVerticalLines; i++) {
    const x = startX + (i * gridSize);
    verticalLines.push(
      <Line
        key={`v-${i}`}
        points={[x, 0, x, height]}
        stroke="#ddd"
        strokeWidth={Math.floor((startX + i * gridSize + scrollX) / gridSize) % 5 === 0 ? 0.5 : 0.2}
        perfectDrawEnabled={false}
        listening={false}
      />
    );
  }

  return (
    <Group>
      {/* Background fill for the grid */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#f9f9f9"
        perfectDrawEnabled={false}
        listening={false}
      />
      {horizontalLines}
      {verticalLines}
    </Group>
  );
};

export default Grid;
