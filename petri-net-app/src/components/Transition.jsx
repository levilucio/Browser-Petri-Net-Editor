import React from 'react';
import { Rect, Text, Group } from 'react-konva';

const Transition = ({ transition, isSelected, onClick, onDragMove }) => {
  const width = 30;
  const height = 40;
  
  return (
    <Group
      x={transition.x}
      y={transition.y}
      onClick={onClick}
      draggable={true}
      onDragMove={onDragMove}
    >
      {/* Transition rectangle */}
      <Rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        fill="gray"
        stroke={isSelected ? 'blue' : 'black'}
        strokeWidth={isSelected ? 2 : 1}
      />
      
      {/* Transition name */}
      <Text
        text={transition.name}
        fontSize={12}
        fill="black"
        x={-width / 2}
        y={height / 2 + 5}
        width={width}
        align="center"
      />
    </Group>
  );
};

export default Transition;
