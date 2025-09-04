import React from 'react';
import { Line, Text, Group } from 'react-konva';
import { usePetriNet } from '../contexts/PetriNetContext';

const Arc = ({ 
  arc, 
  places, 
  transitions, 
  isSelected, 
  onClick, 
  canvasScroll = { x: 0, y: 0 }, 
  zoomLevel = 1
}) => {
  const { simulationSettings } = usePetriNet();
  const netMode = simulationSettings?.netMode || 'pt';
  // Normalize arc properties to handle different formats
  const sourceId = arc.sourceId || arc.source;
  const targetId = arc.targetId || arc.target;
  
  // Fix the arc type inference logic to properly handle XML-loaded arcs
  let arcSourceType, arcTargetType;
  
  if (arc.sourceType && arc.targetType) {
    // If sourceType and targetType are explicitly set, use them
    arcSourceType = arc.sourceType;
    arcTargetType = arc.targetType;
  } else if (arc.type) {
    // Infer from arc.type property (for XML-loaded arcs)
    if (arc.type === 'place-to-transition') {
      arcSourceType = 'place';
      arcTargetType = 'transition';
    } else if (arc.type === 'transition-to-place') {
      arcSourceType = 'transition';
      arcTargetType = 'place';
    } else {
      // Fallback for unknown types
      arcSourceType = 'place';
      arcTargetType = 'transition';
    }
  } else {
    // Fallback for arcs without type information
    arcSourceType = 'place';
    arcTargetType = 'transition';
  }
  
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
    // Arc not rendered - missing source or target
    return null;
  }
  
  // Calculate start and end points - source and target positions are already adjusted for scroll
  const startX = source.x;
  const startY = source.y;
  const endX = target.x;
  const endY = target.y;

  // Calculate start and end angles for a straight line
  const dx = endX - startX;
  const dy = endY - startY;
  const startAngle = Math.atan2(dy, dx);
  const endAngle = startAngle;
  const finalSegmentAngle = startAngle;
  
  // Adjust start and end points based on source and target shapes
  let adjustedStartX, adjustedStartY, adjustedEndX, adjustedEndY;
  
  if (arcSourceType === 'place') {
    // Adjust for circle (place) - use correct radius from Place.jsx
    const radius = 30;
    adjustedStartX = startX + Math.cos(startAngle) * radius;
    adjustedStartY = startY + Math.sin(startAngle) * radius;
  } else {
    // Adjust for rectangle (transition) - use correct dimensions from Transition.jsx
    const width = 40;
    const height = 50;
    
    // Determine which side of the rectangle to start from
    if (Math.abs(Math.cos(startAngle)) > Math.abs(Math.sin(startAngle))) {
      // Horizontal side
      const sign = Math.cos(startAngle) > 0 ? 1 : -1;
      adjustedStartX = startX + sign * width / 2;
      adjustedStartY = startY + Math.sin(startAngle) / Math.cos(startAngle) * sign * width / 2;
    } else {
      // Vertical side
      const sign = Math.sin(startAngle) > 0 ? 1 : -1;
      adjustedStartX = startX + Math.cos(startAngle) / Math.sin(startAngle) * sign * height / 2;
      adjustedStartY = startY + sign * height / 2;
    }
  }
  
  if (arcTargetType === 'place') {
    // Adjust for circle (place) - use correct radius from Place.jsx
    const radius = 30;
    adjustedEndX = endX - Math.cos(endAngle) * radius;
    adjustedEndY = endY - Math.sin(endAngle) * radius;
  } else {
    // Adjust for rectangle (transition) - use correct dimensions from Transition.jsx
    const width = 40;
    const height = 50;
    
    // Determine which side of the rectangle to end at
    if (Math.abs(Math.cos(endAngle)) > Math.abs(Math.sin(endAngle))) {
      // Horizontal side
      const sign = Math.cos(endAngle) > 0 ? -1 : 1;
      adjustedEndX = endX + sign * width / 2;
      adjustedEndY = endY + Math.sin(endAngle) / Math.cos(endAngle) * sign * width / 2;
    } else {
      // Vertical side
      const sign = Math.sin(endAngle) > 0 ? -1 : 1;
      adjustedEndX = endX + Math.cos(endAngle) / Math.sin(endAngle) * sign * height / 2;
      adjustedEndY = endY + sign * height / 2;
    }
  }

  // We don't need to duplicate the start/end points here as they're already defined above
  
  // Calculate arrow head points
  const arrowHeadSize = 10;
  const arrowAngle1 = finalSegmentAngle - Math.PI / 6;
  const arrowAngle2 = finalSegmentAngle + Math.PI / 6;
  
  const arrowPoint1X = adjustedEndX - arrowHeadSize * Math.cos(arrowAngle1);
  const arrowPoint1Y = adjustedEndY - arrowHeadSize * Math.sin(arrowAngle1);
  const arrowPoint2X = adjustedEndX - arrowHeadSize * Math.cos(arrowAngle2);
  const arrowPoint2Y = adjustedEndY - arrowHeadSize * Math.sin(arrowAngle2);

  // Define display coordinates for rendering (adjusted for scroll)
  const displayStartX = adjustedStartX;
  const displayStartY = adjustedStartY;
  const displayEndX = adjustedEndX;
  const displayEndY = adjustedEndY;

  // Arrow head points (no additional scroll adjustment needed)
  const displayArrowPoint1X = arrowPoint1X;
  const displayArrowPoint1Y = arrowPoint1Y;
  const displayArrowPoint2X = arrowPoint2X;
  const displayArrowPoint2Y = arrowPoint2Y;

  // Midpoint and segment angle for labels on a straight line
  const midX = (displayStartX + displayEndX) / 2;
  const midY = (displayStartY + displayEndY) / 2;
  const midSegmentAngle = Math.atan2(displayEndY - displayStartY, displayEndX - displayStartX);
  
  // Offset the weight label slightly to not overlap with the line (on one side)
  const weightOffsetX = -10 * Math.sin(midSegmentAngle);
  const weightOffsetY = 10 * Math.cos(midSegmentAngle);
  
  // Calculate name label position (on the opposite side of the arc from the weight)
  const nameOffsetX = 10 * Math.sin(midSegmentAngle);
  const nameOffsetY = -10 * Math.cos(midSegmentAngle);

  // Prepare line points for drawing (straight line)
  const linePoints = [displayStartX, displayStartY, displayEndX, displayEndY];

  // Return the arc component with polyline, arrow head, angle points, and weight label
  return (
    <Group onClick={onClick}>
      {/* Invisible wider line underneath for easier selection */}
      <Line
        points={linePoints}
        stroke="transparent"
        strokeWidth={15}  /* Much wider stroke for easier selection */
        lineCap="round"
        lineJoin="round"
        onClick={onClick}  /* This wider line handles the arc selection */
      />
      
      {/* Visible arc line */}
      <Line
        points={linePoints}
        stroke={isSelected ? '#3498db' : '#000'}
        strokeWidth={isSelected ? 1.25 : 0.7}
        lineCap="round"
        lineJoin="round"
        shadowEnabled={isSelected}
        shadowColor="#3498db"
        shadowBlur={10}
        shadowOpacity={0.5}
        onClick={onClick}
        hitStrokeWidth={10}
      />
      
      {/* Arrow head */}
      <Line
        points={[displayEndX, displayEndY, displayArrowPoint1X, displayArrowPoint1Y]}
        stroke={isSelected ? 'blue' : 'black'}
        strokeWidth={isSelected ? 1.25 : 0.7}
        hitStrokeWidth={10} /* Wider hit area for easier selection */
      />
      <Line
        points={[displayEndX, displayEndY, displayArrowPoint2X, displayArrowPoint2Y]}
        stroke={isSelected ? 'blue' : 'black'}
        strokeWidth={isSelected ? 1.25 : 0.7}
        hitStrokeWidth={10} /* Wider hit area for easier selection */
      />
      
      {/* Angle points removed */}
      
      {/* Weight label */}
      {arc.weight && parseInt(arc.weight) > 1 && (
        <Text
          text={arc.weight.toString()}
          fontSize={12}
          fill="black"
          x={midX + weightOffsetX - 10}
          y={midY + weightOffsetY - 5}
          width={30}
          align="center"
        />
      )}
      
      {/* Arc name if present */}
      {arc.label && (
        <Text
          text={arc.label}
          fontSize={10}
          fill="gray"
          x={midX + nameOffsetX - 15}
          y={midY + nameOffsetY - 5}
          width={30}
          align="center"
        />
      )}

      {/* Display bindings bag in algebraic-int mode */}
      {netMode === 'algebraic-int' && Array.isArray(arc.bindings) && arc.bindings.length > 0 && (
        <Text
          text={arc.bindings.join(', ')}
          fontSize={10}
          fill="#333"
          x={midX + nameOffsetX - 15}
          y={midY + nameOffsetY + 9}
          width={120}
          align="center"
        />
      )}
    </Group>
  );
};

export default Arc;
