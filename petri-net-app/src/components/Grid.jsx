import React from 'react';
import { Line, Group, Rect } from 'react-konva';

const Grid = ({ width, height, gridSize }) => {
  const horizontalLines = [];
  const verticalLines = [];

  // Ensure we start drawing from negative coordinates to cover any potential gaps
  const startX = -gridSize;
  const startY = -gridSize;
  
  // Add extra padding to ensure grid covers the entire visible area
  const paddedWidth = width + gridSize * 2;
  const paddedHeight = height + gridSize * 2;

  // Create horizontal grid lines
  for (let i = startY; i <= paddedHeight; i += gridSize) {
    horizontalLines.push(
      <Line
        key={`h-${i}`}
        points={[startX, i, paddedWidth, i]}
        stroke="#ddd"
        strokeWidth={i % (gridSize * 5) === 0 ? 0.5 : 0.2}
      />
    );
  }

  // Create vertical grid lines
  for (let i = startX; i <= paddedWidth; i += gridSize) {
    verticalLines.push(
      <Line
        key={`v-${i}`}
        points={[i, startY, i, paddedHeight]}
        stroke="#ddd"
        strokeWidth={i % (gridSize * 5) === 0 ? 0.5 : 0.2}
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
      />
      {horizontalLines}
      {verticalLines}
    </Group>
  );
};

export default Grid;
