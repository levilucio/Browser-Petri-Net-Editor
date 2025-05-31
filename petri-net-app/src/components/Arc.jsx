import React from 'react';
import { Line, Text, Group, Rect } from 'react-konva';

const Arc = ({ arc, places, transitions, isSelected, onClick, canvasScroll = { x: 0, y: 0 }, zoomLevel = 1 }) => {
  // Debugging to help trace arc rendering issues
  console.log(`Rendering arc ${arc.id}:`, arc);
  
  // Normalize arc properties to handle different formats
  const normalizedArc = {
    ...arc,
    sourceId: arc.sourceId || arc.source,
    targetId: arc.targetId || arc.target,
    sourceType: arc.sourceType || 
               (arc.type === 'place-to-transition' ? 'place' : 'transition')
  };
  
  // Determine targetType if not explicitly provided
  if (!normalizedArc.targetType) {
    normalizedArc.targetType = arc.type === 'place-to-transition' ? 'transition' : 'place';
  }
  
  console.log(`Normalized arc ${normalizedArc.id}:`, normalizedArc);
  
  // Find source and target elements with more robust lookups
  let source, target;
  
  // Get source using normalized sourceId
  if (normalizedArc.sourceId) {
    if (normalizedArc.sourceType === 'place') {
      source = places.find(p => p.id === normalizedArc.sourceId);
      console.log(`Looking for source place ${normalizedArc.sourceId}:`, source ? 'Found' : 'Not found');
    } else {
      source = transitions.find(t => t.id === normalizedArc.sourceId);
      console.log(`Looking for source transition ${normalizedArc.sourceId}:`, source ? 'Found' : 'Not found');
    }
  }
  
  // Get target using normalized targetId
  if (normalizedArc.targetId) {
    if (normalizedArc.targetType === 'place') {
      target = places.find(p => p.id === normalizedArc.targetId);
      console.log(`Looking for target place ${normalizedArc.targetId}:`, target ? 'Found' : 'Not found');
    } else {
      target = transitions.find(t => t.id === normalizedArc.targetId);
      console.log(`Looking for target transition ${normalizedArc.targetId}:`, target ? 'Found' : 'Not found');
    }
  }
  
  // Fall back to less specific lookup if needed
  if (!source && normalizedArc.sourceId) {
    source = places.find(p => p.id === normalizedArc.sourceId) || 
             transitions.find(t => t.id === normalizedArc.sourceId);
    if (source) {
      console.log(`Found source using fallback lookup:`, source);
      // Update sourceType based on what we found
      normalizedArc.sourceType = places.some(p => p.id === normalizedArc.sourceId) ? 'place' : 'transition';
    }
  }
  
  if (!target && normalizedArc.targetId) {
    target = places.find(p => p.id === normalizedArc.targetId) || 
             transitions.find(t => t.id === normalizedArc.targetId);
    if (target) {
      console.log(`Found target using fallback lookup:`, target);
      // Update targetType based on what we found
      normalizedArc.targetType = places.some(p => p.id === normalizedArc.targetId) ? 'place' : 'transition';
    }
  }

  if (!source || !target) {
    console.log(`Arc ${normalizedArc.id} not rendered - missing source or target`);
    return null;
  }
  
  // Use the normalized source and target types
  const sourceType = normalizedArc.sourceType;
  const targetType = normalizedArc.targetType;

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

  // Apply canvas scroll adjustment to all coordinates and account for zoom level
  const scrollX = canvasScroll.x;
  const scrollY = canvasScroll.y;
  
  // Adjust positions for scrolling and zoom
  const displayStartX = adjustedStartX - scrollX / zoomLevel;
  const displayStartY = adjustedStartY - scrollY / zoomLevel;
  const displayEndX = adjustedEndX - scrollX / zoomLevel;
  const displayEndY = adjustedEndY - scrollY / zoomLevel;

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
