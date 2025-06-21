import React from 'react';
import { Circle, Text, Group } from 'react-konva';
import { usePetriNet } from '../contexts/PetriNetContext';

const Place = ({
  id,
  x,
  y,
  label,
  tokens,
  isSelected,
  onSelect,
  onChange,
}) => {
  const radius = 30;

  // Access the isDragging state from context
  const { setIsDragging } = usePetriNet();
  
  const handleDragStart = () => {
    // Set dragging state to true when drag starts
    setIsDragging(true);
  };

  const handleDragEnd = (e) => {
    // When drag ends, the new position is in the parent's coordinate system (virtual coordinates)
    const newVirtualPos = {
      x: e.target.x(),
      y: e.target.y(),
    };
    // Set dragging state to false when drag ends
    setIsDragging(false);
    // The onChange handler (from useElementManager) expects the new virtual position
    onChange(newVirtualPos);
  };

  const renderTokens = () => {
    if (tokens === 0) {
      return (
        <Text
          text="0"
          fontSize={14}
          fill="black"
          x={-radius}
          y={-7}
          width={radius * 2}
          align="center"
          listening={false}
        />
      );
    }

    if (tokens <= 5) {
      return (
        <>
          {Array.from({ length: tokens }).map((_, index) => {
            const angle = (2 * Math.PI * index) / tokens;
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
                listening={false}
              />
            );
          })}
          <Text
            text={tokens.toString()}
            fontSize={14}
            fill="black"
            x={-radius}
            y={-7}
            width={radius * 2}
            align="center"
            listening={false}
          />
        </>
      );
    }

    return (
      <Text
        text={tokens.toString()}
        fontSize={16}
        fill="black"
        x={-radius}
        y={-8}
        width={radius * 2}
        align="center"
        listening={false}
      />
    );
  };

  return (
    <Group
      x={x}
      y={y}
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onSelect(id)}
      onTap={() => onSelect(id)}
      id={id} // Pass id for hit detection in ArcManager
      name='element' // Generic name for easier hit detection
      elementType='place' // Custom attribute for type-specific logic
    >
      <Circle
        radius={radius}
        fill="white"
        stroke={isSelected ? 'blue' : 'black'}
        strokeWidth={2}
      />
      <Text
        text={label}
        fontSize={12}
        fill="black"
        x={-radius}
        y={radius + 5}
        width={radius * 2}
        align="center"
        listening={false}
      />
      {renderTokens()}
    </Group>
  );
};

export default Place;
