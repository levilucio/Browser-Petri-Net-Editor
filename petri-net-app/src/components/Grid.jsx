import React from 'react';
import { Line, Group } from 'react-konva';

const Grid = ({ width, height, gridSize }) => {
  const horizontalLines = [];
  const verticalLines = [];

  // Create horizontal grid lines
  for (let i = 0; i <= height; i += gridSize) {
    horizontalLines.push(
      <Line
        key={`h-${i}`}
        points={[0, i, width, i]}
        stroke="#ddd"
        strokeWidth={i % (gridSize * 5) === 0 ? 0.5 : 0.2}
      />
    );
  }

  // Create vertical grid lines
  for (let i = 0; i <= width; i += gridSize) {
    verticalLines.push(
      <Line
        key={`v-${i}`}
        points={[i, 0, i, height]}
        stroke="#ddd"
        strokeWidth={i % (gridSize * 5) === 0 ? 0.5 : 0.2}
      />
    );
  }

  return (
    <Group>
      {horizontalLines}
      {verticalLines}
    </Group>
  );
};

export default Grid;
