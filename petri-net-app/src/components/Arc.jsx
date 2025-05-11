import React from 'react';
import { Line, Text, Group } from 'react-konva';

const Arc = ({ arc, places, transitions, isSelected, onClick }) => {
  // Find source and target elements
  const source = arc.sourceType === 'place' 
    ? places.find(p => p.id === arc.sourceId)
    : transitions.find(t => t.id === arc.sourceId);
  
  const target = arc.targetType === 'place' 
    ? places.find(p => p.id === arc.targetId)
    : transitions.find(t => t.id === arc.targetId);

  if (!source || !target) return null;

  // Calculate start and end points
  const startX = source.x;
  const startY = source.y;
  const endX = target.x;
  const endY = target.y;

  // Calculate distance and angle for arrow head
  const dx = endX - startX;
  const dy = endY - startY;
  const angle = Math.atan2(dy, dx);
  
  // Adjust start and end points based on source and target shapes
  let adjustedStartX, adjustedStartY, adjustedEndX, adjustedEndY;
  
  if (arc.sourceType === 'place') {
    // Adjust for circle (place)
    const radius = 20;
    adjustedStartX = startX + Math.cos(angle) * radius;
    adjustedStartY = startY + Math.sin(angle) * radius;
  } else {
    // Adjust for rectangle (transition)
    const width = 30;
    const height = 40;
    
    // Determine which side of the rectangle to start from
    if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
      // Horizontal side
      const sign = Math.cos(angle) > 0 ? 1 : -1;
      adjustedStartX = startX + sign * width / 2;
      adjustedStartY = startY + Math.sin(angle) / Math.cos(angle) * sign * width / 2;
    } else {
      // Vertical side
      const sign = Math.sin(angle) > 0 ? 1 : -1;
      adjustedStartX = startX + Math.cos(angle) / Math.sin(angle) * sign * height / 2;
      adjustedStartY = startY + sign * height / 2;
    }
  }
  
  if (arc.targetType === 'place') {
    // Adjust for circle (place)
    const radius = 20;
    adjustedEndX = endX - Math.cos(angle) * radius;
    adjustedEndY = endY - Math.sin(angle) * radius;
  } else {
    // Adjust for rectangle (transition)
    const width = 30;
    const height = 40;
    
    // Determine which side of the rectangle to end at
    if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
      // Horizontal side
      const sign = Math.cos(angle) > 0 ? -1 : 1;
      adjustedEndX = endX + sign * width / 2;
      adjustedEndY = endY + Math.sin(angle) / Math.cos(angle) * sign * width / 2;
    } else {
      // Vertical side
      const sign = Math.sin(angle) > 0 ? -1 : 1;
      adjustedEndX = endX + Math.cos(angle) / Math.sin(angle) * sign * height / 2;
      adjustedEndY = endY + sign * height / 2;
    }
  }

  // Calculate arrow head points
  const arrowHeadSize = 10;
  const arrowAngle1 = angle - Math.PI / 6;
  const arrowAngle2 = angle + Math.PI / 6;
  
  const arrowPoint1X = adjustedEndX - arrowHeadSize * Math.cos(arrowAngle1);
  const arrowPoint1Y = adjustedEndY - arrowHeadSize * Math.sin(arrowAngle1);
  const arrowPoint2X = adjustedEndX - arrowHeadSize * Math.cos(arrowAngle2);
  const arrowPoint2Y = adjustedEndY - arrowHeadSize * Math.sin(arrowAngle2);

  // Calculate midpoint for weight label
  const midX = (adjustedStartX + adjustedEndX) / 2;
  const midY = (adjustedStartY + adjustedEndY) / 2;
  
  // Offset the label slightly to not overlap with the line
  const labelOffsetX = -10 * Math.sin(angle);
  const labelOffsetY = 10 * Math.cos(angle);

  return (
    <Group onClick={onClick}>
      {/* Invisible wider line for easier selection */}
      <Line
        points={[adjustedStartX, adjustedStartY, adjustedEndX, adjustedEndY]}
        stroke="transparent"
        strokeWidth={15}
        hitStrokeWidth={20}
      />
      
      {/* Arc line */}
      <Line
        points={[adjustedStartX, adjustedStartY, adjustedEndX, adjustedEndY]}
        stroke={isSelected ? 'blue' : 'black'}
        strokeWidth={isSelected ? 2 : 1}
      />
      
      {/* Arrow head */}
      <Line
        points={[
          adjustedEndX, adjustedEndY,
          arrowPoint1X, arrowPoint1Y,
          arrowPoint2X, arrowPoint2Y,
          adjustedEndX, adjustedEndY
        ]}
        closed={true}
        fill="black"
        stroke="black"
      />
      
      {/* Weight label */}
      {arc.weight && arc.weight > 1 && (
        <Text
          text={arc.weight.toString()}
          fontSize={12}
          fill="black"
          x={midX + labelOffsetX - 5}
          y={midY + labelOffsetY - 5}
          width={10}
          align="center"
        />
      )}
    </Group>
  );
};

export default Arc;
