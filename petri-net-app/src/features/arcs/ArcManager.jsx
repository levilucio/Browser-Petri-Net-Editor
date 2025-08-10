import React from 'react';
import { Layer, Arrow, Line, Circle, Group, Text } from 'react-konva';
import { usePetriNet } from '../../contexts/PetriNetContext';
import { useElementManager } from '../elements/useElementManager';
import { useArcManager } from './useArcManager';

const ArcManager = () => {
  const {
    elements,
    selectedElement,
    mode,
    tempArcEnd,
    getVirtualPointerPosition,
    gridSnappingEnabled,
    snapToGrid,
  } = usePetriNet();

  const { handleElementClick } = useElementManager();
  const {
    handleAddAnglePoint,
    handleDragAnglePoint,
    handleDeleteAnglePoint,
  } = useArcManager();

  const getElementById = (id) => {
    return elements.places.find(p => p.id === id) || elements.transitions.find(t => t.id === id);
  };

  // Helper functions for arc type inference (to handle XML-loaded arcs)
  const getArcSourceType = (arc) => {
    if (arc.sourceType) return arc.sourceType;
    if (arc.type === 'place-to-transition') return 'place';
    if (arc.type === 'transition-to-place') return 'transition';
    return 'place'; // fallback
  };

  const getArcTargetType = (arc) => {
    if (arc.targetType) return arc.targetType;
    if (arc.type === 'place-to-transition') return 'transition';
    if (arc.type === 'transition-to-place') return 'place';
    return 'transition'; // fallback
  };

  const getAdjustedPoints = (source, target, anglePoints = []) => {
    const allPoints = [{...source}, ...anglePoints, {...target}];
    const placeRadius = 30; // from Place.jsx
    const transitionWidth = 40; // from Transition.jsx
    const transitionHeight = 50; // from Transition.jsx

    const start = { ...allPoints[0] };
    const end = { ...allPoints[allPoints.length - 1] };
    const p1 = allPoints[1] || end;
    const p2 = allPoints[allPoints.length - 2] || start;

    let startDx = p1.x - start.x;
    let startDy = p1.y - start.y;
    let startAngle = Math.atan2(startDy, startDx);

    if (source.type === 'place') {
      start.x += placeRadius * Math.cos(startAngle);
      start.y += placeRadius * Math.sin(startAngle);
    } else { // transition
        const halfW = transitionWidth / 2;
        const halfH = transitionHeight / 2;
        const absCos = Math.abs(Math.cos(startAngle));
        const absSin = Math.abs(Math.sin(startAngle));
        if (halfW * absSin <= halfH * absCos) {
            start.x += Math.sign(startDx) * halfW;
            start.y += Math.sign(startDx) * halfW * Math.tan(startAngle);
        } else {
            start.x += Math.sign(startDy) * halfH / Math.tan(startAngle);
            start.y += Math.sign(startDy) * halfH;
        }
    }

    let endDx = end.x - p2.x;
    let endDy = end.y - p2.y;
    let endAngle = Math.atan2(endDy, endDx);

    if (target.type === 'place') {
      end.x -= placeRadius * Math.cos(endAngle);
      end.y -= placeRadius * Math.sin(endAngle);
    } else { // transition
        const halfW = transitionWidth / 2;
        const halfH = transitionHeight / 2;
        const absCos = Math.abs(Math.cos(endAngle));
        const absSin = Math.abs(Math.sin(endAngle));
        if (halfW * absSin <= halfH * absCos) {
            end.x -= Math.sign(endDx) * halfW;
            end.y -= Math.sign(endDx) * halfW * Math.tan(endAngle);
        } else {
            end.x -= Math.sign(endDy) * halfH / Math.tan(endAngle);
            end.y -= Math.sign(endDy) * halfH;
        }
    }
    
    const finalPoints = [start.x, start.y];
    anglePoints.forEach(p => finalPoints.push(p.x, p.y));
    finalPoints.push(end.x, end.y);

    return finalPoints;
  };

  return [
    <Layer key="arcs-layer">
      {/* Render existing arcs */}
      {elements?.arcs?.map(arc => {
        const source = getElementById(arc.source);
        const target = getElementById(arc.target);

        if (!source || !target) return null;

        const virtualPoints = getAdjustedPoints(
          {...source, type: getArcSourceType(arc)}, 
          {...target, type: getArcTargetType(arc)}, 
          arc.anglePoints
        );

        const textPos = {
          x: (virtualPoints[0] + virtualPoints[virtualPoints.length - 2]) / 2,
          y: (virtualPoints[1] + virtualPoints[virtualPoints.length - 1]) / 2 - 15,
        };

        return (
          <Group key={arc.id}>
            <Arrow
              points={virtualPoints}
              stroke={selectedElement?.id === arc.id ? 'blue' : 'black'}
              strokeWidth={2}
              fill="black"
              pointerLength={10}
              pointerWidth={10}
              onClick={() => handleElementClick(arc, 'arc')}
              onTap={() => handleElementClick(arc, 'arc')}
              onDblClick={(e) => {
                if (mode === 'arc_angle') {
                  const pos = getVirtualPointerPosition();
                  if (pos) handleAddAnglePoint(arc.id, pos);
                }
              }}
            />
            <Text
              x={textPos.x}
              y={textPos.y}
              text={arc.weight > 1 ? arc.weight : ''}
              fontSize={14}
            />
          </Group>
        );
      })}

      {/* Render temporary arc for creation */}
      {tempArcEnd && tempArcEnd.sourcePoint && (
        <Line
          points={[tempArcEnd.sourcePoint.x, tempArcEnd.sourcePoint.y, tempArcEnd.x, tempArcEnd.y]}
          stroke="grey"
          strokeWidth={2}
          dash={[5, 5]}
          listening={false}
        />
      )}
    </Layer>,

    // Layer for angle point handles
    <Layer key="handles-layer">
      {selectedElement?.type === 'arc' && mode === 'arc_angle' && (
        selectedElement.anglePoints.map((point, index) => {
          return (
            <Circle
              key={`angle-${selectedElement.id}-${index}`}
              x={point.x}
              y={point.y}
              radius={6}
              fill="red"
              stroke="black"
              strokeWidth={1}
              draggable
              onDragEnd={(e) => {
                const newPos = { x: e.target.x(), y: e.target.y() };
                const finalPos = gridSnappingEnabled ? snapToGrid(newPos.x, newPos.y) : newPos;
                handleDragAnglePoint(selectedElement.id, index, finalPos);
              }}
              onClick={(e) => {
                if (e.evt.button === 2) { // Right-click
                  e.evt.preventDefault();
                  handleDeleteAnglePoint(selectedElement.id, index);
                }
              }}
              onContextMenu={(e) => {
                e.evt.preventDefault();
                handleDeleteAnglePoint(selectedElement.id, index);
              }}
            />
          );
        })
      )}
    </Layer>
  ];
};

export default ArcManager;