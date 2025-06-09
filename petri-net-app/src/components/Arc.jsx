import React from 'react';
import { Line, Text, Group, Circle } from 'react-konva';

const Arc = ({ 
  arc, 
  places, 
  transitions, 
  isSelected, 
  onClick, 
  canvasScroll = { x: 0, y: 0 }, 
  zoomLevel = 1,
  onAnglePointAdded,
  onAnglePointDragged,
  onAnglePointDeleted,
  gridSize = 20,
  gridSnappingEnabled = true
}) => {
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
  
  // Calculate start and end points - source and target positions are already adjusted for scroll
  const startX = source.x;
  const startY = source.y;
  const endX = target.x;
  const endY = target.y;

  // Get angle points from arc or initialize empty array if none exist
  const anglePoints = arc.anglePoints || [];
  
  // Create adjusted angle points for display
  // Since we're handling the scroll adjustment in App.jsx for places and transitions,
  // we need to be consistent and handle angle points the same way
  const displayAnglePoints = anglePoints.map(point => ({
    x: point.x - canvasScroll.x / zoomLevel,
    y: point.y - canvasScroll.y / zoomLevel
  }));
  
  // Calculate start and end angles based on angle points or direct connection
  let startAngle, endAngle;
  
  if (displayAnglePoints.length > 0) {
    // If angle points exist, calculate angle from source to first angle point
    const firstPoint = displayAnglePoints[0];
    const lastPoint = displayAnglePoints[displayAnglePoints.length - 1];
    
    const dx1 = firstPoint.x - startX;
    const dy1 = firstPoint.y - startY;
    startAngle = Math.atan2(dy1, dx1);
    
    const dx2 = endX - lastPoint.x;
    const dy2 = endY - lastPoint.y;
    endAngle = Math.atan2(dy2, dx2);
  } else {
    // If no angle points, direct line from source to target
    const dx = endX - startX;
    const dy = endY - startY;
    startAngle = Math.atan2(dy, dx);
    endAngle = startAngle;  // Same angle
  }
  
  // Calculate angle for final segment (for arrow head)
  let finalSegmentAngle;
  if (displayAnglePoints.length > 0) {
    const lastPoint = displayAnglePoints[displayAnglePoints.length - 1];
    const dxLast = endX - lastPoint.x;
    const dyLast = endY - lastPoint.y;
    finalSegmentAngle = Math.atan2(dyLast, dxLast);
  } else {
    finalSegmentAngle = startAngle; // Direct line
  }
  
  // Adjust start and end points based on source and target shapes
  let adjustedStartX, adjustedStartY, adjustedEndX, adjustedEndY;
  
  if (arcSourceType === 'place') {
    // Adjust for circle (place)
    const radius = 20;
    adjustedStartX = startX + Math.cos(startAngle) * radius;
    adjustedStartY = startY + Math.sin(startAngle) * radius;
  } else {
    // Adjust for rectangle (transition)
    const width = 30;
    const height = 40;
    
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
    // Adjust for circle (place)
    const radius = 20;
    adjustedEndX = endX - Math.cos(endAngle) * radius;
    adjustedEndY = endY - Math.sin(endAngle) * radius;
  } else {
    // Adjust for rectangle (transition)
    const width = 30;
    const height = 40;
    
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

  // Calculate arrow head points
  const arrowHeadSize = 10;
  const arrowAngle1 = finalSegmentAngle - Math.PI / 6;
  const arrowAngle2 = finalSegmentAngle + Math.PI / 6;
  
  const arrowPoint1X = adjustedEndX - arrowHeadSize * Math.cos(arrowAngle1);
  const arrowPoint1Y = adjustedEndY - arrowHeadSize * Math.sin(arrowAngle1);
  const arrowPoint2X = adjustedEndX - arrowHeadSize * Math.cos(arrowAngle2);
  const arrowPoint2Y = adjustedEndY - arrowHeadSize * Math.sin(arrowAngle2);

  // Calculate midpoint for labels
  const midX = (adjustedStartX + adjustedEndX) / 2;
  const midY = (adjustedStartY + adjustedEndY) / 2;
  
  // Offset the weight label slightly to not overlap with the line (on one side)
  const weightOffsetX = -10 * Math.sin(finalSegmentAngle);
  const weightOffsetY = 10 * Math.cos(finalSegmentAngle);
  
  // Calculate name label position (on the opposite side of the arc from the weight)
  const nameOffsetX = 10 * Math.sin(finalSegmentAngle);
  const nameOffsetY = -10 * Math.cos(finalSegmentAngle);

  // Since places and transitions are already adjusted for scroll in App.jsx,
  // we don't need to adjust these positions again
  const displayStartX = adjustedStartX;
  const displayStartY = adjustedStartY;
  const displayEndX = adjustedEndX;
  const displayEndY = adjustedEndY;

  // Arrow head points (no additional scroll adjustment needed)
  const displayArrowPoint1X = arrowPoint1X;
  const displayArrowPoint1Y = arrowPoint1Y;
  const displayArrowPoint2X = arrowPoint2X;
  const displayArrowPoint2Y = arrowPoint2Y;
  
  // Label positions adjusted for scroll (consistent with other adjustments)
  const displayMidX = midX;
  const displayMidY = midY;

  // Prepare line points for drawing
  let linePoints = [];
  
  // Start with the adjusted start point (adjusted for scroll)
  linePoints.push(displayStartX, displayStartY);
  
  // Add all angle points if they exist
  if (displayAnglePoints.length > 0) {
    displayAnglePoints.forEach(point => {
      linePoints.push(point.x, point.y);
    });
  }
  
  // End with the adjusted end point (adjusted for scroll)
  linePoints.push(displayEndX, displayEndY);

  // Handle adding a new angle point when clicking on the arc line
  const handleLineClick = (e) => {
    // Only add angle points when the arc is selected
    if (!isSelected || !onAnglePointAdded) return;
    
    // Get the click position relative to the stage
    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    
    // Adjust for canvas scroll and zoom to get the virtual canvas coordinates
    const virtualX = pointerPos.x / zoomLevel + canvasScroll.x;
    const virtualY = pointerPos.y / zoomLevel + canvasScroll.y;
    
    // Add the new angle point
    onAnglePointAdded(arc.id, { x: virtualX, y: virtualY });
    
    // Stop event propagation to prevent selecting the arc again
    e.cancelBubble = true;
  };
  
  // Function to snap position to grid (local implementation to match App.jsx)
  const snapToGrid = (x, y) => {
    if (gridSnappingEnabled) {
      return {
        x: Math.round(x / gridSize) * gridSize,
        y: Math.round(y / gridSize) * gridSize
      };
    }
    return { x, y };
  };

  // Handle dragging an angle point
  const handleAnglePointDrag = (index, e) => {
    if (!onAnglePointDragged) return;
    
    // Get the drag position relative to the stage
    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    
    // Adjust for canvas scroll and zoom to get the virtual canvas coordinates
    const virtualX = pointerPos.x / zoomLevel + canvasScroll.x;
    const virtualY = pointerPos.y / zoomLevel + canvasScroll.y;
    
    // Apply grid snapping during drag
    const snappedPos = snapToGrid(virtualX, virtualY);
    
    // If this is a drag move (not drag end), update the node position directly for visual feedback
    if (e.type === 'dragmove') {
      e.target.position({
        x: (snappedPos.x - canvasScroll.x) / zoomLevel,
        y: (snappedPos.y - canvasScroll.y) / zoomLevel
      });
    }
    
    // Update the angle point position in the data model
    onAnglePointDragged(arc.id, index, snappedPos);
  };
  
  // Handle double-click to delete an angle point
  const handleAnglePointDoubleClick = (index, e) => {
    if (!onAnglePointDeleted) return;
    
    // Delete the angle point
    onAnglePointDeleted(arc.id, index);
    
    // Stop event propagation
    e.cancelBubble = true;
  };

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
        strokeWidth={isSelected ? 2 : 1}
        lineCap="round"
        lineJoin="round"
        shadowEnabled={isSelected}
        shadowColor="#3498db"
        shadowBlur={10}
        shadowOpacity={0.5}
        onClick={handleLineClick}  /* This line handles adding angle points */
        hitStrokeWidth={10}  /* Increased hit area for the visible line */
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
      
      {/* Render angle points as blue circles if the arc is selected */}
      {isSelected && displayAnglePoints && displayAnglePoints.length > 0 && displayAnglePoints.map((point, index) => {
        return (
          <Circle
            key={`angle-point-${index}`}
            x={point.x}
            y={point.y}
            radius={5}
            fill="#3498db"
            stroke="#2980b9"
            strokeWidth={1}
            draggable={true}
            onDragMove={(e) => handleAnglePointDrag(index, e)}
            onDragEnd={(e) => handleAnglePointDrag(index, e)}
            dragBoundFunc={(pos) => {
              // Apply grid snapping during drag for visual feedback
              const virtualX = pos.x * zoomLevel + canvasScroll.x;
              const virtualY = pos.y * zoomLevel + canvasScroll.y;
              const snappedPos = snapToGrid(virtualX, virtualY);
              return {
                x: (snappedPos.x - canvasScroll.x) / zoomLevel,
                y: (snappedPos.y - canvasScroll.y) / zoomLevel
              };
            }}
            onDblClick={(e) => handleAnglePointDoubleClick(index, e)}
            shadowEnabled={true}
            shadowColor="#2980b9"
            shadowBlur={5}
            shadowOpacity={0.5}
          />
        );
      })}
      
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
