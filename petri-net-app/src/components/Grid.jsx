import React from 'react';
import { Line, Group, Rect } from 'react-konva';

const Grid = ({ width, height, gridSize }) => {
  const horizontalLines = [];
  const verticalLines = [];

  // Calculate how many lines we need
  const numHorizontalLines = Math.ceil(height / gridSize);
  const numVerticalLines = Math.ceil(width / gridSize);

  // Create horizontal grid lines
  for (let i = 0; i <= numHorizontalLines; i++) {
    const y = i * gridSize;
    horizontalLines.push(
      <Line
        key={`h-${i}`}
        points={[0, y, width, y]}
        stroke="#ddd"
        strokeWidth={i % 5 === 0 ? 0.5 : 0.2}
        perfectDrawEnabled={false}
        listening={false}
      />
    );
  }

  // Create vertical grid lines
  for (let i = 0; i <= numVerticalLines; i++) {
    const x = i * gridSize;
    verticalLines.push(
      <Line
        key={`v-${i}`}
        points={[x, 0, x, height]}
        stroke="#ddd"
        strokeWidth={i % 5 === 0 ? 0.5 : 0.2}
        perfectDrawEnabled={false}
        listening={false}
      />
    );
  }

  return (
    <Group listening={false} perfectDrawEnabled={false}>
      {horizontalLines}
      {verticalLines}
    </Group>
  );
};

export default Grid;
