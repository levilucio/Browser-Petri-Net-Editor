import React from 'react';
import { Circle, Text, Group, Line } from 'react-konva';

const Place = ({ place, isSelected, isDragging, onClick, onDragStart, onDragMove, onDragEnd }) => {
  const radius = 20;
  
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
          points={[-radius - indicatorLength, 0, radius + indicatorLength, 0]}
          stroke={indicatorColor}
          strokeWidth={indicatorWidth}
          dash={[4, 2]}
        />
        {/* Vertical indicator */}
        <Line
          points={[0, -radius - indicatorLength, 0, radius + indicatorLength]}
          stroke={indicatorColor}
          strokeWidth={indicatorWidth}
          dash={[4, 2]}
        />
      </>
    );
  };
  
  // Render token visualization based on token count
  const renderTokens = () => {
    // For 0 tokens, just show "0"
    if (place.tokens === 0) {
      return (
        <Text
          text="0"
          fontSize={14}
          fill="black"
          x={-radius}
          y={-7}
          width={radius * 2}
          align="center"
        />
      );
    }
    
    // For 1-5 tokens, show visual circles and the count
    if (place.tokens <= 5) {
      return (
        <>
          {/* Visual representation of tokens as circles */}
          {Array.from({ length: place.tokens }).map((_, index) => {
            // Position tokens in a circle pattern
            const angle = (2 * Math.PI * index) / place.tokens;
            const tokenRadius = 4;
            const distance = radius / 2;
            const tokenX = Math.cos(angle) * distance;
            const tokenY = Math.sin(angle) * distance;
            
            return (
              <Circle
                key={index}
                x={tokenX}
                y={tokenY}
                radius={tokenRadius}
                fill="black"
              />
            );
          })}
          
          {/* Small token count text */}
          <Text
            text={place.tokens.toString()}
            fontSize={14}
            fill="black"
            x={-radius}
            y={-7}
            width={radius * 2}
            align="center"
          />
        </>
      );
    }
    
    // For more than 5 tokens, just show the number
    return (
      <Text
        text={place.tokens.toString()}
        fontSize={16}
        fill="black"
        x={-radius}
        y={-7}
        width={radius * 2}
        align="center"
      />
    );
  };
  
  return (
    <Group
      x={place.x}
      y={place.y}
      onClick={onClick}
      draggable={true}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      {/* Grid snap indicators */}
      {renderSnapIndicators()}
      
      {/* Place circle */}
      <Circle
        radius={radius}
        fill="white"
        stroke={isSelected ? 'blue' : (isDragging ? 'rgba(0, 150, 255, 0.7)' : 'black')}
        strokeWidth={isSelected || isDragging ? 2 : 1}
      />
      
      {/* Place label */}
      <Text
        text={place.label}
        fontSize={12}
        fill="black"
        x={-radius}
        y={radius + 5}
        width={radius * 2}
        align="center"
      />
      
      {/* Render tokens based on count */}
      {renderTokens()}
    </Group>
  );
};

export default Place;
