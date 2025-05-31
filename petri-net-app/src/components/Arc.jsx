import React from 'react';
import { Line, Text, Group } from 'react-konva';

const Arc = ({ arc, places, transitions, isSelected, onClick, canvasScroll = { x: 0, y: 0 }, zoomLevel = 1 }) => {
  // Normalize arc properties to handle different formats
  const sourceId = arc.sourceId || arc.source;
  const targetId = arc.targetId || arc.target;
  const arcSourceType = arc.sourceType || (arc.type === 'place-to-transition' ? 'place' : 'transition');
  const arcTargetType = arc.targetType || (arc.type === 'place-to-transition' ? 'transition' : 'place');
  
  // Find source and target elements
  let source, target;
  
  // Get source element
  if (arcSourceType === 'place') {
    source = places.find(p => p.id === sourceId);
  } else {
    source = transitions.find(t => t.id === sourceId);
  }
  
  // Get target element
  if (arcTargetType === 'place') {
    target = places.find(p => p.id === targetId);
  } else {
    target = transitions.find(t => t.id === targetId);
  }

  // If source or target not found, don't render the arc
  if (!source || !target) {
    console.log(`Arc ${arc.id} not rendered - missing source or target`);
    return null;
  }
  
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
  
  if (arcSourceType === 'place') {
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
  
  if (arcTargetType === 'place') {
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

  // Adjust positions for scrolling and zoom
  const displayStartX = adjustedStartX - canvasScroll.x / zoomLevel;
  const displayStartY = adjustedStartY - canvasScroll.y / zoomLevel;
  const displayEndX = adjustedEndX - canvasScroll.x / zoomLevel;
  const displayEndY = adjustedEndY - canvasScroll.y / zoomLevel;

  // Arrow head points adjusted for scroll
  const displayArrowPoint1X = arrowPoint1X - canvasScroll.x / zoomLevel;
  const displayArrowPoint1Y = arrowPoint1Y - canvasScroll.y / zoomLevel;
  const displayArrowPoint2X = arrowPoint2X - canvasScroll.x / zoomLevel;
  const displayArrowPoint2Y = arrowPoint2Y - canvasScroll.y / zoomLevel;
  
  // Label positions adjusted for scroll
  const displayMidX = midX - canvasScroll.x / zoomLevel;
  const displayMidY = midY - canvasScroll.y / zoomLevel;
  
  // Render arc, arrow head, and labels
  return (
    <Group onClick={onClick}>
      {/* Main arc line with hitbox for better selection */}
      <Line
        points={[displayStartX, displayStartY, displayEndX, displayEndY]}
        stroke={isSelected ? 'blue' : 'black'}
        strokeWidth={isSelected ? 2 : 1}
        hitStrokeWidth={10} /* Wider hit area for easier selection */
      />
      
      {/* Arrow head */}
      <Line
        points={[displayEndX, displayEndY, displayArrowPoint1X, displayArrowPoint1Y]}
        stroke={isSelected ? 'blue' : 'black'}
        strokeWidth={isSelected ? 2 : 1}
        hitStrokeWidth={10} /* Wider hit area for easier selection */
      />
      <Line
        points={[displayEndX, displayEndY, displayArrowPoint2X, displayArrowPoint2Y]}
        stroke={isSelected ? 'blue' : 'black'}
        strokeWidth={isSelected ? 2 : 1}
        hitStrokeWidth={10} /* Wider hit area for easier selection */
      />
      
      {/* Weight label */}
      {arc.weight && arc.weight > 1 && (
        <Text
          text={arc.weight.toString()}
          fontSize={12}
          fill="black"
          x={displayMidX + weightOffsetX - 5}
          y={displayMidY + weightOffsetY - 5}
          width={10}
          align="center"
        />
      )}
      
      {/* Arc name if present */}
      {arc.label && (
        <Text
          text={arc.label}
          fontSize={10}
          fill="gray"
          x={displayMidX + nameOffsetX - 15}
          y={displayMidY + nameOffsetY - 5}
          width={30}
          align="center"
        />
      )}
    </Group>
  );
};

export default Arc;
