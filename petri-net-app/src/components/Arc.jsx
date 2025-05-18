import React from 'react';
import { Line, Text, Group, Rect } from 'react-konva';

const Arc = ({ arc, places, transitions, isSelected, onClick, canvasScroll = { x: 0, y: 0 } }) => {
  // Find source and target elements
  // Handle both the editor-created arcs and PNML-loaded arcs
  let source, target;
  
  // Get source - handle both formats
  if (arc.sourceId) {
    // Editor-created arc
    source = arc.sourceType === 'place' 
      ? places.find(p => p.id === arc.sourceId)
      : transitions.find(t => t.id === arc.sourceId);
  } else if (arc.source) {
    // PNML-loaded arc
    source = places.find(p => p.id === arc.source) || transitions.find(t => t.id === arc.source);
  }
  
  // Get target - handle both formats
  if (arc.targetId) {
    // Editor-created arc
    target = arc.targetType === 'place' 
      ? places.find(p => p.id === arc.targetId)
      : transitions.find(t => t.id === arc.targetId);
  } else if (arc.target) {
    // PNML-loaded arc
    target = places.find(p => p.id === arc.target) || transitions.find(t => t.id === arc.target);
  }
  
  // Determine source and target types
  const sourceType = arc.sourceType || 
                   (arc.type === 'place-to-transition' ? 'place' : 'transition') ||
                   (places.some(p => p.id === arc.source) ? 'place' : 'transition');
  
  const targetType = arc.targetType || 
                   (arc.type === 'place-to-transition' ? 'transition' : 'place') ||
                   (places.some(p => p.id === arc.target) ? 'place' : 'transition');

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
  
  if (sourceType === 'place') {
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
  
  if (targetType === 'place') {
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

  // Calculate midpoint for labels
  const midX = (adjustedStartX + adjustedEndX) / 2;
  const midY = (adjustedStartY + adjustedEndY) / 2;
  
  // Offset the weight label slightly to not overlap with the line (on one side)
  const weightOffsetX = -10 * Math.sin(angle);
  const weightOffsetY = 10 * Math.cos(angle);
  
  // Calculate name label position (on the opposite side of the arc from the weight)
  const nameOffsetX = 10 * Math.sin(angle);
  const nameOffsetY = -10 * Math.cos(angle);

  // Apply canvas scroll adjustment to all coordinates
  const scrollX = canvasScroll.x;
  const scrollY = canvasScroll.y;
  
  // Adjust positions for scrolling
  const displayStartX = adjustedStartX - scrollX;
  const displayStartY = adjustedStartY - scrollY;
  const displayEndX = adjustedEndX - scrollX;
  const displayEndY = adjustedEndY - scrollY;

  return (
    <Group onClick={onClick}>
      {/* Invisible wider line for easier selection */}
      <Line
        points={[
          displayStartX,
          displayStartY,
          displayEndX,
          displayEndY
        ]}
        stroke="transparent"
        strokeWidth={15}
        hitStrokeWidth={20}
      />
      
      {/* Arc line */}
      <Line
        points={[
          displayStartX,
          displayStartY,
          displayEndX,
          displayEndY
        ]}
        stroke={isSelected ? 'blue' : 'black'}
        strokeWidth={isSelected ? 2 : 1}
      />
      
      {/* Arrow head */}
      <Line
        points={[
          displayEndX,
          displayEndY,
          displayEndX - arrowHeadSize * Math.cos(angle - Math.PI / 6),
          displayEndY - arrowHeadSize * Math.sin(angle - Math.PI / 6),
          displayEndX - arrowHeadSize * Math.cos(angle + Math.PI / 6),
          displayEndY - arrowHeadSize * Math.sin(angle + Math.PI / 6),
          displayEndX,
          displayEndY
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
          fontStyle="bold"
          fill="black"
          x={(displayStartX + displayEndX) / 2 - 5}
          y={(displayStartY + displayEndY) / 2 - 10}
          width={20}
          align="center"
        />
      )}
      
      {/* Arc name label */}
      {arc.name && arc.name.trim() !== '' && (
        <Text
          text={arc.name}
          fontSize={11}
          fill="black"
          x={midX + nameOffsetX - 30}
          y={midY + nameOffsetY - 6}
          width={60}
          align="center"
        />
      )}
    </Group>
  );
};

export default Arc;
