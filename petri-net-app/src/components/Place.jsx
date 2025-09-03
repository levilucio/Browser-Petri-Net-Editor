import React from 'react';
import { Circle, Text, Group } from 'react-konva';
import { usePetriNet } from '../contexts/PetriNetContext';

const Place = ({
  id,
  x,
  y,
  label,
  tokens,
  valueTokens,
  isSelected,
  onSelect,
  onChange,
}) => {
  const radius = 30;

  // Access the context states
  const { 
    setIsDragging, 
    gridSnappingEnabled, 
    snapToGrid, 
    setSnapIndicator 
  } = usePetriNet();
  
  const handleDragStart = () => {
    // Set dragging state to true when drag starts
    setIsDragging(true);
  };

  const handleDragMove = (e) => {
    // Only apply snapping if grid snapping is enabled
    if (gridSnappingEnabled) {
      const currentPos = {
        x: e.target.x(),
        y: e.target.y()
      };
      
      // Calculate where this would snap to
      const snappedPos = snapToGrid(currentPos.x, currentPos.y);
      
      // Update the snap indicator position
      setSnapIndicator({
        visible: true,
        position: snappedPos,
        elementType: 'place'
      });
      
      // Force the element to snap to grid during drag
      e.target.position({
        x: snappedPos.x,
        y: snappedPos.y
      });
    }
  };

  const handleDragEnd = (e) => {
    // When drag ends, the new position is in the parent's coordinate system (virtual coordinates)
    const newVirtualPos = {
      x: e.target.x(),
      y: e.target.y(),
    };
    
    // Set dragging state to false when drag ends
    setIsDragging(false);
    
    // Hide the snap indicator
    setSnapIndicator({
      visible: false,
      position: null,
      elementType: null
    });
    
    // The onChange handler (from useElementManager) expects the new virtual position
    onChange(newVirtualPos);
  };

  const renderTokens = () => {
    // If algebraic integer tokens provided, render them as scattered integers when they fit
    if (Array.isArray(valueTokens) && valueTokens.length > 0) {
      const maxScatter = 6;
      if (valueTokens.length <= maxScatter) {
        // Arrange around inner circle at fixed positions for readability
        const count = valueTokens.length;
        const innerR = radius - 12;
        return (
          <>
            {valueTokens.map((val, index) => {
              // Offset start angle so first token sits near top-left, matching screenshot layout better
              const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
              const tx = Math.cos(angle) * innerR;
              const ty = Math.sin(angle) * innerR;
              const fontSize = 12;
              const text = String(val);
              const estWidth = Math.max(12, text.length * fontSize * 0.6);
              return (
                <Text
                  key={`ival-${index}`}
                  text={text}
                  fontSize={fontSize}
                  fill="black"
                  x={tx - estWidth / 2}
                  y={ty - fontSize / 2}
                  wrap="none"
                  listening={false}
                />
              );
            })}
          </>
        );
      }
      // Too many integers to display; show indicator
      return (
        <Text
          text={`(${valueTokens.length})`}
          fontSize={12}
          fill="black"
          x={-radius}
          y={-7}
          width={radius * 2}
          align="center"
          listening={false}
        />
      );
    }
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
      onDragMove={handleDragMove}
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
