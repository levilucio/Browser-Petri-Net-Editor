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
    canvasScroll,
    zoomLevel,
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

  const toStagePoints = (points) => {
    const stagePoints = [];
    for (let i = 0; i < points.length; i += 2) {
      stagePoints.push(
        (points[i] - canvasScroll.x) / zoomLevel,
        (points[i + 1] - canvasScroll.y) / zoomLevel
      );
    }
    return stagePoints;
  };

  const toStagePos = (pos) => ({
    x: (pos.x - canvasScroll.x) / zoomLevel,
    y: (pos.y - canvasScroll.y) / zoomLevel,
  });

  const getAdjustedPoints = (source, target, anglePoints = []) => {
    const allPoints = [{...source}, ...anglePoints, {...target}];
    const placeRadius = 30;
    const transitionWidth = 50;
    const transitionHeight = 20;

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
      {elements.arcs.map(arc => {
        const source = getElementById(arc.source);
        const target = getElementById(arc.target);

        if (!source || !target) return null;

        const virtualPoints = getAdjustedPoints(
          {...source, type: arc.sourceType}, 
          {...target, type: arc.targetType}, 
          arc.anglePoints
        );
        const stagePoints = toStagePoints(virtualPoints);

        const textPos = toStagePos({
          x: (virtualPoints[0] + virtualPoints[virtualPoints.length - 2]) / 2,
          y: (virtualPoints[1] + virtualPoints[virtualPoints.length - 1]) / 2 - 15,
        });

        return (
          <Group key={arc.id}>
            <Arrow
              points={stagePoints}
              stroke={selectedElement?.id === arc.id ? 'blue' : 'black'}
              strokeWidth={2 / zoomLevel}
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
              fontSize={14 / zoomLevel}
            />
          </Group>
        );
      })}

      {/* Render temporary arc for creation */}
      {tempArcEnd && tempArcEnd.sourcePoint && (
        <Line
          points={toStagePoints([tempArcEnd.sourcePoint.x, tempArcEnd.sourcePoint.y, tempArcEnd.x, tempArcEnd.y])}
          stroke="grey"
          strokeWidth={2 / zoomLevel}
          dash={[5 / zoomLevel, 5 / zoomLevel]}
          listening={false}
        />
      )}
    </Layer>,

    // Layer for angle point handles
    <Layer key="handles-layer">
      {selectedElement?.type === 'arc' && mode === 'arc_angle' && (
        selectedElement.anglePoints.map((point, index) => {
          const stagePos = toStagePos(point);
          return (
            <Circle
              key={`angle-${selectedElement.id}-${index}`}
              x={stagePos.x}
              y={stagePos.y}
              radius={6 / zoomLevel}
              fill="red"
              stroke="black"
              strokeWidth={1 / zoomLevel}
              draggable
              onDragEnd={(e) => {
                const virtualPos = {
                  x: (e.target.x() * zoomLevel) + canvasScroll.x,
                  y: (e.target.y() * zoomLevel) + canvasScroll.y,
                };
                const finalPos = gridSnappingEnabled ? snapToGrid(virtualPos.x, virtualPos.y) : virtualPos;
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