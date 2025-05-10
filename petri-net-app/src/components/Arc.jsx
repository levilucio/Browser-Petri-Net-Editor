import React from 'react';
import { Line, Text, Group, Circle } from 'react-konva';

const Arc = ({ arc, places, transitions, isSelected, onClick }) => {
  // Find source and target elements
  const source = arc.sourceType === 'place' 
    ? places.find(p => p.id === arc.sourceId)
    : transitions.find(t => t.id === arc.sourceId);
  
  const target = arc.targetType === 'place' 
    ? places.find(p => p.id === arc.targetId)
    : transitions.find(t => t.id === arc.targetId);

  if (!source || !target) return null;

  // Get cardinal points for source and target
  const sourcePoints = getCardinalPoints(source, arc.sourceType);
  const targetPoints = getCardinalPoints(target, arc.targetType);
  
  // Use the specified directions if available, otherwise calculate the best points
  let sourcePoint, targetPoint;
  
  if (arc.sourceDirection && sourcePoints[arc.sourceDirection]) {
    sourcePoint = sourcePoints[arc.sourceDirection];
  } else {
    sourcePoint = findBestCardinalPoint(sourcePoints, targetPoints);
  }
  
  if (arc.targetDirection && targetPoints[arc.targetDirection]) {
    targetPoint = targetPoints[arc.targetDirection];
  } else {
    targetPoint = findBestCardinalPoint(targetPoints, sourcePoints);
  }
  
  // Calculate angle for arrow head
  const dx = targetPoint.x - sourcePoint.x;
  const dy = targetPoint.y - sourcePoint.y;
  const angle = Math.atan2(dy, dx);
  
  // Use the calculated points
  const adjustedStartX = sourcePoint.x;
  const adjustedStartY = sourcePoint.y;
  const adjustedEndX = targetPoint.x;
  const adjustedEndY = targetPoint.y;

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
        fill={isSelected ? 'blue' : 'black'}
        stroke={isSelected ? 'blue' : 'black'}
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

// Helper function to get cardinal points for an element
const getCardinalPoints = (element, elementType) => {
  const points = {};
  if (elementType === 'place') {
    // For places (circles)
    const radius = 20;
    points.north = { x: element.x, y: element.y - radius };
    points.south = { x: element.x, y: element.y + radius };
    points.east = { x: element.x + radius, y: element.y };
    points.west = { x: element.x - radius, y: element.y };
  } else if (elementType === 'transition') {
    // For transitions (rectangles)
    const width = 30;
    const height = 40;
    points.north = { x: element.x, y: element.y - height/2 };
    points.south = { x: element.x, y: element.y + height/2 };
    points.east = { x: element.x + width/2, y: element.y };
    points.west = { x: element.x - width/2, y: element.y };
  }
  return points;
};

// Helper function to find the best cardinal point based on the target
const findBestCardinalPoint = (sourcePoints, targetPoints) => {
  // Calculate center of target points
  const targetCenter = {
    x: Object.values(targetPoints).reduce((sum, p) => sum + p.x, 0) / Object.keys(targetPoints).length,
    y: Object.values(targetPoints).reduce((sum, p) => sum + p.y, 0) / Object.keys(targetPoints).length
  };
  
  // Find the point with minimum distance to target center
  let bestPoint = sourcePoints.north;
  let minDistance = Infinity;
  
  Object.values(sourcePoints).forEach(point => {
    const dx = point.x - targetCenter.x;
    const dy = point.y - targetCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < minDistance) {
      minDistance = distance;
      bestPoint = point;
    }
  });
  
  return bestPoint;
};

export default Arc;
