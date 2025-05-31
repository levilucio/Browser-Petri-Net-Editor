import React from 'react';
import { Rect, Text, Group, Line } from 'react-konva';

const Transition = ({ transition, isSelected, isDragging, isEnabled, onClick, onDragStart, onDragMove, onDragEnd }) => {
  const width = 30;
  const height = 40;
  
  // Visual indicators for grid snapping
  const renderSnapIndicators = () => {
    if (!isDragging) return null;
    
    const indicatorLength = 10;
    const indicatorColor = 'rgba(0, 150, 255, 0.7)';
    const indicatorWidth = 1;
    
    return (
      <>
        {/* Horizontal indicator */}
        <Line
          points={[-width/2 - indicatorLength, 0, width/2 + indicatorLength, 0]}
          stroke={indicatorColor}
          strokeWidth={indicatorWidth}
          dash={[4, 2]}
        />
        {/* Vertical indicator */}
        <Line
          points={[0, -height/2 - indicatorLength, 0, height/2 + indicatorLength]}
          stroke={indicatorColor}
          strokeWidth={indicatorWidth}
          dash={[4, 2]}
        />
      </>
    );
  };
  
  return (
    <Group
      x={transition.x}
      y={transition.y}
      onClick={onClick}
      draggable={true}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      {/* Grid snap indicators */}
      {renderSnapIndicators()}
      
      {/* Transition rectangle */}
      <Rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        fill={isEnabled ? 'rgba(255, 255, 0, 0.8)' : 'gray'}
        stroke={isSelected ? 'blue' : (isDragging ? 'rgba(0, 150, 255, 0.7)' : (isEnabled ? 'rgba(255, 180, 0, 1)' : 'black'))}
        strokeWidth={isSelected || isDragging ? 2 : (isEnabled ? 3 : 1)}
      />
      
      {/* Transition label */}
      <Text
        text={transition.label}
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
