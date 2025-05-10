import React from 'react';
import { Circle, Text, Group } from 'react-konva';

const Place = ({ place, isSelected, onClick, onDragMove }) => {
  const radius = 20;
  
  return (
    <Group
      x={place.x}
      y={place.y}
      onClick={onClick}
      draggable={true}
      onDragMove={onDragMove}
    >
      {/* Place circle */}
      <Circle
        radius={radius}
        fill="white"
        stroke={isSelected ? 'blue' : 'black'}
        strokeWidth={isSelected ? 2 : 1}
      />
      
      {/* Place name */}
      <Text
        text={place.name}
        fontSize={12}
        fill="black"
        x={-radius}
        y={radius + 5}
        width={radius * 2}
        align="center"
      />
      
      {/* Token count */}
      <Text
        text={place.tokens.toString()}
        fontSize={14}
        fill="black"
        x={-radius}
        y={-7}
        width={radius * 2}
        align="center"
      />
      
      {/* Render tokens visually if there are any */}
      {place.tokens > 0 && place.tokens <= 5 && (
        <>
          {Array.from({ length: place.tokens }).map((_, index) => {
            // Position tokens in a circle or grid pattern
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
        </>
      )}
      
      {/* For more than 5 tokens, just show the number */}
      {place.tokens > 5 && (
        <Text
          text={place.tokens.toString()}
          fontSize={16}
          fontStyle="bold"
          fill="black"
          x={-radius}
          y={-9}
          width={radius * 2}
          align="center"
        />
      )}
    </Group>
  );
};

export default Place;
