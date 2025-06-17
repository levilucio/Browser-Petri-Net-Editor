import React from 'react';
import { Circle, Text, Group } from 'react-konva';

const Place = ({
  id,
  x,
  y,
  label,
  tokens,
  isSelected,
  onSelect,
  onChange,
  zoomLevel,
  canvasScroll,
}) => {
  const radius = 30;

  // A guard to prevent rendering if essential props are not available yet.
  if (canvasScroll === undefined || zoomLevel === undefined) {
    return null;
  }

  // Transform virtual coordinates to stage coordinates
  const stageX = (x - canvasScroll.x) / zoomLevel;
  const stageY = (y - canvasScroll.y) / zoomLevel;

  const handleDragEnd = (e) => {
    // When drag ends, transform stage coordinates back to virtual coordinates
    const newVirtualPos = {
      x: (e.target.x() * zoomLevel) + canvasScroll.x,
      y: (e.target.y() * zoomLevel) + canvasScroll.y,
    };
    // The onChange handler (from useElementManager) expects the new virtual position
    onChange(newVirtualPos);
  };

  const renderTokens = () => {
    const scaledRadius = radius / zoomLevel;

    if (tokens === 0) {
      return (
        <Text
          text="0"
          fontSize={14 / zoomLevel}
          fill="black"
          x={-scaledRadius}
          y={-7 / zoomLevel}
          width={scaledRadius * 2}
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
            const tokenRadius = 4 / zoomLevel;
            const distance = (radius / 2) / zoomLevel;
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
            fontSize={14 / zoomLevel}
            fill="black"
            x={-scaledRadius}
            y={-7 / zoomLevel}
            width={scaledRadius * 2}
            align="center"
            listening={false}
          />
        </>
      );
    }

    return (
      <Text
        text={tokens.toString()}
        fontSize={16 / zoomLevel}
        fill="black"
        x={-scaledRadius}
        y={-8 / zoomLevel}
        width={scaledRadius * 2}
        align="center"
        listening={false}
      />
    );
  };

  return (
    <Group
      x={stageX}
      y={stageY}
      onClick={onSelect}
      onTap={onSelect}
      draggable
      onDragEnd={handleDragEnd}
      id={id} // Pass id for hit detection in ArcManager
      name='element' // Generic name for easier hit detection
      elementType='place' // Custom attribute for type-specific logic
    >
      <Circle
        radius={radius / zoomLevel}
        fill="white"
        stroke={isSelected ? 'blue' : 'black'}
        strokeWidth={2 / zoomLevel}
      />
      <Text
        text={label}
        fontSize={12 / zoomLevel}
        fill="black"
        x={-radius / zoomLevel}
        y={(radius + 5) / zoomLevel}
        width={(radius * 2) / zoomLevel}
        align="center"
        listening={false}
      />
      {renderTokens()}
    </Group>
  );
};

export default Place;
